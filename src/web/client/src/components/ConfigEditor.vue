<template>
  <div class="flex-1 overflow-y-auto">
    <div class="max-w-2xl mx-auto p-6">
      <h2 class="text-xl font-bold text-gray-100 mb-4">{{ t('config.title') }}</h2>

      <!-- Mode tabs -->
      <div class="flex gap-2 mb-6">
        <button
          class="px-4 py-1.5 text-sm rounded-lg transition-colors"
          :class="mode === 'form' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
          @click="mode = 'form'"
        >
          {{ t('config.form_mode') }}
        </button>
        <button
          class="px-4 py-1.5 text-sm rounded-lg transition-colors"
          :class="mode === 'json' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'"
          @click="mode = 'json'"
        >
          {{ t('config.json_mode') }}
        </button>
      </div>

      <ConfigForm
        v-if="mode === 'form'"
        :config="config"
        @save="onSave"
      />
      <ConfigJsonEditor
        v-else
        :config="config"
        @save="onSave"
      />

      <div v-if="message" class="mt-4 px-4 py-2 rounded-lg text-sm" :class="messageClass">
        {{ message }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useLocale } from "../composables/useLocale";
import ConfigForm from "./ConfigForm.vue";
import ConfigJsonEditor from "./ConfigJsonEditor.vue";

const { t } = useLocale();

defineProps<{
  config: any;
}>();

const emit = defineEmits<{
  save: [config: any];
}>();

const mode = ref<"form" | "json">("form");
const message = ref("");
const messageClass = ref("");

function onSave(newConfig: any) {
  emit("save", newConfig);
}

defineExpose({
  showMessage(text: string, isError: boolean) {
    message.value = text;
    messageClass.value = isError
      ? "bg-red-900/30 text-red-300"
      : "bg-green-900/30 text-green-300";
    setTimeout(() => {
      message.value = "";
    }, 3000);
  },
});
</script>
