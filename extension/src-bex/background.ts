/**
 * Importing the file below initializes the extension background.
 *
 * Warnings:
 * 1. Do NOT remove the import statement below. It is required for the extension to work.
 *    If you don't need createBridge(), leave it as "import '#q-app/bex/background'".
 * 2. Do NOT import this file in multiple background scripts. Only in one!
 * 3. Import it in your background service worker (if available for your target browser).
 */
import { createBridge } from '#q-app/bex/background';
//import { getOpenedTabs } from './utils/tabs';
import type { MessagePayload } from '../../../types';
function openExtension() {
  void chrome.sidePanel.setOptions({
    path: 'index.html',
    enabled: true,
  });
}

chrome.runtime.onInstalled.addListener(() => {
  void chrome.sidePanel.setOptions({
    path: 'index.html',
    enabled: true,
  });
});
chrome.action.onClicked.addListener(openExtension);

declare module '@quasar/app-vite' {
  interface BexEventMap {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    log: [{ message: string; data?: any[] }, void];
    getTime: [never, number];
    'get-css': [string];
    sendMessage: [{ event: string; data: MessagePayload }];
    messageSent: [{ event: string; data: MessagePayload }];
    messageReceived: [
      {
        message: string;
        responseId: string;
      },
    ];
    'get-tab': [string?];
    'storage.set': [{ key: string; value: any }, void];
    'storage.remove': [string, void];
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }
}

/**
 * Call useBridge() to enable communication with the app & content scripts
 * (and between the app & content scripts), otherwise skip calling
 * useBridge() and use no bridge.
 */
const bridge = createBridge({ debug: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function broadcastMessage(payload: any) {
  for (const port of bridge.portList.filter((v) => v.includes('content'))) {
    void bridge.send({ event: 'messageSent', payload: payload, to: port });
  }
}
// function broadcastMessageReceived(payload: {
//   message: string;
//   status: string;
//   responseId: string;
// }) {
//   for (const port of bridge.portList.filter((v) => v.includes('content'))) {
//     console.log('sent');
//     void bridge.send({ event: 'messageReceived', payload: payload, to: port });
//   }
// }

let messages: MessagePayload[] = [];

bridge.on('sendMessage', ({ payload }) => {
  messages.push(payload.data);
  broadcastMessage(payload);
});

bridge.on('saveMessage', ({ payload }) => {
  messages = payload;
});
bridge.on('get-page-info', async () => {
  // Find the content script port to forward the request to
  const contentPort = bridge.portList.find((portName) => portName.startsWith('content@'));
  if (contentPort) {
    return await bridge.send({
      event: 'get-page-info',
      to: contentPort,
    });
  }
  return { url: 'Unknown', icon: '', title: '' };
});

bridge.on('getMessages', () => {
  return messages;
});

bridge.on('storage.get', ({ payload: key }) => {
  return new Promise((resolve) => {
    if (key === void 0) {
      chrome.storage.local.get(null, (items) => {
        // Group the values up into an array to take advantage of the bridge's chunk splitting.
        resolve(Object.values(items));
      });
    } else {
      chrome.storage.local.get([key], (items) => {
        resolve(items[key]);
      });
    }
  });
});
