<template>
  <div
    ref="scrollContainer"
    class="flex-1 overflow-y-auto px-4 py-6 space-y-4"
  >
    <div v-if="timeline.length === 0" class="flex items-center justify-center h-full text-gray-500">
      <p class="text-lg">{{ t('chat.empty') }}</p>
    </div>
    <template v-for="item in timeline" :key="itemKey(item)">
      <ChatMessage v-if="item.type === 'message' && !isEmptyMessage(item)" :message="item" />
      <ToolStatus v-else-if="item.type === 'tool'" :execution="item" @approve="(id, d) => $emit('approve', id, d)" />
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
import type { TimelineItem, ChatMessage as ChatMessageType } from "../composables/useChat";

const { t } = useLocale();

const props = defineProps<{
  timeline: TimelineItem[];
  error: string | null;
}>();

defineEmits<{
  approve: [toolCallId: string, decision: "allow" | "deny" | "always"];
}>();

/** Hide completed assistant messages with no content (only had thinking + toolCall) */
function isEmptyMessage(item: ChatMessageType): boolean {
  return item.role === "assistant" && item.done && !item.content;
}

function itemKey(item: TimelineItem): string {
  return item.type === "message" ? item.id : item.toolCallId;
}

const scrollContainer = ref<HTMLElement | null>(null);

function scrollToBottom() {
  nextTick(() => {
    if (scrollContainer.value) {
      scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
    }
  });
}

// Watch timeline length + last message content length for auto-scroll
watch(
  () => {
    const len = props.timeline.length;
    // Find the last message item for content-length tracking
    let lastContentLen = 0;
    for (let i = len - 1; i >= 0; i--) {
      const item = props.timeline[i];
      if (item.type === "message") {
        lastContentLen = item.content.length;
        break;
      }
    }
    return `${len}:${lastContentLen}`;
  },
  () => scrollToBottom()
);
</script>
