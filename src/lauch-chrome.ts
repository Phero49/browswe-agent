import puppeteer, { Browser } from "puppeteer-core";
import fetch from "node-fetch";
import { execSync, spawn } from "child_process";
import fs from "fs";
import path from "path";
import { observeChat, pasteBlobToElement, processBody } from "./utils/utils.js";

const PORT = 9222;
const APP_PATH = "/tmp/chrome-debug-profile"; // Change this to your desired app path

async function checkDebugPort() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/version`, {
      timeout: 2000
    });
    return true;
  } catch (error) {
    return false;
  }
}

async function launchChromeWithProfile() {
  console.log("🔍 Checking if debug port is already open...");
  
  // Check if port is already in use
  const isPortOpen = await checkDebugPort();
  if (isPortOpen) {
    console.log("✅ Debug port is already open");
    return true;
  }

  console.log("🚀 Launching Chrome with debug port...");
  
  // Kill any existing Chrome instances using our port
  try {
    execSync(`pkill -f "chrome.*--remote-debugging-port=${PORT}"`, { stdio: 'ignore' });
    execSync(`pkill -f "google-chrome.*--remote-debugging-port=${PORT}"`, { stdio: 'ignore' });
    await new Promise(r => setTimeout(r, 2000));
  } catch (e) {
    // Ignore errors - no processes to kill
  }

  // Launch Chrome with the specified user data directory
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${APP_PATH}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding'
  ];

  console.log(`📝 Chrome command: google-chrome ${chromeArgs.join(' ')}`);

  // Method 1: Using spawn
  const chromeProcess = spawn('google-chrome', chromeArgs, {
    detached: true,
    stdio: 'ignore'
  });

  chromeProcess.unref();
  console.log(`📝 Chrome process started with PID: ${chromeProcess.pid}`);

  // Wait for debug port to become available
  console.log("⏳ Waiting for Chrome debug port...");
  for (let i = 0; i < 30; i++) {
    const isReady = await checkDebugPort();
    if (isReady) {
      console.log("✅ Chrome debug port is ready!");
      return true;
    }
    
    // Check if Chrome process is still running
    try {
      process.kill(chromeProcess.pid, 0); // Throws if process doesn't exist
      console.log(`🔄 Chrome is starting... (${i + 1}/30)`);
    } catch (processError) {
      console.log("❌ Chrome process died, trying alternative method...");
      
      // Method 2: Try with execSync as fallback
      try {
        console.log("🔄 Trying alternative launch method...");
        execSync(`google-chrome --remote-debugging-port=${PORT} --user-data-dir=${APP_PATH} --no-first-run > /dev/null 2>&1 &`, {
          stdio: 'ignore'
        });
        
        // Wait a bit more for this method
        await new Promise(r => setTimeout(r, 5000));
        
        const isReadyNow = await checkDebugPort();
        if (isReadyNow) {
          console.log("✅ Chrome debug port is ready with alternative method!");
          return true;
        }
      } catch (execError) {
        console.log("❌ Alternative method also failed");
      }
      
      break;
    }
    
    await new Promise(r => setTimeout(r, 1000));
  }

  throw new Error("Chrome failed to start debug port within 30 seconds");
}

export async function connectToBrowser() {
  console.log("🔗 Connecting to Chrome...");
  
  // Get WebSocket endpoint
  const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
  const data = await res.json();
  const wsEndpoint = data.webSocketDebuggerUrl;
  
  console.log("📡 WebSocket endpoint:", wsEndpoint);

  const browser = await puppeteer.connect({
    browserWSEndpoint: wsEndpoint,
    defaultViewport: null
  });

  return browser 
}

// Main execution
async function main() {
  try {
    // Step 1: Launch Chrome with debug port
    await launchChromeWithProfile();

    // Step 2: Connect to the browser
    const browser = await connectToBrowser();
    console.log("✅ Successfully connected to Chrome");

    // Step 3: Continue with your existing code
    const page = await browser.newPage();
    console.log("🌐 Navigating to LinkedIn...");
    
    const pageResponse = await page.goto("https://japan-dev.com/", {
      waitUntil: "networkidle0",
      timeout: 60000
    });

    if (pageResponse?.ok()) {
      await page.setViewport({ width: 1080, height: 1024 });
      let bodyElement = await page.$("body");

      if (bodyElement) {
        const page2 = await browser.newPage();
        await page2.goto("https://chat.deepseek.com/", {
          waitUntil: "networkidle0"
        });
bodyElement =  await page.$("body");
        const actions = await processBody(bodyElement);

        const jsonPath = path.resolve("./actions.json");
        const imagePath = path.resolve("./screenshot.webp");
        const jsonData = JSON.stringify(Object.values(actions).map((v) => v.info), null, 2)

        fs.writeFileSync(
          jsonPath,jsonData
          
        );


     const image =   await page.screenshot({ type: "webp",captureBeyondViewport:false,fullPage:false });

const jsonText = fs.readFileSync(jsonPath, "utf8");
const imageBase64 = image.toString("base64");
const textarea = await page2.waitForSelector("textarea", {
  timeout: 60000 * 3
});

if (textarea) {
  // Focus the textarea and dispatch a synthetic paste event with JSON and image blobs.
  await textarea.focus();
  await textarea.evaluate((el, jsonText, imageBase64) => {
    const jsonBlob = new Blob([jsonText], { type: 'application/json' });

    // Convert base64 image to Uint8Array
    const binary = atob(imageBase64);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const imageBlob = new Blob([bytes], { type: 'image/webp' });

    // Create a DataTransfer / ClipboardEvent to simulate paste
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(new File([jsonBlob],"json-screen-map.json",{type:jsonBlob.type}));
    dataTransfer.items.add(new File([imageBlob], 'screenshot.webp', { type: 'image/webp' }));

    const pasteEvent = new ClipboardEvent('paste', {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true
    });

    el.dispatchEvent(pasteEvent);
  }, jsonText, imageBase64);

   const prompt  =  fs.readFileSync("./md/prompt.md",{
    encoding:'utf-8'
   })
  await page2.keyboard.type(prompt,);
 await  new Promise<void>((resolve, reject) => {
    setTimeout(resolve,10000)
  })
 await page2.keyboard.press("Enter");
const data = await bodyElement.evaluate(v => v.innerHTML); // grab raw HTML
const results = await observeChat({ innerHTML: data }); // run locally in Node


 console.log(results,'got out')
 
}
      }
    }

    console.log("✅ Script completed successfully");

  } catch (error) {
    console.error("💥 Error:", error.message);
    
    // Additional diagnostics
    console.log("\n🔧 Running diagnostics...");
    try {
      console.log("🌐 Checking if port is accessible...");
      await fetch(`http://127.0.0.1:${PORT}/json/version`);
    } catch (e) {
      console.log("❌ Port is not accessible");
    }
    
    try {
      console.log("🔍 Checking Chrome processes...");
      const processes = execSync('pgrep -f "google-chrome" | wc -l').toString().trim();
      console.log(`📊 Chrome processes running: ${processes}`);
    } catch (e) {
      console.log("❌ Error checking processes");
    }
    
    process.exit(1);
  }
}

