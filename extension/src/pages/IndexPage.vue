<template>
  <q-page class="chat-page q-pa-md">
    <div class="messages-list">
      <div
        v-for="(msg, index) in chatStore.messages"
        :key="index"
        :class="['message-wrapper', msg.user ? 'user-message' : 'assistant-message']"
      >
        <div class="message-content">
          <div v-if="!msg.user" class="assistant-container">
            <div class="message-text markdown" v-html="msg.message"></div>
            <div class="message-meta assistant-meta">
              <span class="time">{{ msg.timestamp }}</span>
              <q-spinner-dots v-if="msg.status === 'typing'" size="16px" />
            </div>
          </div>

          <div v-else class="message-bubble user-bubble">
            <div class="message-text">{{ msg.message }}</div>
            <div class="message-meta">
              <span class="time">{{ msg.timestamp }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div v-if="chatStore.messages.length === 0" class="empty-state">
      <q-icon name="forum" size="64px" color="grey-4" />
      <div class="text-grey-6 q-mt-md">You can talk to your qwen tab from here</div>
    </div>

    <div ref="scrollTarget" class="q-pa-xs"></div>
  </q-page>
</template>

<script setup lang="ts">
import { useChatStore } from 'src/stores/chatStore';
import { ref, watch, nextTick } from 'vue';

const chatStore = useChatStore();
const scrollTarget = ref<HTMLElement | null>(null);

// Auto-scroll to bottom when new messages arrive
watch(
  () => chatStore.messages.length,
  () => {
    void scrollToBottom();
  },
);

// Also scroll when message content updates (streaming)
watch(
  () => {
    const last = chatStore.messages[chatStore.messages.length - 1];
    return last ? last.message : '';
  },
  () => {
    void scrollToBottom();
  },
);

async function scrollToBottom() {
  await nextTick();
  if (scrollTarget.value) {
    scrollTarget.value.scrollIntoView({ behavior: 'smooth' });
  }
}
</script>

<style scoped>
/* Layout */
.messages-list {
  display: flex;
  flex-direction: column;
  gap: 24px; /* More space between open assistant text and user bubbles */
}

.message-wrapper {
  display: flex;
  width: 100%;
}

.user-message {
  justify-content: flex-end;
}

/* --- ASSISTANT STYLE (No Bubble) --- */
.assistant-message {
  justify-content: flex-start;
  border-left: 2px solid rgba(77, 204, 255, 0.3); /* Subtle accent line from logo's blue */
  padding-left: 16px;
}

.assistant-container {
  max-width: 100%;
  color: #e8eaed; /* Clean light text for dark mode */
}

/* --- USER BUBBLE STYLE (Ignis Glow) --- */
.user-bubble {
  max-width: 80%;
  padding: 12px 16px;
  border-radius: 18px 18px 4px 18px;
  /* Gradient from the logo ring */
  background: linear-gradient(135deg, #ff914d 0%, #fdbb2d 100%);
  color: #0f1721; /* Dark text on bright background for readability */
  font-weight: 500;
  box-shadow: 0 4px 15px rgba(255, 145, 77, 0.3); /* Soft orange glow */
}

.message-text {
  word-wrap: break-word;
  line-height: 1.6;
  font-size: 0.9rem;
}

/* Meta info (Time/Status) */
.message-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 0.7rem;
  margin-top: 6px;
  opacity: 0.7;
}

.assistant-meta {
  color: var(--secondary); /* Using the logo's blue for meta info */
}

/* Markdown spacing */
:deep(.markdown p) {
  margin-bottom: 12px;
}

.glow-icon {
  filter: drop-shadow(0 0 10px var(--q-primary));
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 60vh;
}
</style>
