<template>
  <div
    class="flex flex-col rounded-lg px-4 py-3 max-w-[85%]"
    :class="containerClass"
  >
    <div class="text-xs font-semibold mb-1 opacity-70">
      {{ roleLabel }}
    </div>
    <div
      v-if="message.role === 'user'"
      class="whitespace-pre-wrap break-words"
    >
      {{ message.content }}
    </div>
    <div
      v-else
      class="markdown-body break-words"
      v-html="renderedContent"
    ></div>
    <div
      v-if="!message.done && message.role === 'assistant'"
      class="inline-block w-2 h-4 bg-blue-400 animate-pulse ml-0.5"
    ></div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import MarkdownIt from "markdown-it";
import hljs from "highlight.js";
import { useLocale } from "../composables/useLocale";
import type { ChatMessage } from "../composables/useChat";

const { t } = useLocale();

const props = defineProps<{
  message: ChatMessage;
}>();

const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true,
  highlight(str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch {
        // fall through
      }
    }
    return hljs.highlightAuto(str).value;
  },
});

const roleLabel = computed(() => {
  switch (props.message.role) {
    case "user":
      return t("chat.you");
    case "assistant":
      return t("chat.assistant");
    default:
      return t("chat.system");
  }
});

const containerClass = computed(() => {
  if (props.message.role === "user") {
    return "bg-blue-900/40 self-end text-gray-100";
  }
  return "bg-gray-800 self-start text-gray-100";
});

const renderedContent = computed(() => {
  return md.render(props.message.content || "");
});
</script>
