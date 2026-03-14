<template>
  <div class="h-screen flex bg-gray-900 text-gray-100">
    <!-- Sidebar -->
    <Sidebar
      :main-session="history.mainSession.value"
      :sessions="history.subSessions.value"
      :current-session-id="session.sessionId.value"
      :streaming-sessions="streamingSessionIds"
      @new-chat="newSubAgent"
      @switch-session="switchSession"
      @delete="onDeleteSession"
      @rename="onRenameSession"
    />

    <!-- Main content -->
    <div class="flex-1 flex flex-col min-w-0">
      <!-- Header -->
      <header class="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gray-900/80 backdrop-blur">
        <h1 class="text-lg font-bold text-blue-400">My Assistant</h1>
        <div class="flex items-center gap-3">
          <LocaleSwitch />
          <ModelSelect
            v-if="!showConfig"
            :models="models"
            :current-model="currentModel"
            :disabled="chat.isStreaming.value"
            @change="onModelChange"
          />
          <button
            class="text-sm px-3 py-1 rounded-lg transition-colors"
            :class="showConfig ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-gray-200'"
            @click="showConfig = !showConfig"
          >
            {{ t('config.title') }}
          </button>
        </div>
      </header>

      <!-- Config editor -->
      <template v-if="showConfig">
        <ConfigEditor
          ref="configEditorRef"
          :config="configData.config.value"
          @save="onConfigSave"
        />
      </template>

      <!-- Chat area -->
      <template v-else>
        <ChatView
          :messages="chat.messages.value"
          :tool-executions="chat.toolExecutions.value"
          :error="chat.error.value"
          @approve="onApprove"
        />
        <InputBox
          :disabled="!session.sessionId.value || chat.isStreaming.value"
          :is-streaming="chat.isStreaming.value"
          @send="onSend"
          @abort="onAbort"
        />
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import ChatView from "./components/ChatView.vue";
import InputBox from "./components/InputBox.vue";
import ModelSelect from "./components/ModelSelect.vue";
import Sidebar from "./components/Sidebar.vue";
import LocaleSwitch from "./components/LocaleSwitch.vue";
import ConfigEditor from "./components/ConfigEditor.vue";
import { useSession } from "./composables/useSession";
import { useChat } from "./composables/useChat";
import { useHistory } from "./composables/useHistory";
import { useConfig } from "./composables/useConfig";
import { useLocale } from "./composables/useLocale";
import { setLocale } from "./i18n";
import type { Locale } from "./i18n";

const session = useSession();
const chat = useChat();
const history = useHistory();
const configData = useConfig();
const { t } = useLocale();

const models = ref<string[]>([]);
const currentModel = ref("");
const showConfig = ref(false);
const configEditorRef = ref<InstanceType<typeof ConfigEditor> | null>(null);

/** IDs of sessions that are currently streaming (for sidebar indicators) */
const streamingSessionIds = computed(() => {
  const ids: string[] = [];
  for (const s of history.sessions.value) {
    if (chat.isSessionStreaming(s.id)) {
      ids.push(s.id);
    }
  }
  return ids;
});

async function fetchModels() {
  try {
    const res = await fetch("/api/models");
    const data = await res.json();
    models.value = data.models;
  } catch {
    // will retry on next interaction
  }
}

async function loadAndActivateSession(id: string): Promise<boolean> {
  const data = await session.loadSession(id);
  if (!data) return false;

  chat.setActiveSession(id);
  currentModel.value = session.sessionModel.value;

  if (data.messages) {
    chat.restoreMessages(id, data.messages, data.isStreaming);
  }
  return true;
}

async function initSession() {
  // Always ensure the main session exists first
  const mainId = await session.ensureMainSession();

  const hash = window.location.hash.slice(1);
  if (hash) {
    const ok = await loadAndActivateSession(hash);
    if (ok) return;
  }

  // Default to main agent
  await loadAndActivateSession(mainId);
  window.location.hash = mainId;
}

async function newSubAgent() {
  const id = await session.createSubAgent();
  window.location.hash = id;
  chat.setActiveSession(id);
  chat.clearSession(id);
  if (models.value.length > 0 && !currentModel.value) {
    currentModel.value = models.value[0];
  }
  history.fetchSessions();
}

async function switchSession(id: string) {
  // Don't reload if already active
  if (session.sessionId.value === id) return;

  // Check if we already have state for this session
  const existing = chat.sessionStates[id];
  if (existing && existing.messages.length > 0) {
    // Already loaded — just switch view
    session.setSessionId(id);
    chat.setActiveSession(id);
    window.location.hash = id;
    return;
  }

  // Load from backend
  await loadAndActivateSession(id);
  window.location.hash = id;
}

async function onDeleteSession(id: string) {
  // Protect main agent on the frontend side
  if (session.isMainSession(id)) return;

  await history.deleteSession(id);
  chat.removeSession(id);
  if (session.sessionId.value === id) {
    // Switch back to main agent
    const mainId = session.mainSessionId.value;
    if (mainId) {
      await loadAndActivateSession(mainId);
      window.location.hash = mainId;
    }
  }
}

async function onRenameSession(id: string, title: string) {
  await history.renameSession(id, title);
}

async function onSend(message: string) {
  const sid = session.sessionId.value;
  if (!sid) return;
  await chat.sendMessage(sid, message);
}

async function onAbort() {
  const sid = session.sessionId.value;
  if (!sid) return;
  await chat.abortStream(sid);
}

async function onApprove(toolCallId: string, decision: "allow" | "deny" | "always") {
  const sid = session.sessionId.value;
  if (!sid) return;
  await chat.approveToolCall(sid, toolCallId, decision);
}

async function onModelChange(model: string) {
  const sid = session.sessionId.value;
  if (!sid) return;
  await chat.switchModel(sid, model);
  currentModel.value = model;
}

async function onConfigSave(newConfig: any) {
  const result = await configData.saveConfig(newConfig);
  if (result.ok) {
    configEditorRef.value?.showMessage(t("config.saved"), false);
    // Apply locale change immediately
    if (newConfig.locale) {
      setLocale(newConfig.locale as Locale);
    }
    // Re-fetch models in case provider changed
    await fetchModels();
  } else {
    configEditorRef.value?.showMessage(
      `${t("config.validation_error")}: ${(result.errors ?? []).join("; ")}`,
      true
    );
  }
}

onMounted(async () => {
  // Load initial locale from config
  await configData.fetchConfig();
  if (configData.config.value?.locale) {
    setLocale(configData.config.value.locale as Locale);
  }

  await fetchModels();
  await initSession();
  await history.fetchSessions();

  // Refresh session list when any agent finishes
  chat.onAgentEnd(() => {
    history.fetchSessions();
  });
});
</script>
