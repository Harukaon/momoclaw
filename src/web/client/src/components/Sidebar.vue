<template>
  <aside class="w-64 flex flex-col border-r border-gray-700 bg-gray-900/50">
    <div class="p-3 border-b border-gray-700">
      <button
        class="w-full px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors"
        @click="$emit('newChat')"
      >
        {{ t('chat.new') }}
      </button>
    </div>

    <div class="flex-1 overflow-y-auto">
      <div v-if="sessions.length === 0" class="p-4 text-gray-500 text-sm text-center">
        {{ t('history.empty') }}
      </div>
      <div
        v-for="s in sessions"
        :key="s.id"
        class="group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors text-sm"
        :class="{ 'bg-gray-800': s.id === currentSessionId }"
        @click="$emit('switchSession', s.id)"
      >
        <div class="flex-1 min-w-0">
          <div v-if="editingId === s.id" class="flex gap-1">
            <input
              v-model="editTitle"
              class="flex-1 bg-gray-700 text-gray-100 text-sm rounded px-2 py-0.5 outline-none"
              @keydown.enter="commitRename(s.id)"
              @keydown.escape="editingId = null"
              @click.stop
            />
          </div>
          <div v-else class="truncate text-gray-300" :title="s.title">
            {{ s.title }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">
            {{ formatDate(s.updatedAt) }}
          </div>
        </div>
        <div class="hidden group-hover:flex items-center gap-1" @click.stop>
          <button
            class="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            :title="t('history.rename')"
            @click="startRename(s)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            class="p-1 text-gray-500 hover:text-red-400 transition-colors"
            :title="t('history.delete')"
            @click="onDelete(s.id)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useLocale } from "../composables/useLocale";
import type { SessionSummary } from "../composables/useHistory";

const { t } = useLocale();

defineProps<{
  sessions: SessionSummary[];
  currentSessionId: string | null;
}>();

const emit = defineEmits<{
  newChat: [];
  switchSession: [id: string];
  delete: [id: string];
  rename: [id: string, title: string];
}>();

const editingId = ref<string | null>(null);
const editTitle = ref("");

function startRename(s: SessionSummary) {
  editingId.value = s.id;
  editTitle.value = s.title;
}

function commitRename(id: string) {
  const title = editTitle.value.trim();
  if (title) {
    emit("rename", id, title);
  }
  editingId.value = null;
}

function onDelete(id: string) {
  if (confirm(t("history.delete_confirm"))) {
    emit("delete", id);
  }
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
</script>
