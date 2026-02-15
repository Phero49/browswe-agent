import type { MessagePayload } from '../../../../types';
import useIcon from './icons';
import type { BexBridge } from '@quasar/app-vite';

const host = document.createElement('div');
host.id = 'agent-control-dom';
document.documentElement.appendChild(host);
const showDom = host.attachShadow({ mode: 'open' });
const aiControls = document.createElement('div');
const messageContainer = document.createElement('div');

let showControls = false;
let assistantMode = true;
let agentMode = false;
let bridge: BexBridge | null = null;
async function sendMessage(event: string, payload: MessagePayload) {
  if (!bridge) {
    return;
  }
  await bridge.send({
    event: 'sendMessage',
    to: 'background',
    payload: {
      event: event,
      data: payload,
    },
  });
}

function fabButton() {
  const button = document.createElement('button');
  button.innerHTML = useIcon({ color: 'inherit', name: 'star', size: 16 });
  button.classList.add('star-btn');

  aiControls.classList.add('ai-controls');
  aiControls.appendChild(button);
  showDom.appendChild(aiControls);
  button.addEventListener('click', () => {
    showControls = !showControls;
    button.style.display = !showControls ? 'block' : 'none';
    if (showControls) {
      addControlsPanel();
    }
  });
}

export async function initControlPanelUi(b: BexBridge) {
  bridge = b;

  const css = await bridge.send({ event: 'get-css', to: 'background' });
  bridge.on('messageReceived', ({ payload }) => {
    onMessageReceived(payload);
  });
  bridge.on('messageSent', ({ payload }) => {
    const data = payload.data as MessagePayload;

    onMessage(data.message);
  });
  const style = document.createElement('style');
  style.textContent = css;
  showDom.appendChild(style);
  fabButton();
  console.log('add fab controls');
}

export function addControlsPanel() {
  const container = document.createElement('div');
  container.classList.add('prompt-area');

  // Create header with title and close button
  const header = document.createElement('div');
  header.classList.add('prompt-header');

  const title = document.createElement('h3');
  title.textContent = 'Chat';
  title.classList.add('prompt-title');

  header.appendChild(title);
  container.appendChild(header);

  createActionsButtons(header, [
    {
      click: (e) => {
        assistantMode = !assistantMode;
        if (assistantMode) {
          (e.target as HTMLElement).classList.add('agent-active-btn');
        } else {
          (e.target as HTMLElement).classList.remove('agent-active-btn');
        }
      },
      icon: useIcon({ name: 'assistant', size: 24 }),
      label:
        "assistant mode: the ai can see your screen you can ask about it talk about it but it doesn't take action ",
      size: 24,
    },
    {
      click: (e) => {
        agentMode = !agentMode;
        if (assistantMode) {
          (e.target as HTMLElement).classList.add('agent-active-btn');
        } else {
          (e.target as HTMLElement).classList.remove('agent-active-btn');
        }
      },
      icon: useIcon({ name: 'agent', size: 24 }),
      label: 'agent mode:the ai do things on your behalf like writing a comment',
      size: 15,
    },

    {
      click: () => {
        closeControls(container);
      },
      icon: useIcon({ name: 'close', size: 16 }),
      label: '',
      size: 15,
    },
  ]);

  // Create message container
  messageContainer.classList.add('messages-container');
  container.appendChild(messageContainer);

  // Create input area
  const inputArea = document.createElement('div');
  inputArea.classList.add('input-area');
  const bottomInputArea = document.createElement('div');
  bottomInputArea.classList.add('bottom-input-area');

  const textArea = document.createElement('textarea');
  textArea.classList.add('prompt-input');
  textArea.placeholder = 'Type your message here...';
  textArea.rows = 1;
  const sendButton = document.createElement('button');
  bottomInputArea.appendChild(sendButton);
  sendButton.classList.add('send-button');
  sendButton.type = 'button';
  sendButton.innerHTML = useIcon({ color: 'inherit', name: 'send', size: 16 });
  sendButton.setAttribute('aria-label', 'Send message');

  // Send button functionality
  sendButton.addEventListener('click', () => {
    const message = textArea.value.trim();
    if (message) {
      void addMessageToChat(message);
      textArea.value = '';
      textArea.focus();
      autoResize(textArea);
      updateSendButton();
    }
  });

  // Add Enter key support
  textArea.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendButton.click();
    }
  });

  // Auto-resize textarea
  function autoResize(element: HTMLTextAreaElement) {
    element.style.height = 'auto';
    element.style.height = Math.min(element.scrollHeight, 120) + 'px';
  }

  textArea.addEventListener('input', () => {
    autoResize(textArea);
    updateSendButton();
  });

  // Update button state
  function updateSendButton() {
    const hasText = textArea.value.trim().length > 0;
    sendButton.disabled = !hasText;
    sendButton.classList.toggle('active', hasText);
  }

  updateSendButton();
  bottomInputArea.appendChild(inputArea);

  inputArea.appendChild(textArea);
  inputArea.appendChild(sendButton);
  container.appendChild(bottomInputArea);

  // Add to document
  showDom.appendChild(container);

  // Auto-focus the textarea
  // eslint-disable-next-line @typescript-eslint/no-misused-promises
  setTimeout(async () => {
    const messages: MessagePayload[] = await bridge?.send({
      event: 'getMessages',
      to: 'background',
    });
    messageContainer.innerHTML = '';
    messages.forEach((m) => {
      onMessage(m.message);
    });
    textArea.focus();
  }, 100);

  return container;
}

function onMessage(message: string) {
  const messageElement = document.createElement('div');
  messageElement.classList.add('message', 'user-message');
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
  messageElement.innerHTML = `
        <div class="message-content">${message}</div>
        <div class="message-time">${timestamp}</div>
    `;

  messageContainer.appendChild(messageElement);
  messageContainer.scrollTop = messageContainer.scrollHeight;
}

function onMessageReceived(data: {
  message: string;
  responseId: string;
  status: 'typing' | 'finished';
}) {
  const id = data.responseId;
  const idPrefix = 'message-response-';
  const el = messageContainer.querySelector<HTMLElement>(`#${idPrefix}${id}`);

  if (!el) {
    const assistantMessage = document.createElement('div');

    assistantMessage.id = idPrefix + id;
    assistantMessage.classList.add('assistant-message');
    assistantMessage.setAttribute('role', 'ai-response-block');

    if (data.status === 'typing') {
      assistantMessage.classList.add('streaming');
    }

    assistantMessage.innerHTML = data.message;
    messageContainer.appendChild(assistantMessage);
  } else {
    if (data.status === 'typing') {
      el.classList.add('streaming');
    } else {
      el.classList.remove('streaming');
    }

    el.innerHTML = data.message;
  }

  messageContainer.scrollTop = messageContainer.scrollHeight;
}

// Helper function to add messages
async function addMessageToChat(message: string) {
  const timestamp = new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });

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

  const id = Date.now().toString();
  document.body.setAttribute('tab-id', id);
  const msg: MessagePayload = {
    message: message,
    modes: 'assistant',
    tabId: id,

    timestamp,
    user: true,
    from: `${window.location.origin}|${document.title}`,
    icon: getPageIcon(),
  };

  await sendMessage('message-instruction', msg);
}

type ActionListItem = {
  label: string | null;
  click: (e: Event) => void;
  icon: string;
  size: number;
};

function createActionsButtons(parent: HTMLDivElement, items: ActionListItem[]) {
  const actionContainer = document.createElement('div');
  actionContainer.classList.add('action-btn');

  items.forEach((item) => {
    const btn = document.createElement('button');
    btn.classList.add('agent-action-btn');
    btn.type = 'button';
    btn.innerHTML = item.icon;
    btn.setAttribute('aria-label', item.label || '');
    btn.addEventListener('click', item.click);
    btn.addEventListener('mouseover', () => {
      createToolTip(btn, item.label || '');
    });
    actionContainer.appendChild(btn);
  });
  parent.appendChild(actionContainer);
}

function closeControls(container: HTMLDivElement) {
  container.classList.add('closing');
  setTimeout(() => {
    if (container.parentNode) {
      showControls = true;
      container.parentNode.removeChild(container);
      fabButton();
    }
  }, 300);
}

function createToolTip(target: HTMLElement, label: string) {
  const div = document.createElement('div');
  div.classList.add('agent-tooltip');
  div.textContent = label;
  target.appendChild(div);
  target.addEventListener('mouseleave', () => {
    target.querySelector('.agent-tooltip')?.remove();
  });
}

// /**
//
//  *@param e  - current click event
//
//  * @param toggleFunction  - a function that return the inner html to change to
//  */
// function toggleButtonOnclick(e: Event, toggleFunction: () => string) {
//   const b = e.target as HTMLButtonElement;
//   b.innerHTML = toggleFunction();
// }
