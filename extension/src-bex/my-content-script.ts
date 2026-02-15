/* eslint-disable @typescript-eslint/no-explicit-any */
// /**
//  * Importing the file below initializes the content script.
//  *
//  * Warning:
//  *   Do not remove the import statement below. It is required for the extension to work.
//  *   If you don't need createBridge(), leave it as "import '#q-app/bex/content'".
//  */
import { createBridge } from '#q-app/bex/content';
import type { MessagePayload } from '../../../types';

const bridge = createBridge({ debug: false });
void bridge.connectToBackground();

// const iFrame = document.createElement('iframe');
// const defaultFrameHeight = '100%';

// /**
//  * Set the height of our iFrame housing our BEX
//  * @param height
//  */
// function setIFrameHeight(height: string) {
//   iFrame.height = height;
// }

// /**
//  * Reset the iFrame to its default height e.g The height of the top bar.
//  */
// function resetIFrameHeight() {
//   setIFrameHeight(defaultFrameHeight);
// }

// /**
//  * The code below will get everything going. Initialize the iFrame with defaults and add it to the page.
//  * @type {string}
//  */
// iFrame.id = 'bex-app-iframe';
// iFrame.width = '350px';
const uuid = crypto.randomUUID();
document.body.setAttribute('tab-id', uuid);
// resetIFrameHeight();

// // Assign some styling so it looks seamless
// Object.assign(iFrame.style, {
//   position: 'fixed',
//   top: '0',
//   right: '0',
//   bottom: '0',
//   border: '0',
//   zIndex: '9999999', // Make sure it's on top
//   overflow: 'visible',
// });
// void (async function () {
//   await bridge.connectToBackground();
//   // When the page loads, insert our browser extension app.
//   iFrame.src = chrome.runtime.getURL('www/index.html');
//   document.body.prepend(iFrame);
//   setTimeout(() => {
//     sendIframeMessage('onId', uuid);
//   }, 3000);
// })();

function getPageIcon() {
  // Common favicon declarations
  const selectors = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];

  for (const selector of selectors) {
    const link = document.querySelector<HTMLLinkElement>(selector);
    if (link?.href) {
      return link.href;
    }
  }

  // Fallback: default /favicon.ico
  return `${window.location.origin}/favicon.ico`;
}

bridge.on('messageSent', ({ payload }) => {
  const data = payload.data as MessagePayload;
  if (document.visibilityState === 'visible') {
    void bridge.send({
      to: 'app',
      event: 'sendNewMessage',
      payload: {
        ...data,
        tabId: uuid,
        from: `${window.location.origin}|${document.title}`,
        icon: getPageIcon(),
        url: window.location.href,
      },
    });
  }
});
