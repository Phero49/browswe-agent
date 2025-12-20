import { Browser, Page } from "puppeteer-core";
import { execSync, spawn } from "child_process";
import type { ElementHandle } from "puppeteer";
import { readFile } from "fs/promises";

export async function processBody(body: ElementHandle<Element>) {
  const clickableElements = await body.$$(
    "button, a[href], [role=button], [onclick], input, select, textarea, label"
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

export async function pasteBlobToElement(blob: Blob, element: Element, fileName = "file") {
  try {
    if (!element) {
      console.warn("No element provided to dispatch paste to.");
      return;
    }

    // 1. Create a DataTransfer container
    const dataTransfer = new DataTransfer();

    /**
     * 2. Wrap the Blob in a File object.
     * This is key: most web apps (like file uploaders or document editors) 
     * look for File objects in the 'items' list during a paste event.
     */
    const file = new File([blob], fileName, { type: blob.type });
    dataTransfer.items.add(file);

    /**
     * 3. Add text fallback.
     * If it's a text-based file (like .md or .txt), adding it to the 
     * string data ensures standard text inputs can also "see" the content.
     */
    if (blob.type.startsWith("text/")) {
      const text = await blob.text();
      dataTransfer.setData("text/plain", text);
    }

    // 4. Create and dispatch the event
    const pasteEvent = new ClipboardEvent("paste", {
      bubbles: true,
      cancelable: true,
      clipboardData: dataTransfer,
    });

    element.dispatchEvent(pasteEvent);
    console.log(`Dispatched paste for ${blob.type} (${blob.size} bytes)`);
  } catch (err) {
    console.error("General paste failed:", err);
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

export async function attachControlPanels(
  page: Page,
  index: number
): Promise<void> {
  const iframe = `<iframe src="" width="100",height="100" ></iframe>`;
  page.on("framenavigated", (frame) => {
    const page = frame.page()
    if (page) {
      addControls(page)
    }
    
    console.log()
  });

function addControls (page:Page) {
    page.$eval(
    "body",
    (el, index: number) => {
      const controls = el.querySelector("#control-panels");
      if (controls != null) {
        return
      }
      const div = document.createElement("div");
      div.setAttribute("tab-index", index.toString());
      div.id = "control-panels";
      div.style = `
  position: fixed;
  z-index: 99999;
  margin: 20px;padding:20px;
 bottom:4%;right:3%;`;
      div.style.margin = "20px";
      const iframe = document.createElement("iframe");
      iframe.frameBorder = '0px'
      iframe.style = "height:100px;position:relative;border:0px sold;";
      iframe.src = `http://localhost:33931/?tab-index=${index}`;
      iframe.style = "width:50px;height:50px;background:transparent";

      div.appendChild(iframe);
      // //const iframe =  new DOMParser().parseFromString( payload,'text/html')

      el.appendChild(div);

      // div2.outerHTML = payload
    },
    index
  );
}
addControls(page)
}

export function openControls(page: Page, index: number) {
  page.$eval(
    "body",
    (el, index) => {
      const iframe = el
        .querySelector("#control-panels")
        ?.querySelector("iframe");
      if (iframe) {
        const height = window.innerHeight * 0.8;
        iframe.style = `width:300px;height:${height}px;background:transparent`;
      }
    },
    index
  );
}
