<template>
  <div
    ref="scrollContainer"
    class="flex-1 overflow-y-auto px-4 py-6 space-y-4"
  >
    <div v-if="messages.length === 0" class="flex items-center justify-center h-full text-gray-500">
      <p class="text-lg">{{ t('chat.empty') }}</p>
    </div>
    <template v-for="msg in messages" :key="msg.id">
      <ChatMessage :message="msg" />
    </template>
    <template v-for="exec in toolExecutions" :key="exec.toolCallId">
      <ToolStatus :execution="exec" />
    </template>
    <div v-if="error" class="px-4 py-2 bg-red-900/30 text-red-300 rounded-lg text-sm">
      {{ t('error.prefix') }}: {{ error }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, nextTick } from "vue";
import ChatMessage from "./ChatMessage.vue";
import ToolStatus from "./ToolStatus.vue";
import { useLocale } from "../composables/useLocale";
import type { ChatMessage as ChatMessageType, ToolExecution } from "../composables/useChat";

const { t } = useLocale();

const props = defineProps<{
  messages: ChatMessageType[];
  toolExecutions: ToolExecution[];
  error: string | null;
}>();

const scrollContainer = ref<HTMLElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  });
}

watch(
  () => props.messages.map((m) => m.content).join(""),
  () => scrollToBottom()
);

watch(
  () => props.toolExecutions.length,
  () => scrollToBottom()
);
</script>
