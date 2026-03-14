<template>
  <aside class="w-64 flex flex-col border-r border-gray-700 bg-gray-900/50">
    <!-- Header: New Sub-Agent -->
    <div class="flex items-center justify-end px-3 py-2.5 border-b border-gray-700">
      <button
        class="p-1.5 text-gray-400 hover:text-white hover:bg-gray-700 rounded-md transition-colors"
        :title="t('sidebar.new_sub_agent')"
        @click="$emit('newChat')"
      >
        <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <!-- Session list (scrollable) -->
    <div class="flex-1 overflow-y-auto">
      <!-- Main Agent (always first, same style as sub-agents, no delete) -->
      <div
        v-if="mainSession"
        class="group flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-800 transition-colors text-sm"
        :class="{ 'bg-gray-800': mainSession.id === currentSessionId }"
        @click="$emit('switchSession', mainSession.id)"
      >
        <div class="flex-1 min-w-0">
          <div v-if="editingId === mainSession.id" class="flex gap-1">
            <input
              v-model="editTitle"
              class="flex-1 bg-gray-700 text-gray-100 text-sm rounded px-2 py-0.5 outline-none"
              @keydown.enter="commitRename(mainSession.id)"
              @keydown.escape="editingId = null"
              @click.stop
            />
          </div>
          <div v-else class="truncate text-gray-300 flex items-center gap-1.5" :title="mainSession.title || t('sidebar.main_agent')">
            <span v-if="streamingSessions?.includes(mainSession.id)" class="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0"></span>
            {{ mainSession.title || t('sidebar.main_agent') }}
          </div>
          <div class="text-xs text-gray-500 mt-0.5">
            {{ formatDate(mainSession.updatedAt) }}
          </div>
        </div>
        <div class="hidden group-hover:flex items-center gap-1" @click.stop>
          <button
            class="p-1 text-gray-500 hover:text-blue-400 transition-colors"
            :title="t('sidebar.new_main_chat')"
            @click="$emit('newMainChat')"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button
            class="p-1 text-gray-500 hover:text-gray-300 transition-colors"
            :title="t('history.rename')"
            @click="startRename(mainSession)"
          >
            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Sub-Agents -->
      <div v-if="sessions.length === 0 && !mainSession" class="p-4 text-gray-500 text-sm text-center">
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
          <div v-else class="truncate text-gray-300 flex items-center gap-1.5" :title="s.title">
            <span v-if="streamingSessions?.includes(s.id)" class="inline-block w-2 h-2 rounded-full bg-blue-400 animate-pulse flex-shrink-0"></span>
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
  mainSession: SessionSummary | null;
  sessions: SessionSummary[];
  currentSessionId: string | null;
  streamingSessions?: string[];
}>();

const emit = defineEmits<{
  newChat: [];
  newMainChat: [];
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
