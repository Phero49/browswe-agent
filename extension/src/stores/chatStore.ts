import { defineStore } from 'pinia';
import type { MessagePayload } from '../../../../types';
import type { BexBridge } from '@quasar/app-vite';
import { sendMessage } from '../../apiUtils';
import { processMarkdown } from 'app/src-bex/utils/helpers';

export interface ChatMessage {
  message: string;
  responseId?: string;
  status?: 'typing' | 'finished';
  user: boolean;
  timestamp: string;
  from?: string;
  icon?: string;
  url?: string;
}

export const useChatStore = defineStore('chat', {
  state: () => ({
    messages: [] as ChatMessage[],
    mode: null as null | 'agent' | 'assistant',
    frameId: '',
  }),

  actions: {
    async init(bridge: BexBridge) {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, 2000);
      });

      bridge.on('sendNewMessage', async ({ payload }) => {
        onMessageSent(payload);

        await sendMessage(
          'message-instruction',
          payload,
          (data: { data: string; status: string; responseId: string }) => {
            processMarkdown(data.data)
              .then((processedMessage) => {
                const i = this.messages.findLastIndex((v) => v.responseId === data.responseId);
                const msg = {
                  user: false,
                  message: processedMessage || '',
                  timestamp: new Date().toLocaleString(),
                  status: data.status as 'typing' | 'finished',
                  responseId: data.responseId,
                };

                if (i === -1) {
                  this.messages.push(msg);
                } else {
                  this.messages[i] = msg;
                }

                if (data.status == 'finished') {
                  void bridge.send({
                    event: 'saveMessage',
                    to: 'background',
                    payload: this.messages,
                  });
                }
              })
              .catch((err) => {
                console.log(err);
              });
          },
        );
      });
      bridge.on('messageReceived', ({ payload }) => {
        onmessageReceived(payload);
      });

      const onMessageSent = (data: MessagePayload) => {
        this.addMessage({
          message: data.message,
          user: data.user,
          timestamp: data.timestamp,
          from: data.from,
          icon: data.icon,
          status: 'finished',
        });
      };
      // Listen for message instructions sent from anyone (broadcast by background)

      // Listen for AI responses/chunks
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const onmessageReceived = (payload: any) => {
        this.updateAiMessage(payload);
      };

      // Load initial messages
      try {
        const initialMessages: MessagePayload[] = await bridge.send({
          event: 'getMessages',
          to: 'background',
        });

        if (initialMessages) {
          this.messages = initialMessages.map((m) => ({
            message: m.message,
            user: m.user,
            timestamp: m.timestamp,
            from: m.from,
            icon: m.icon,
            status: 'finished',
          }));
        }
      } catch (err) {
        console.error('Failed to load initial messages:', err);
      }
    },

    addMessage(msg: ChatMessage) {
      // Simple duplicate check based on content and timestamp
      const isDuplicate = this.messages.some(
        (m) => m.message === msg.message && m.timestamp === msg.timestamp && m.user === msg.user,
      );
      if (!isDuplicate) {
        this.messages.push(msg);
      }
    },

    updateAiMessage(payload: {
      message: string;
      responseId: string;
      status: 'typing' | 'finished';
    }) {
      const index = this.messages.findIndex((m) => m.responseId === payload.responseId);
      if (index === -1) {
        this.messages.push({
          message: payload.message,
          responseId: payload.responseId,
          status: payload.status,
          user: false,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        });
      } else {
        const msg = this.messages[index];
        if (msg) {
          msg.message = payload.message;
          msg.status = payload.status;
        }
      }
    },

    async sendMessage(bridge: BexBridge, text: string) {
      if (!bridge.isConnected) {
        await bridge.connectToBackground();
      }
      if (!text.trim()) return;

      const timestamp = new Date().toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
      });

      const msg: MessagePayload = {
        message: text,
        modes: this.mode,
        timestamp,
        user: true,
        from: ``,
        icon: '',
        tabId: this.frameId,
      };

      await bridge.send({
        event: 'sendMessage',
        to: 'background',
        payload: {
          event: 'message-instruction',
          data: msg,
        },
      });
    },

    toggleMode(mode: 'agent' | 'assistant') {
      this.mode = this.mode === mode ? null : mode;
    },
  },
});
