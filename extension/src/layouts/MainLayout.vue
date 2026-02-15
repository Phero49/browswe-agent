<template>
  <q-layout view="lHh Lpr lFf" container style="width: 350px; height: 100vh">
    <q-header elevated>
      <q-toolbar>
        <q-avatar>
          <img src="icons/favicon-128x128.png" alt="" />
        </q-avatar>

        <q-toolbar-title>Ghost Tab </q-toolbar-title>
      </q-toolbar>
    </q-header>

    <q-drawer v-model="leftDrawerOpen" :show-if-above="false" bordered>
      <q-list>
        <q-item-label header> Settings </q-item-label>
        <q-item clickable v-ripple @click="toggleDarkMode">
          <q-item-section avatar>
            <q-icon name="dark_mode" />
          </q-item-section>
          <q-item-section> Dark Mode </q-item-section>
        </q-item>
      </q-list>
    </q-drawer>

    <q-footer class="bg-dark">
      <q-card class="my-card no-border-radius">
        <q-card-section>
          <q-input
            dense
            rounded
            outlined
            autogrow
            v-model="message"
            type="textarea"
            placeholder="Type your message..."
            @keydown.enter="handleSend"
          >
            <template #append>
              <q-btn
                color="primary"
                icon="send"
                dense
                flat
                @click="handleSend"
                :disabled="!message.trim()"
              />
            </template>
            <template #prepend>
              <q-btn dense round icon="add" flat>
                <q-menu>
                  <q-list class="text-capitalize" separator>
                    <q-item
                      clickable
                      :class="chatStore.mode == 'assistant' ? 'bg-primary' : 'grey-3'"
                      v-close-popup
                      @click="chatStore.toggleMode('assistant')"
                    >
                      <q-item-section>
                        <q-item-label>assistant mode</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      clickable
                      :class="chatStore.mode == 'agent' ? 'bg-primary' : 'grey-3'"
                      v-close-popup
                      @click="chatStore.toggleMode('agent')"
                    >
                      <q-item-section>
                        <q-item-label>agent mode</q-item-label>
                      </q-item-section>
                    </q-item>
                    <q-item
                      clickable
                      :class="chatStore.mode == 'agent' ? 'bg-primary' : 'grey-3'"
                      v-close-popup
                      @click="chatStore.toggleMode('agent')"
                    >
                      <q-item-section>
                        <q-item-label>capture screen</q-item-label>
                      </q-item-section>
                    </q-item>
                  </q-list>
                </q-menu>
              </q-btn>
            </template>
          </q-input>
        </q-card-section>
      </q-card>
    </q-footer>

    <q-page-container>
      <router-view />
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">
import { useChatStore } from 'src/stores/chatStore';
import { ref, onMounted } from 'vue';
import { useQuasar } from 'quasar';

const message = ref('');
const leftDrawerOpen = ref(false);
const chatStore = useChatStore();
const $q = useQuasar();

onMounted(() => {
  if ($q.bex) {
    void chatStore.init($q.bex);
  }
});

// function toggleLeftDrawer() {
//   leftDrawerOpen.value = !leftDrawerOpen.value;
// }

function handleSend() {
  if (message.value.trim() && $q.bex) {
    void chatStore.sendMessage($q.bex, message.value);
    message.value = '';
  }
}

function toggleDarkMode() {
  $q.dark.toggle();
}
</script>

<style scoped>
.no-border-radius {
  border-radius: 0;
}
</style>
