import type { Page } from "puppeteer-core";
import { pasteBlobToElement } from "./utils";
import fs from "fs/promises";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
async function capturePageContentAsPdf(page: Page) {
  const pageAsPdf = await page.pdf({ displayHeaderFooter: false });
  return pageAsPdf;
}

async function capturePageContentImage(page: Page) {
  const pageAsPdf = await page.screenshot({ captureBeyondViewport: false });
  return pageAsPdf;
}

declare global {
  interface Window {
    pasteBlobToElement: (blob: Blob, el: HTMLElement,fileName:string) => void;
  }
}

export function typeText(page: Page, text: string) {
  page.type("textarea", text);
}
// waits for upload completion and returns true if a new file appeared
async function waitForUploadResult(
  page: Page,
  previousCount: number,
  timeoutMs = 60_000
): Promise<boolean> {
  return page.evaluate(
    async ({ previousCount, timeoutMs }) => {
      const start = Date.now();

      return await new Promise<boolean>((resolve) => {
        const interval = setInterval(() => {
          const spinner = document.querySelector(".vision-spinner");
          const currentCount =
            document.querySelectorAll("file-card-list").length;

          // spinner gone → upload finished
          if (!spinner) {
            clearInterval(interval);
            resolve(currentCount > previousCount);
            return;
          }

          // timeout → fail hard
          if (Date.now() - start > timeoutMs) {
            clearInterval(interval);
            resolve(false);
          }
        }, 500);
      });
    },
    { previousCount, timeoutMs }
  );
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
 await  page.addScriptTag({content:pasteBlobToElement.toString()})
  await  page.click('textarea')
 await  page.type('textarea','')

  // paste markdown blob into page
  await page.evaluate((promptContent: string) => {
    const blob = new Blob([promptContent], {
      type: "text/markdown",
    });
    document.querySelector('textarea')?.focus()
    // assumes this helper is already injected on the page
    window.pasteBlobToElement(blob, document.body,'prompt.md');
  }, prompt);

  // wait for upload result
  const uploadSucceeded = await waitForUploadResult(
    page,
    previousUploadCount
  );

  return uploadSucceeded;
}
