<template>
  <div class="flex gap-3 px-4 py-3 border-t border-gray-700 bg-gray-900">
    <textarea
      ref="textareaRef"
      v-model="text"
      :disabled="disabled"
      rows="1"
      class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-4 py-2.5 resize-none outline-none focus:ring-2 focus:ring-blue-500 placeholder-gray-500 disabled:opacity-50"
      :placeholder="t('chat.placeholder')"
      @keydown="onKeydown"
      @input="autoResize"
    ></textarea>
    <button
      :disabled="disabled || !text.trim()"
      class="px-4 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      @click="submit"
    >
      {{ t('chat.send') }}
    </button>
    <button
      v-if="isStreaming"
      class="px-4 py-2.5 bg-red-600 text-white rounded-lg font-medium hover:bg-red-500 transition-colors"
      @click="$emit('abort')"
    >
      {{ t('chat.stop') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useLocale } from "../composables/useLocale";

const { t } = useLocale();

defineProps<{
  disabled: boolean;
  isStreaming: boolean;
}>();

const emit = defineEmits<{
  send: [message: string];
  abort: [];
}>();

const text = ref("");
const textareaRef = ref<HTMLTextAreaElement | null>(null);

function submit() {
  const trimmed = text.value.trim();
  if (!trimmed) return;
  emit("send", trimmed);
  text.value = "";
  if (textareaRef.value) {
    textareaRef.value.style.height = "auto";
  }
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    submit();
  }
}

function autoResize() {
  const el = textareaRef.value;
  if (!el) return;
  el.style.height = "auto";
  el.style.height = Math.min(el.scrollHeight, 200) + "px";
}

onMounted(() => {
  textareaRef.value?.focus();
});
</script>
