import puppeteer, { Browser } from "puppeteer-core";
import fetch from "node-fetch";

const PORT = 9222;
const APP_PATH = "/tmp/chrome-debug-profile"; // Change this to your desired app path



export async function connectToBrowser() {
  console.log("🔗 Connecting to Chrome...");
  
  // Get WebSocket endpoint
  const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
  const data = await res.json();
  const wsEndpoint = data.webSocketDebuggerUrl;
  
  console.log("📡 WebSocket endpoint:", wsEndpoint);

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null,

  });

  return browser 
}

