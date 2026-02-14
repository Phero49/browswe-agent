import type { HTTPRequest, Page, PageEventObject } from "puppeteer-core";
import { pasteBlobToElement, toBase64 } from "./utils";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

export async function capturePageContentAsPdf(page: Page) {
  const pageAsPdf = await page.pdf({ displayHeaderFooter: false });
  return pageAsPdf;
}

async function capturePageContentImage(page: Page) {
  const pageAsPdf = await page.screenshot({ captureBeyondViewport: false });
  return pageAsPdf;
}

declare global {
  interface Window {
    pasteBlobToElement: (
      blob: File,
      el: HTMLElement | null,
      fileName: string,
    ) => void;
  }
}

export async function typeText(page: Page, text: string) {
  await page.evaluate(async (text: string) => {
    const textarea = document.querySelector(".message-input-textarea");
    if (textarea == null) {
      throw new Error("textarea not found");
    }
    // textarea.focus();
    await new Promise<void>((resolve) => {
      setTimeout(() => {
        resolve();
      }, 100);
    });

    const dataTransfer = new DataTransfer();
    dataTransfer.setData("text/plain", text);
    const event = new ClipboardEvent("paste", {
      clipboardData: dataTransfer,
      bubbles: true,
      cancelable: true,
    });
    textarea.dispatchEvent(event);
  }, text);
}
// waits for upload completion and returns true if a new file appeared

export interface QwenFileTokenResponse {
  success: boolean;
  request_id: string;
  data: Data;
}

export interface Data {
  access_key_id: string;
  access_key_secret: string;
  security_token: string;
  file_url: string;
  file_path: string;
  file_id: string;
  bucketname: string;
  region: string;
  endpoint: string;
}

export async function waitForUploadResult(
  page: Page,
  previousCount: number,
  timeoutMs: number = 1000000,
): Promise<boolean> {
  const client = await page.target().createCDPSession();
  await client.send("Network.enable");

  const files: Record<string, QwenFileTokenResponse> = {};
  const completed: string[] = [];

  let cleanupDone = false;
  let responseListener: (params: any) => void;
  const cleanup = () => {
    if (cleanupDone) return;
    cleanupDone = true;
    console.log("completed------->");
    client.off("Network.responseReceived", responseListener);
    client.detach().catch(() => {});
  };

  return await new Promise<boolean>(async (resolve, reject) => {
    let timeoutId: NodeJS.Timeout;

    if (timeoutMs > 0) {
      timeoutId = setTimeout(() => {
        console.log(`Timeout after ${timeoutMs}ms`);
        cleanup();
        resolve(false);
      }, timeoutMs);
    }

    responseListener = async (params: any) => {
      const url = params.response.url;
      const status = params.response.status;
      const reponse = params.response;

      if (reponse) {
        const path = new URL(url).pathname;
        if (
          reponse.mimeType == "image/png" &&
          reponse.headers["Content-Disposition"] &&
          url === files[path]
        ) {
          cleanup();

          resolve(true);
        }
      }

      if (url.includes("getstsToken") && status === 200) {
        try {
          const getResponseBody = await client.send("Network.getResponseBody", {
            requestId: params.requestId,
          });

          const response: QwenFileTokenResponse = JSON.parse(
            getResponseBody.body,
          );
          const filePath = response.data.file_path;
          files[filePath] = response;
          console.log(url == response.data.file_url);
          console.log(`Tracking upload for: ${filePath}`);
        } catch (error) {
          console.error("Error:", error);
          cleanup();
          if (timeoutId) clearTimeout(timeoutId);
          resolve(false);
        }
      }
    };

    client.on("Network.responseReceived", responseListener);
  });
}

// return true if upload succeeded
export async function pastePrompts(page: Page): Promise<boolean> {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = dirname(__filename);

  // now paths are stable no matter where bun is run from
  const promptPath = join(__dirname, "../md/prompt.md");
  // read prompt from disk
  const prompt = await fs.readFile(promptPath, {
    encoding: "utf-8",
  });

  // count uploads BEFORE paste
  const previousUploadCount = await page.evaluate(() => {
    return document.querySelectorAll("file-card-list").length;
  });
  await page.addScriptTag({ content: pasteBlobToElement.toString() });
  await page.click("textarea");
  await page.type("textarea", "");

  // paste markdown blob into page
  await page.evaluate((promptContent: string) => {
    const blob = new Blob([promptContent], {
      type: "text/markdown",
    });
    const file = new File([blob], "instruction.md", { type: "text/markdown" });
    const textArea = document.querySelector("textarea");
    textArea?.focus();
    // assumes this helper is already injected on the page
    window.pasteBlobToElement(file, textArea, "prompt.md");
  }, prompt);

  // wait for upload result
  const uploadSucceeded = await waitForUploadResult(page, previousUploadCount);

  return uploadSucceeded;
}

type PassableData = {
  file: string;
  type: string;
  fileName: string;
};

export async function uploadFiles(page: Page, files: File[]) {
  // inject helper once
  await page.addScriptTag({
    content: pasteBlobToElement.toString(),
  });

  const parsedFiles: PassableData[] = [];

  // Node side: extract passable data
  for (const f of files) {
    const data = await f.arrayBuffer();

    const base64Image = Buffer.from(data).toBase64();
    parsedFiles.push({
      file: base64Image, // ArrayBuffer survives the boundary
      type: f.type,
      fileName: f.name,
    });
  }

  // Browser side: rebuild File objects and paste
  await page.evaluate((files: PassableData[]) => {
    const textarea = document.querySelector("textarea");
    textarea?.focus();

    for (const f of files) {
      const byteString = atob(f.file);
      const byteNumbers = new Array(byteString.length);

      for (let i = 0; i < byteString.length; i++) {
        byteNumbers[i] = byteString.charCodeAt(i);
      }

      const byteArray = new Uint8Array(byteNumbers);

      // Create a File object (can also use Blob if you don't need a filename)
      const file = new File([byteArray], f.fileName, { type: f.type });

      window.pasteBlobToElement(file, textarea, f.fileName);
    }
  }, parsedFiles);

  //const uploadSucceeded = await waitForUploadResult(page, files.length);
  //console.log("uploaded", uploadSucceeded);
  return true;
}
