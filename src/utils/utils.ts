import { Browser, Page } from "puppeteer-core";
import { execSync, spawn } from "child_process";
import type { ElementHandle } from "puppeteer";
import { readFile } from "fs/promises";
import { json } from "express";
import type { QwenResponseChunk } from "../../types";
export async function processBody(body: ElementHandle<Element>) {
  const clickableElements = await body.$$(
    "button, a[href], [role=button], [onclick], input, select, textarea, label",
  );

  const actions = {} as Record<
    string,
    { info: Record<string, any>; element: ElementHandle<Element> }
  >;

  for (const element of clickableElements) {
    const actionId = crypto.randomUUID();

    // Pass the actionId into evaluate so it stays consistent
    const info = await element.evaluate((v, id) => {
      const style = window.getComputedStyle(v);
      const hidden =
        style.display === "none" ||
        style.visibility === "hidden" ||
        style.opacity === "0" ||
        v.offsetParent === null;
      if (hidden) return null;

      const obj: Record<string, any> = {
        id, // matches the record key
        label:
          v.innerText?.trim() ||
          v.value ||
          v.getAttribute("aria-label") ||
          v.getAttribute("placeholder") ||
          "",
        tag: v.tagName.toLowerCase(),
        type: v.getAttribute("type") || "",
        name: v.getAttribute("name") || "",
        role: v.getAttribute("role") || "",
        href: v.getAttribute("href") || "",
        disabled: v.hasAttribute("disabled"),
      };

      // Remove empty attributes
      Object.keys(obj).forEach((key) => {
        if (obj[key] === "" || obj[key] === null || obj[key] === undefined) {
          delete obj[key];
        }
      });

      return obj;
    }, actionId);

    if (info) {
      actions[actionId] = {
        info,
        element,
      };
    }
  }

  return actions;
}

export async function pasteBlobToElement(blob: File, element: Element) {
  try {
    if (!element) {
      console.warn("No element provided to dispatch paste to.");
      return;
    }

    // Create a DataTransfer object and add the file
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(blob);

    // Create the drop event
    const dropEvent = new DragEvent("drop", {
      bubbles: true,
      cancelable: true,
      // Set coordinates for the drop (center of element)
      clientX: element.getBoundingClientRect().left + element.clientWidth / 2,
      clientY: element.getBoundingClientRect().top + element.clientHeight / 2,
      dataTransfer: dataTransfer,
    });

    // Also dispatch dragenter and dragover events first (required for proper drop handling)
    const dragEnterEvent = new DragEvent("dragenter", {
      bubbles: true,
      cancelable: true,
      clientX: element.getBoundingClientRect().left + element.clientWidth / 2,
      clientY: element.getBoundingClientRect().top + element.clientHeight / 2,
      dataTransfer: dataTransfer,
    });

    const dragOverEvent = new DragEvent("dragover", {
      bubbles: true,
      cancelable: true,
      clientX: element.getBoundingClientRect().left + element.clientWidth / 2,
      clientY: element.getBoundingClientRect().top + element.clientHeight / 2,
      dataTransfer: dataTransfer,
    });

    // Dispatch the events in the correct sequence
    element.dispatchEvent(dragEnterEvent);
    element.dispatchEvent(dragOverEvent);
    element.dispatchEvent(dropEvent);

    console.log("Drop event dispatched to element:", element);
  } catch (err) {
    console.error("Failed to drop blob:", err);
  }
}
export async function observeChat(element: Element, delay = 1000) {
  await new Promise<void>((resolve, reject) => {
    setTimeout(() => {
      resolve();
    }, delay);
  });
  const userQuery = Array.from(element.querySelectorAll("[data-um-id]"));
  const last = userQuery.at(-1);

  const response = last?.nextElementSibling;
  if (response == undefined) {
    observeChat(element, delay + 1000);
    return;
  }

  const startAt = response.textContent.indexOf("@@@@START_ACTION");
  const endAt = response.textContent.indexOf("@@@@END_ACTION");
  if (endAt == -1 && startAt >= -1) {
    observeChat(element, delay + 1000);
  }

  const code = element.querySelector("code");
  if (code) {
    const parsedText = JSON.parse(code.textContent.trim());
    return parsedText;
  }
  console.log("conde not found");
}

export function toBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    // When reading finishes, resolve with base64 string (without the "data:*;base64," prefix)
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === "string") {
        // Strip the prefix if you only want the raw base64
        const base64 = result.split(",")[1];
        resolve(base64 || "");
      } else {
        reject(new Error("Unexpected result type from FileReader"));
      }
    };

    reader.onerror = (err) => reject(err);

    // Start reading as data URL
    reader.readAsDataURL(file);
  });
}

import { EventEmitter } from "events";

// Global emitter to handle chunks across different parts of the app
const networkEmitter = new EventEmitter();
const exposedPages = new Set<string>();

export async function listenToNetWork(
  page: Page,
  onChunk: (data: string, status: string, responseId: string) => void,
) {
  const pageId = page.mainFrame()._id;

  // 1. Subscribe the new callback to the emitter
  // Since we want this specific call to get chunks, we use a listener
  const handler = (data: string, status: string, responseId: string) => {
    onChunk(data, status, responseId);
  };

  networkEmitter.on("chunk", handler);

  // 2. Only expose the function once per page
  if (!exposedPages.has(pageId)) {
    exposedPages.add(pageId);

    // In case the page is closed, cleanup
    page.on("close", () => exposedPages.delete(pageId));

    try {
      await page.exposeFunction("onChunkResponse", (data: string) => {
        try {
          const dataArray = data
            .split("data:")
            .map((c) => c.trim())
            .filter((c) => c.length > 0);

          dataArray.forEach((chunkData) => {
            const chunk = JSON.parse(chunkData);
            if (!chunk.choices) return;

            for (const choice of chunk.choices) {
              if (choice.delta.phase !== "answer") continue;
              const id = chunk.response_id;
              const content = choice.delta.content || "";
              const status = choice.delta.status;

              // Emit to all active subscribers
              networkEmitter.emit("chunk", content, status, id);
            }
          });
        } catch (err) {
          console.error("Chunk parse error:", err);
        }
      });
    } catch (e) {
      // Function might already be exposed if page was reused in a way Set didn't catch
    }
  }

  // 3. Inject the interceptor (idempotent)
  await page.evaluate(() => {
    if ((window as any)._fetchIntercepted) return;
    (window as any)._fetchIntercepted = true;

    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      const res = await originalFetch(...args);
      const ct = res.headers.get("content-type") || "";

      if (ct.includes("text/event-stream") && res.body) {
        const [streamForYou, streamForPage] = res.body.tee();
        const reader = streamForYou.getReader();
        const decoder = new TextDecoder();

        (async () => {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunkString = decoder.decode(value, { stream: true });
            if ((window as any).onChunkResponse) {
              (window as any).onChunkResponse(chunkString);
            }
          }
        })();
        return new Response(streamForPage, {
          status: res.status,
          statusText: res.statusText,
          headers: res.headers,
        });
      }
      return res;
    };
  });

  // Return a cleanup function so the caller can stop listening
  return () => {
    networkEmitter.off("chunk", handler);
  };
}
