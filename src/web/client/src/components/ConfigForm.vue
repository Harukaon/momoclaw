<template>
  <div class="space-y-6">
    <!-- General settings -->
    <div class="space-y-4">
      <!-- Active Provider -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">{{ t('config.active_provider') }}</label>
        <select
          v-model="form.activeProvider"
          class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-600 focus:ring-2 focus:ring-blue-500"
        >
          <option v-for="name in providerNames" :key="name" :value="name">{{ name }}</option>
        </select>
      </div>

      <!-- Default Model -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">{{ t('config.default_model') }}</label>
        <input
          v-model="form.defaultModel"
          class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-600 focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <!-- System Prompt -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">{{ t('config.system_prompt') }}</label>
        <textarea
          v-model="form.systemPrompt"
          rows="3"
          class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-600 focus:ring-2 focus:ring-blue-500 resize-none"
        ></textarea>
      </div>

      <!-- Locale -->
      <div>
        <label class="block text-sm font-medium text-gray-300 mb-1">{{ t('config.locale') }}</label>
        <select
          v-model="form.locale"
          class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 outline-none border border-gray-600 focus:ring-2 focus:ring-blue-500"
        >
          <option value="en">English</option>
          <option value="zh-CN">中文</option>
        </select>
      </div>
    </div>

    <!-- Provider cards -->
    <div class="space-y-4">
      <h3 class="text-sm font-semibold text-gray-400 uppercase tracking-wide">{{ t('config.provider') }}</h3>

      <div
        v-for="pName in providerNames"
        :key="pName"
        class="border border-gray-700 rounded-lg p-4 space-y-3"
      >
        <div class="flex items-center justify-between">
          <h4 class="font-medium text-gray-200">{{ pName }}</h4>
          <button
            class="text-sm text-red-400 hover:text-red-300 transition-colors"
            @click="removeProvider(pName)"
          >
            {{ t('config.remove_provider') }}
          </button>
        </div>

        <!-- API Type -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">{{ t('config.api_type') }}</label>
          <select
            v-model="form.providers[pName].api"
            class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
          >
            <option v-for="api in knownApiTypes" :key="api" :value="api">{{ api }}</option>
          </select>
        </div>

        <!-- Base URL -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">{{ t('config.base_url') }}</label>
          <input
            v-model="form.providers[pName].baseUrl"
            class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
            placeholder="https://api.example.com"
          />
        </div>

        <!-- API Key -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">{{ t('config.api_key') }}</label>
          <div class="flex gap-2">
            <input
              v-model="form.providers[pName].apiKey"
              :type="showKeys[pName] ? 'text' : 'password'"
              class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
            />
            <button
              class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
              @click="showKeys[pName] = !showKeys[pName]"
            >
              {{ showKeys[pName] ? '🔒' : '👁' }}
            </button>
          </div>
        </div>
      </div>

      <!-- Add provider -->
      <div class="flex gap-2">
        <select
          v-model="newProviderName"
          class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
        >
          <option value="" disabled>{{ t('config.provider_name') }}</option>
          <option
            v-for="p in availableProviderSuggestions"
            :key="p"
            :value="p"
          >
            {{ p }}
          </option>
        </select>
        <button
          class="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          :disabled="!newProviderName"
          @click="addProvider"
        >
          {{ t('config.add_provider') }}
        </button>
      </div>
      <!-- Or type custom name -->
      <div class="flex gap-2">
        <input
          v-model="customProviderName"
          :placeholder="t('config.provider_name') + ' (custom)'"
          class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
          @keydown.enter="addCustomProvider"
        />
        <button
          class="px-4 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
          :disabled="!customProviderName.trim()"
          @click="addCustomProvider"
        >
          {{ t('config.add_provider') }}
        </button>
      </div>
    </div>

    <!-- Save button -->
    <button
      class="px-6 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-500 transition-colors"
      @click="save"
    >
      {{ t('config.save') }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch } from "vue";
import { useLocale } from "../composables/useLocale";

const { t } = useLocale();

const props = defineProps<{
  config: any;
}>();

const emit = defineEmits<{
  save: [config: any];
}>();

const form = reactive<any>({
  activeProvider: "",
  defaultModel: "",
  systemPrompt: "",
  locale: "en",
  providers: {} as Record<string, any>,
});

const knownApiTypes = ref<string[]>([
  "anthropic-messages",
  "openai-completions",
]);
const knownProviders = ref<string[]>([]);

const showKeys = reactive<Record<string, boolean>>({});
const newProviderName = ref("");
const customProviderName = ref("");

// Default API type mapping for known providers
const providerApiDefaults: Record<string, string> = {
  anthropic: "anthropic-messages",
  openai: "openai-completions",
  "openai-codex": "openai-codex-responses",
  "azure-openai-responses": "azure-openai-responses",
  google: "google-generative-ai",
  "google-gemini-cli": "google-gemini-cli",
  "google-vertex": "google-vertex",
  "amazon-bedrock": "bedrock-converse-stream",
  mistral: "mistral-conversations",
  groq: "openai-completions",
  cerebras: "openai-completions",
  xai: "openai-completions",
  openrouter: "openai-completions",
  "github-copilot": "openai-completions",
  "vercel-ai-gateway": "openai-completions",
  huggingface: "openai-completions",
  minimax: "openai-completions",
  "minimax-cn": "openai-completions",
};

watch(
  () => props.config,
  (cfg) => {
    if (!cfg) return;
    form.activeProvider = cfg.activeProvider ?? "";
    form.defaultModel = cfg.defaultModel ?? "";
    form.systemPrompt = cfg.systemPrompt ?? "";
    form.locale = cfg.locale ?? "en";
    form.providers = JSON.parse(JSON.stringify(cfg.providers ?? {}));
    if (cfg._meta?.knownApiTypes) {
      knownApiTypes.value = cfg._meta.knownApiTypes;
    }
    if (cfg._meta?.knownProviders) {
      knownProviders.value = cfg._meta.knownProviders;
    }
  },
  { immediate: true }
);

const providerNames = computed(() => Object.keys(form.providers));

const availableProviderSuggestions = computed(() =>
  knownProviders.value.filter((p) => !form.providers[p])
);

function addProvider() {
  const name = newProviderName.value;
  if (!name || form.providers[name]) return;
  form.providers[name] = {
    api: providerApiDefaults[name] ?? "openai-completions",
    baseUrl: "",
    apiKey: "",
  };
  newProviderName.value = "";
}

function addCustomProvider() {
  const name = customProviderName.value.trim();
  if (!name || form.providers[name]) return;
  form.providers[name] = {
    api: providerApiDefaults[name] ?? "openai-completions",
    baseUrl: "",
    apiKey: "",
  };
  customProviderName.value = "";
}

function removeProvider(name: string) {
  delete form.providers[name];
  if (form.activeProvider === name && providerNames.value.length > 0) {
    form.activeProvider = providerNames.value[0];
  }
}

function save() {
  const config: any = {
    activeProvider: form.activeProvider,
    defaultModel: form.defaultModel,
    systemPrompt: form.systemPrompt,
    locale: form.locale,
    providers: JSON.parse(JSON.stringify(form.providers)),
  };
  // Don't send _meta back to server
  emit("save", config);
}
</script>
