import { WebSocketServer } from "ws";
import { createServer } from "http";
import express from "express";
import { launchChromeWithProfile } from "./src/md/cmd/commandList";
import { runCommand, useCommand } from "./src/md/cmd/commandsRegister";
import { connectToBrowser } from "./src/connect-to-chrome";
import type { Browser, Page } from "puppeteer-core";
import {
  attachControlPanels,
  openControls,
  pasteBlobToElement,
} from "./src/utils/utils";
import { pastePrompts, typeText, uploadFiles } from "./src/utils/domutils";
import type { MessagePayload, OpenedTabs } from "./types";
import { getControlCss } from "./src/utils/controls";
import { text } from "stream/consumers";
import { writeFile, writeFileSync } from "fs";

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({
  server,
  // Add these for debugging:
  clientTracking: true, // Track all connected clients
});

// 2. Log ANY server events
wss.on("listening", () => {
  console.log("✅ WebSocket Server is LISTENING on port 8080");
  console.log(`🌐 Connect via: ws://localhost:8080`);
});

wss.on("error", (error) => {
  console.error("❌ WebSocket Server ERROR:", error);
});

let browser: Browser;
let tabs: Record<string, Page> = {};
let isProcessingMessage = false;
let aiPage: Page;
let chromeConnected = false;
let chromeLaunched = false;
let promptLoaded = false;

async function chromeIsConnected() {
  try {
    if (!chromeLaunched) {
      const launched = await launchChromeWithProfile();
    }

    if (!chromeConnected) {
      browser = await connectToBrowser();
    }
    return true;
  } catch (error) {
    console.log(error);
    return false;
  }
}

const commands = useCommand();
commands.beforeNext = chromeIsConnected;
commands.runSocketEvents("launch-chrome", async (payload, ws) => {
  try {
    const launched = await launchChromeWithProfile();
    if (launched) {
      commands.sendMessage("launch-chrome", { success: true });
      chromeLaunched = true;

      try {
        browser = await connectToBrowser();
        commands.sendMessage("connect-to-browser", {
          success: true,
        });
        chromeConnected = true;
        if (!aiPage) {
          const firstPage = await browser.newPage();
          await firstPage.goto("https://chat.qwen.ai/");
          aiPage = firstPage;
        }
      } catch (error) {
        console.log(error);
        commands.sendMessage("connect-to-browser", {
          success: false,
          error: error,
        });
      }

      return;
    }
  } catch (error) {
    console.log(error);
    commands.sendMessage("launch-chrome", { success: false });
  }
});

commands.runSocketEvents("open-controls", (payload, ws) => {
  const activeTab = payload.index;
  if (activeTab) {
    const tab = tabs[activeTab];
    if (tab) {
      openControls(tab, activeTab);
    }
  }

  commands.sendMessage("control-opened", "");
});

commands.runSocketEvents("tabs", (payload: OpenedTabs) => {});

commands.runSocketEvents("get-css", async () => {
  const css = await getControlCss();
  commands.sendMessage("get-css", css);
});

const aiBaseUrl = "https://chat.qwen.ai";

type InstructionPayload = {
  thinking: boolean;
  message: string;
  search: boolean;
  mode: "assistant" | "agent";
};
commands.runSocketEvents(
  "message-instruction",
  async (payload: MessagePayload, ws) => {
    if (aiPage == undefined) {
      const qwenPage = (await browser.pages()).find((p) =>
        p.url().startsWith(aiBaseUrl)
      );
      if (qwenPage) {
        aiPage = qwenPage;
      } else {
        const newPage = await browser.newPage();
        await newPage.goto("https://chat.qwen.ai/");
        aiPage = newPage;
        await newPage.waitForSelector("textarea");
      }
    }



    if (!promptLoaded) {
      await pastePrompts(aiPage);
      promptLoaded = true;
    }

    await typeText(aiPage, payload.message);
    if (payload.assistantMode) {
      const pages = await browser.pages();
      let target: Page | undefined;

      for (const p of pages) {
        const matches = await p.evaluate((id: string) => {
          return document.body.getAttribute("tab-id") === id;
        }, payload.tabId);

        if (matches) {
          target = p;
          break;
        }
      }

      if (target !== undefined) {
        await target.evaluate(() => {
          const host =
            document.querySelector<HTMLDivElement>("#agent-control-dom");
          if (host) host.style.display = "none";
        });

        const screenshot = await target.screenshot({
          captureBeyondViewport: false,
          type: "webp",
        });

        await target.evaluate(() => {
          const host =
            document.querySelector<HTMLDivElement>("#agent-control-dom");
          if (host) host.removeAttribute("style");
        });

        const file = new File(
          [new Uint8Array(screenshot)],
          (await target.title()) + ".webp",
          {
            type: "image/webp",
          }
        );
        writeFileSync("./screenshot.webp", screenshot);

      //  const uploadCompleted = await uploadFiles(aiPage, [file]);
       // console.log("uploaded", uploadCompleted);
      }
    }

    await aiPage.focus("textarea");
    //    aiPage.keyboard.press("Enter");
    await aiPage.evaluate(()=>{
      document.body.setAttribute('active-ai-page','yes')
    })
commands.sendMessage("message-sent",{})

  }
);

let chatUrl: string | null = null;
commands.runSocketEvents(
  "message",
  async (payload: {
    message: string;
    agentMode: boolean;
    captureScreen: boolean;
  }) => {
    if (aiPage) {
      if (chatUrl == null) {
        const chatId = aiPage.url().split("/").at(-1);
        if (chatId != undefined && chatId.length >= 10) {
          chatUrl = aiPage.url();
        }
      }
      if (!promptLoaded) {
        await pastePrompts(aiPage);
        promptLoaded = true;
      }
      typeText(aiPage, payload.message);
    }

    console.log(payload);
  }
);

// 3. Enhanced connection logging
wss.on("connection", (ws, request) => {
  console.log("🎉 NEW WebSocket Connection Established!");
  console.log(`📊 Client IP: ${request.socket.remoteAddress}`);
  console.log(`🔗 Total connections: ${wss.clients.size}`);
  commands.initWebSocket(ws);

  ws.on("close", () => {
    console.log("🔌 Connection closed");
    console.log(`📊 Remaining connections: ${wss.clients.size}`);
  });

  ws.on("error", (error) => {
    console.error("⚠️  WebSocket error:", error);
  });
});

// 4. HTTP endpoint to check server status
app.get("/status", (req, res) => {
  res.json({
    status: "running",
    connections: wss.clients.size,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  res.send(`
   socket is running
  `);
});

// 5. Start the server
const PORT = process.env.PORT || 8080;
server.listen(PORT, () => {
  console.log(`🚀 HTTP Server started on http://localhost:${PORT}`);
  console.log(`📡 WebSocket available at ws://localhost:${PORT}`);
});

// 6. Graceful shutdown
process.on("SIGINT", () => {
  console.log("\n👋 Shutting down server...");
  wss.clients.forEach((client) => client.close());
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
