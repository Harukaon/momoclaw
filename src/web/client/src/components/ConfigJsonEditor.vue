<template>
  <div class="space-y-4">
    <textarea
      v-model="jsonText"
      class="w-full h-96 bg-gray-800 text-gray-100 rounded-lg px-4 py-3 font-mono text-sm outline-none border resize-none"
      :class="parseError ? 'border-red-500' : 'border-gray-600 focus:ring-2 focus:ring-blue-500'"
      spellcheck="false"
    ></textarea>

    <div v-if="parseError" class="text-sm text-red-400">
      {{ t('config.invalid_json') }}: {{ parseError }}
    </div>

    <button
      class="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      :disabled="!!parseError || !jsonText.trim()"
      @click="save"
    >
      {{ t('config.save') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from "vue";
import { useLocale } from "../composables/useLocale";

const { t } = useLocale();

const props = defineProps<{
  config: any;
}>();

const emit = defineEmits<{
  save: [config: any];
}>();

const jsonText = ref("");

watch(
  () => props.config,
  (cfg) => {
    if (cfg) {
      jsonText.value = JSON.stringify(cfg, null, 2);
    }
  },
  { immediate: true }
);

const parseError = computed(() => {
  if (!jsonText.value.trim()) return null;
  try {
    JSON.parse(jsonText.value);
    return null;
  } catch (e) {
    return e instanceof Error ? e.message : String(e);
  }
});

function save() {
  try {
    const parsed = JSON.parse(jsonText.value);
    emit("save", parsed);
  } catch {
    // shouldn't happen since button is disabled
  }
}
</script>
