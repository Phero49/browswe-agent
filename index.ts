import express from "express";
import { createServer } from "http";
import { writeFileSync } from "fs";
import type { Browser, Page } from "puppeteer-core";

import { launchChromeWithProfile } from "./src/md/cmd/commandList";
import { connectToBrowser } from "./src/connect-to-chrome";
import { listenToNetWork } from "./src/utils/utils";
import { typeText, uploadFiles } from "./src/utils/domutils";
import { getControlCss } from "./src/utils/controls";
import type { MessagePayload, TaskDefinition } from "./types";
import { BROWSER, runSkill, uploadSkills } from "./src/utils/skils";

// --- Configuration & Constants ---
const PORT = process.env.PORT || 8080;
const AI_BASE_URL = "https://chat.qwen.ai";

// --- Application State ---
const app = express();
const server = createServer(app);

let browser: Browser;
let aiPage: Page;
let chromeLaunched = false;
let chromeConnected = false;

// --- Helper Functions ---

/**
 * Ensures Chrome is launched and connected.
 */
async function ensureChromeConnection() {
  try {
    if (!chromeLaunched) {
      await launchChromeWithProfile();
      chromeLaunched = true;
    }
    if (!chromeConnected) {
      browser = await connectToBrowser();
      chromeConnected = true;
    }
    return true;
  } catch (error) {
    console.error("❌ Chrome Connection Error:", error);
    return false;
  }
}

// --- Browser Actions ---

async function launchChromeAction() {
  const launched = await launchChromeWithProfile();
  if (!launched) return;

  chromeLaunched = true;
  browser = await connectToBrowser();
  chromeConnected = true;
  console.log("✅ Connected to browser");

  const pages = await browser.pages();
  BROWSER.instance = browser;
  BROWSER.isReady = true;
  let qwenPage = pages.find((p) => p.url().startsWith(AI_BASE_URL));

  if (qwenPage) {
    aiPage = qwenPage;
  } else {
    aiPage = await browser.newPage();
    await aiPage.goto(`${AI_BASE_URL}/`);
  }
  console.log("🤖 AI Page ready");
}

// --- Express Middleware & Routes ---

app.use(express.json());

// CORS Middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(200);
  next();
});

/**
 * Actions API - Native REST endpoints with Direct Response Streaming
 */

app.post("/action/launch-chrome", async (req, res) => {
  try {
    await launchChromeAction();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/action/get-css", async (req, res) => {
  try {
    await ensureChromeConnection();
    const css = await getControlCss();
    res.json({ success: true, css });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/action/message-instruction", async (req, res) => {
  let cleanup: (() => void) | undefined;
  let fullResponse = "";

  try {
    await ensureChromeConnection();
    const payload: MessagePayload = req.body;

    if (!aiPage || aiPage.isClosed()) {
      const pages = await browser.pages();
      aiPage =
        pages.find((p) => p.url().startsWith(AI_BASE_URL) && !p.isClosed()) ||
        (await browser.newPage());
      if (!aiPage.url().startsWith(AI_BASE_URL)) {
        await aiPage.goto(`${AI_BASE_URL}/`);
        await aiPage.waitForSelector("textarea");
      }
    }

    const uploadedSkills = await aiPage.evaluate(() => {
      if (window.uploadedSkills) {
        return true;
      }
      const checkSkillMD = document.querySelectorAll(".fileitem-btn");

      const isSkillsUploaded = Array.from(checkSkillMD).find((v) =>
        v.textContent.toLowerCase().includes("skills.md"),
      );

      if (isSkillsUploaded) {
        return true;
      }

      return false;
    });
    if (!uploadedSkills) {
      const skills = uploadSkills();
      await uploadFiles(aiPage, [
        new File([skills], "skills.md", { type: "text/markdown" }),
      ]);
      aiPage.evaluate(() => {
        window.uploadedSkills = true;
      });
    }

    // Set headers for Response Streaming (SSE over POST)
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders();

    // Monitor for AI response and pipe CONCATENATED response directly

    async function talkToModel(payload: MessagePayload) {
      cleanup = await listenToNetWork(
        aiPage,
        async (data, status, responseId) => {
          fullResponse += data;
          if (fullResponse.startsWith("=>execute-local")) {
            if (status == "finished") {
              function extractCodeBlock(md: string): string | null {
                const match = md.match(/```[\w-]*\n?([\s\S]*?)```/);
                return match?.[1]?.trim() ?? null;
              }

              const code = extractCodeBlock(fullResponse);
              if (code) {
                const parsedData = JSON.parse(code) as TaskDefinition;
                const results = await runSkill(parsedData);
                if (results.returnResponseToMode) {
                  payload.message = `Here is the result of the prevous steps: ${JSON.stringify(results.output)}`;
                  await talkToModel(payload);
                  console.log("return this to ai ");
                } else {
                  const chunk = JSON.stringify({
                    data:
                      parsedData.userMessage +
                      `\n  \`\`\` json ${JSON.stringify(results.output)})}\`\`\``,
                    status,
                    responseId,
                  });
                  console.log(results);

                  res.write(`data: ${chunk}\n\n`);
                  if (cleanup) cleanup();
                  res.end();
                }
              }
            }
          } else {
            const chunk = JSON.stringify({
              data: fullResponse,
              status,
              responseId,
            });

            res.write(`data: ${chunk}\n\n`);

            if (status === "finished") {
              if (cleanup) cleanup();
              res.end();
            }
          }
        },
      );

      req.on("close", () => {
        if (cleanup) cleanup();
      });

      await typeText(aiPage, payload.message);
      // Assistant mode screenshot logic
      if (payload.modes === "assistant" && payload.tabId) {
        const pages = await browser.pages();
        let target: Page | undefined;
        for (const p of pages) {
          if (p.isClosed()) continue;
          const isTarget = await p.evaluate(
            (id) => document.body.getAttribute("tab-id") === id,
            payload.tabId,
          );
          if (isTarget) {
            target = p;
            break;
          }
        }

        if (target) {
          await target.evaluate(() => {
            const host =
              document.querySelector<HTMLDivElement>("#bex-app-iframe");
            if (host) host.style.visibility = "hidden";
          });
          const screenshot = await target.screenshot({
            type: "jpeg",
            quality: 50,
          });
          await target.evaluate(() => {
            const host =
              document.querySelector<HTMLDivElement>("#bex-app-iframe");
            if (host) host.style.visibility = "visible";
          });
          const title = (await target.title()).replace(/\s+/g, "-");
          const file = new File([new Uint8Array(screenshot)], `${title}.png`, {
            type: "image/png",
          });
          writeFileSync("./screenshot.png", Buffer.from(screenshot));
          await uploadFiles(aiPage, [file]);
        }
      }

      // Press Enter
      await aiPage.$eval(
        ".message-input-textarea",
        async (el, { mode, uploadedSkills }) => {
          const event = new KeyboardEvent("keydown", {
            key: "Enter",
            code: "Enter",
            keyCode: 13,
            bubbles: true,
            cancelable: true,
          });

          if (mode === "agent" || mode === "assistant" || !uploadedSkills) {
            const interval = setInterval(() => {
              if (el instanceof HTMLElement) el.dispatchEvent(event);
            }, 3000);

            const originalFetch = window.fetch;
            window.fetch = async (...args) => {
              const response = await originalFetch(...args);
              if (args[0].toString().includes("/chat/completions")) {
                clearInterval(interval);
              }
              return response;
            };
          } else {
            if (el instanceof HTMLElement) el.dispatchEvent(event);
          }
        },
        {
          mode: payload.modes,
          uploadedSkills: uploadedSkills,
        },
      );
    }

    talkToModel(payload);
  } catch (err: any) {
    console.error("❌ Action Error:", err);
    if (cleanup) cleanup();
    if (!res.writableEnded) {
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    }
  }
});

// --- System Status ---

app.get("/status", (req, res) => {
  res.json({
    status: "running",
    chrome: { launched: chromeLaunched, connected: chromeConnected },
    uptime: process.uptime(),
  });
});

app.get("/", (req, res) => {
  res.send(`
    <html>
      <body style="font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white;">
        <div style="text-align: center; padding: 2rem; border-radius: 1rem; background: #1e293b; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);">
          <h1 style="color: #38bdf8;">Agent API Server</h1>
          <p>Status: <span style="color: #4ade80;">Online</span></p>
        </div>
      </body>
    </html>
  `);
});

// --- Server Lifecycle ---

server.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
  launchChromeAction();
});

process.on("SIGINT", () => {
  console.log("\n👋 Shutting down...");
  server.close(() => process.exit(0));
});
