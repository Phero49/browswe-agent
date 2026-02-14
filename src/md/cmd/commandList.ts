import { readFile } from "fs/promises";
import { execSync, spawn } from "child_process";
import { existsSync, mkdir, mkdirSync } from "fs";
import { readFile } from "fs/promises";
import path, { dirname, join } from "path";
import { fileURLToPath } from "url";
import os from "os";
const PORT = 9222;
export const APP_PATH = path.join(os.homedir(), "tmp", "chrome-profile");

export async function checkDebugPort() {
  try {
    const response = await fetch(`http://127.0.0.1:${PORT}/json/version`, {});
    return true;
  } catch (error) {
    return false;
  }
}

export async function launchChromeWithProfile() {
  if (!existsSync(APP_PATH)) {
    mkdirSync(APP_PATH, { recursive: true });
  }
  // Check if port is already in use
  const isPortOpen = await checkDebugPort();
  if (isPortOpen) {
    console.log("✅ Debug port is already open");
    return true;
  }

  console.log("🚀 Launching Chrome with debug port...");

  //TODO
  // // Kill any existing Chrome instances using our port
  // try {
  //   execSync(`pkill -f "chrome.*--remote-debugging-port=${PORT}"`, { stdio: 'ignore' });
  //   execSync(`pkill -f "google-chrome.*--remote-debugging-port=${PORT}"`, { stdio: 'ignore' });
  //   await new Promise(r => setTimeout(r, 2000));
  // } catch (e) {
  //   // Ignore errors - no processes to kill
  // }

  // Launch Chrome with the specified user data directory
  const chromeArgs = [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${APP_PATH}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-background-timer-throttling",
    "--disable-renderer-backgrounding",
    "--no-sandbox",
  ];

  console.log(`📝 Chrome command: google-chrome ${chromeArgs.join(" ")}`);

  // Method 1: Using spawn
  const chromeProcess = spawn("google-chrome", chromeArgs, {
    detached: true,
    stdio: "ignore",
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
      process.kill(chromeProcess.pid as number, 0); // Throws if process doesn't exist
      console.log(`🔄 Chrome is starting... (${i + 1}/30)`);
    } catch (processError) {
      console.log("❌ Chrome process died, trying alternative method...");

      // Method 2: Try with execSync as fallback
      try {
        console.log("🔄 Trying alternative launch method...");
        execSync(
          `google-chrome --remote-debugging-port=${PORT} --user-data-dir=${APP_PATH} --no-first-run > /dev/null 2>&1 &`,
          {
            stdio: "ignore",
          },
        );

        // Wait a bit more for this method
        await new Promise((r) => setTimeout(r, 5000));

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

    await new Promise((r) => setTimeout(r, 1000));
  }

  throw new Error("Chrome failed to start debug port within 30 seconds");
}

async function attachFab() {
  const html = await readFile("./index.html", { encoding: "utf-8" });
  return html;
}
