<template>
  <div class="flex items-center gap-2">
    <select
      :value="currentModel"
      :disabled="disabled"
      class="bg-gray-800 text-gray-300 text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-blue-500 border border-gray-600 disabled:opacity-50"
      @change="onChange"
    >
      <option v-for="m in models" :key="m" :value="m">
        {{ m }}
      </option>
    </select>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  models: string[];
  currentModel: string;
  disabled: boolean;
}>();

const emit = defineEmits<{
  change: [model: string];
}>();

function onChange(e: Event) {
  const select = e.target as HTMLSelectElement;
  emit("change", select.value);
}
</script>
