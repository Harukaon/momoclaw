<template>
  <select
    :value="locale"
    class="bg-gray-800 text-gray-300 text-sm rounded-lg px-2 py-1 outline-none border border-gray-600"
    @change="onChange"
  >
    <option value="en">English</option>
    <option value="zh-CN">中文</option>
  </select>
</template>

<script setup lang="ts">
import { useLocale } from "../composables/useLocale";
import type { Locale } from "../i18n";

const { locale, setLocale } = useLocale();

function onChange(e: Event) {
  const select = e.target as HTMLSelectElement;
  setLocale(select.value as Locale);
}
</script>
