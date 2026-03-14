<template>
  <div
    class="flex items-center gap-2 px-4 py-2 text-sm rounded-lg"
    :class="statusClass"
  >
    <div v-if="execution.status === 'running'" class="flex items-center gap-2">
      <svg class="animate-spin h-4 w-4" viewBox="0 0 24 24">
        <circle
          class="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          stroke-width="4"
          fill="none"
        />
        <path
          class="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>{{ t('tool.running') }} <strong>{{ execution.toolName }}</strong>...</span>
    </div>
    <div v-else-if="execution.status === 'awaiting_approval'" class="flex flex-col gap-2 w-full">
      <div class="flex items-center gap-2">
        <svg class="h-4 w-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
        <span>{{ t('approval.prompt') }} <code class="bg-gray-800 px-1.5 py-0.5 rounded text-xs">{{ execution.command }}</code></span>
      </div>
      <div class="flex gap-2 ml-6">
        <button
          class="px-3 py-1 text-xs rounded bg-green-700 hover:bg-green-600 text-white transition-colors"
          @click="$emit('approve', execution.toolCallId, 'allow')"
        >{{ t('approval.allow') }}</button>
        <button
          class="px-3 py-1 text-xs rounded bg-blue-700 hover:bg-blue-600 text-white transition-colors"
          @click="$emit('approve', execution.toolCallId, 'always')"
        >{{ t('approval.always') }}</button>
        <button
          class="px-3 py-1 text-xs rounded bg-red-700 hover:bg-red-600 text-white transition-colors"
          @click="$emit('approve', execution.toolCallId, 'deny')"
        >{{ t('approval.deny') }}</button>
      </div>
    </div>
    <div v-else-if="execution.status === 'done'" class="flex items-center gap-2">
      <svg class="h-4 w-4 text-green-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
      </svg>
      <span><strong>{{ execution.toolName }}</strong> {{ t('tool.done') }}</span>
    </div>
    <div v-else class="flex items-center gap-2">
      <svg class="h-4 w-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
      </svg>
      <span><strong>{{ execution.toolName }}</strong> {{ t('tool.error') }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useLocale } from "../composables/useLocale";
import type { ToolExecution } from "../composables/useChat";

const { t } = useLocale();

const props = defineProps<{
  execution: ToolExecution;
}>();

defineEmits<{
  approve: [toolCallId: string, decision: "allow" | "deny" | "always"];
}>();

const statusClass = computed(() => {
  switch (props.execution.status) {
    case "running":
      return "bg-gray-700/50 text-blue-300";
    case "awaiting_approval":
      return "bg-amber-900/30 text-amber-300 border border-amber-700/50";
    case "done":
      return "bg-gray-700/50 text-green-300";
    case "error":
      return "bg-red-900/30 text-red-300";
    default:
      return "";
  }
});
</script>
