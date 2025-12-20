import { WebSocketServer } from "ws";
import { createServer } from "http";
import express from "express";
import { launchChromeWithProfile } from "./src/md/cmd/commandList";
import { runCommand, useCommand } from "./src/md/cmd/commandsRegister";
import { connectToBrowser } from "./src/lauch-chrome";
import type { Browser, Page } from "puppeteer-core";
import { attachControlPanels, openControls } from "./src/utils/utils";
import { pastePrompts, typeText } from "./src/utils/domutils";

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

const commands = useCommand();
let browser: Browser;
let tabs: Record<string, Page> = {};
let isProcessingMessage = false;
let aiPage: Page;
const getNextIndex = () => Object.keys(tabs).length;

commands.runSocketEvents("launch-chrome", async (payload, ws) => {
  try {
    const launched = await launchChromeWithProfile();
    if (launched) {
      commands.sendMessage("launch-chrome", { success: true });

      try {
        browser = await connectToBrowser();
        commands.sendMessage("connect-to-browser", {
          success: true,
        });

        let index = getNextIndex();
        if ((await browser.pages()).length > 0) {
          for (const page of await browser.pages()) {
            if (
              aiPage == undefined &&
              page.url().startsWith("https://chat.qwen.ai/")
            ) {
              aiPage = page;
              tabs[index] = page;
              continue;
            }
            await attachControlPanels(page, index);
            tabs[index] = page;
          }
        }
        if (!aiPage) {
          const firstPage = await browser.newPage();
          await firstPage.goto("https://chat.qwen.ai/");
          tabs[index] = firstPage;
          aiPage = firstPage;
        }

        // const pages = await attachControlPanels(browser)
        //    commands.sendMessage("control-panels", {
        //     success: true,

        //   });
        browser.on("targetcreated", async (target) => {
          if (target.type() == "page") {
            const newPage = await target.page();
            const index = getNextIndex();
            await attachControlPanels(newPage, index);
      
            tabs[index.toString()] = newPage;
          }
        });

        browser.on("targetdestroyed", async (target) => {
          console.log("destroyed");
          if (target.type() == "page") {
            const targetPage = (await target.page()) as Page;
            const indexKey = await targetPage.$eval("#control-panels", (el) => {
              const tabIndex = el.getAttribute("tab-index");
              return tabIndex ?? -1;
            });
            delete tabs[indexKey];
          }
        });
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

type InstructionPayload = {
  thinking: boolean;
  message: string;
  search: boolean;
  mode: "assistant" | "agent";
};
commands.runSocketEvents(
  "send-instruction",
  (payload: InstructionPayload, ws) => {
    if (tabs[0]) {
      tabs;
    }
  }
);

let chatUrl:string|null = null
let promptLoaded = false
commands.runSocketEvents("message", async (payload:{message:string,agentMode:boolean,captureScreen:boolean}) => {
  if (aiPage) {
    if (chatUrl == null) {
    const chatId =  aiPage.url().split('/').at(-1)
   if (chatId != undefined && chatId.length >= 10) {
    chatUrl = aiPage.url()
   }
    }
if (!promptLoaded) {
 await  pastePrompts(aiPage)
}
     typeText(aiPage,payload.message)
  }
 
  console.log(payload);
});

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
