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

        <!-- Auth type: API Key -->
        <template v-if="getAuthType(pName) === 'api-key'">
          <!-- Base URL (optional) -->
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
            <label class="block text-xs text-gray-400 mb-1">
              {{ t('config.api_key') }}
              <span class="text-gray-500 ml-1">({{ getEnvVar(pName) }})</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="form.providers[pName].apiKey"
                :type="showKeys[pName] ? 'text' : 'password'"
                class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
                :placeholder="t('config.api_key_or_env')"
              />
              <button
                class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                @click="showKeys[pName] = !showKeys[pName]"
              >
                {{ showKeys[pName] ? '🔒' : '👁' }}
              </button>
            </div>
          </div>
        </template>

        <!-- Auth type: GitHub Token -->
        <template v-else-if="getAuthType(pName) === 'github-token'">
          <div>
            <label class="block text-xs text-gray-400 mb-1">
              GitHub Token
              <span class="text-gray-500 ml-1">(GITHUB_TOKEN)</span>
            </label>
            <div class="flex gap-2">
              <input
                v-model="form.providers[pName].apiKey"
                :type="showKeys[pName] ? 'text' : 'password'"
                class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
                placeholder="ghp_... or env: GITHUB_TOKEN"
              />
              <button
                class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors"
                @click="showKeys[pName] = !showKeys[pName]"
              >
                {{ showKeys[pName] ? '🔒' : '👁' }}
              </button>
            </div>
          </div>
        </template>

        <!-- Auth type: AWS -->
        <template v-else-if="getAuthType(pName) === 'aws'">
          <div class="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p class="font-medium text-gray-300">{{ t('config.auth_env_vars') }}:</p>
            <code class="block">AWS_PROFILE</code>
            <p class="text-gray-500">{{ t('config.or') }}</p>
            <code class="block">AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY</code>
            <p class="text-gray-500">{{ t('config.or') }}</p>
            <code class="block">AWS_BEARER_TOKEN_BEDROCK</code>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">{{ t('config.aws_region') }}</label>
            <input
              v-model="form.providers[pName].region"
              class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              placeholder="us-east-1"
            />
          </div>
        </template>

        <!-- Auth type: Azure -->
        <template v-else-if="getAuthType(pName) === 'azure'">
          <div>
            <label class="block text-xs text-gray-400 mb-1">
              {{ t('config.api_key') }}
              <span class="text-gray-500 ml-1">(AZURE_OPENAI_API_KEY)</span>
            </label>
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
          <div>
            <label class="block text-xs text-gray-400 mb-1">{{ t('config.azure_resource') }}</label>
            <input
              v-model="form.providers[pName].azureResourceName"
              class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              placeholder="my-openai-resource"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">{{ t('config.azure_deployment') }}</label>
            <input
              v-model="form.providers[pName].azureDeploymentName"
              class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              placeholder="gpt-4o"
            />
          </div>
        </template>

        <!-- Auth type: GCP Vertex -->
        <template v-else-if="getAuthType(pName) === 'gcp-vertex'">
          <div class="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p class="font-medium text-gray-300">{{ t('config.auth_env_vars') }}:</p>
            <code class="block">GOOGLE_APPLICATION_CREDENTIALS</code>
            <p class="text-gray-500">gcloud auth application-default login</p>
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">{{ t('config.gcp_project') }}</label>
            <input
              v-model="form.providers[pName].project"
              class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              placeholder="my-gcp-project"
            />
          </div>
          <div>
            <label class="block text-xs text-gray-400 mb-1">{{ t('config.gcp_location') }}</label>
            <input
              v-model="form.providers[pName].location"
              class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              placeholder="us-central1"
            />
          </div>
        </template>

        <!-- Auth type: OAuth -->
        <template v-else-if="getAuthType(pName) === 'oauth'">
          <div class="bg-gray-800/50 rounded-lg p-3 text-xs text-gray-400 space-y-1">
            <p class="font-medium text-gray-300">{{ t('config.oauth_hint') }}</p>
            <p>{{ t('config.oauth_env') }}: <code>{{ getEnvVar(pName) }}</code></p>
          </div>
        </template>

        <!-- Auth type: custom / unknown -->
        <template v-else>
          <div>
            <label class="block text-xs text-gray-400 mb-1">{{ t('config.base_url') }}</label>
            <input
              v-model="form.providers[pName].baseUrl"
              class="w-full bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              placeholder="https://api.example.com"
            />
          </div>
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
        </template>

        <!-- Default Model (all providers) -->
        <div>
          <label class="block text-xs text-gray-400 mb-1">{{ t('config.default_model') }}</label>
          <div class="flex gap-2">
            <select
              v-if="providerModels[pName]?.length"
              v-model="form.providers[pName].defaultModel"
              class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
            >
              <option value="">-- {{ t('config.select_model') }} --</option>
              <option v-for="m in providerModels[pName]" :key="m" :value="m">{{ m }}</option>
            </select>
            <input
              v-else
              v-model="form.providers[pName].defaultModel"
              class="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm outline-none border border-gray-600"
              :placeholder="t('config.model_placeholder')"
            />
            <button
              class="px-3 py-2 bg-gray-700 text-gray-300 rounded-lg text-sm hover:bg-gray-600 transition-colors whitespace-nowrap"
              :disabled="loadingModels[pName]"
              @click="fetchModels(pName)"
            >
              {{ loadingModels[pName] ? '...' : t('config.fetch_models') }}
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
const providerModels = reactive<Record<string, string[]>>({});
const loadingModels = reactive<Record<string, boolean>>({});
const newProviderName = ref("");
const customProviderName = ref("");

// --- Provider auth type metadata ---

type AuthType = "api-key" | "github-token" | "aws" | "azure" | "gcp-vertex" | "oauth" | "custom";

const providerAuthTypes: Record<string, AuthType> = {
  // Simple API Key
  anthropic: "api-key",
  openai: "api-key",
  google: "api-key",
  mistral: "api-key",
  groq: "api-key",
  cerebras: "api-key",
  xai: "api-key",
  openrouter: "api-key",
  zai: "api-key",
  minimax: "api-key",
  "minimax-cn": "api-key",
  huggingface: "api-key",
  opencode: "api-key",
  "opencode-go": "api-key",
  "kimi-coding": "api-key",
  "vercel-ai-gateway": "api-key",
  // GitHub Token
  "github-copilot": "github-token",
  // AWS
  "amazon-bedrock": "aws",
  // Azure
  "azure-openai-responses": "azure",
  // GCP Vertex
  "google-vertex": "gcp-vertex",
  // OAuth device flow
  "google-gemini-cli": "oauth",
  "google-antigravity": "oauth",
  "openai-codex": "oauth",
};

const providerEnvVars: Record<string, string> = {
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  google: "GEMINI_API_KEY",
  mistral: "MISTRAL_API_KEY",
  groq: "GROQ_API_KEY",
  cerebras: "CEREBRAS_API_KEY",
  xai: "XAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  zai: "ZAI_API_KEY",
  minimax: "MINIMAX_API_KEY",
  "minimax-cn": "MINIMAX_CN_API_KEY",
  huggingface: "HF_TOKEN",
  opencode: "OPENCODE_API_KEY",
  "opencode-go": "OPENCODE_API_KEY",
  "kimi-coding": "KIMI_API_KEY",
  "vercel-ai-gateway": "AI_GATEWAY_API_KEY",
  "github-copilot": "GITHUB_TOKEN",
  "azure-openai-responses": "AZURE_OPENAI_API_KEY",
  "google-gemini-cli": "GEMINI_API_KEY",
  "google-antigravity": "GEMINI_API_KEY",
  "openai-codex": "OPENAI_API_KEY",
};

// Default API type mapping for known providers
const providerApiDefaults: Record<string, string> = {
  anthropic: "anthropic-messages",
  openai: "openai-completions",
  "openai-codex": "openai-codex-responses",
  "azure-openai-responses": "azure-openai-responses",
  google: "google-generative-ai",
  "google-gemini-cli": "google-gemini-cli",
  "google-antigravity": "google-generative-ai",
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

function getAuthType(providerName: string): AuthType {
  return providerAuthTypes[providerName] ?? "custom";
}

function getEnvVar(providerName: string): string {
  return providerEnvVars[providerName] ?? "";
}

watch(
  () => props.config,
  (cfg) => {
    if (!cfg) return;
    form.activeProvider = cfg.activeProvider ?? "";
    form.systemPrompt = cfg.systemPrompt ?? "";
    form.locale = cfg.locale ?? "en";
    form.providers = JSON.parse(JSON.stringify(cfg.providers ?? {}));
    // Ensure each provider has a defaultModel field
    for (const p of Object.values(form.providers) as any[]) {
      if (p.defaultModel === undefined) p.defaultModel = "";
    }
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
    defaultModel: "",
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
    defaultModel: "",
  };
  customProviderName.value = "";
}

function removeProvider(name: string) {
  delete form.providers[name];
  delete providerModels[name];
  if (form.activeProvider === name && providerNames.value.length > 0) {
    form.activeProvider = providerNames.value[0];
  }
}

async function fetchModels(providerName: string) {
  loadingModels[providerName] = true;
  try {
    const res = await fetch(`/api/config/providers/${encodeURIComponent(providerName)}/models`);
    const data = await res.json();
    if (data.models?.length > 0) {
      providerModels[providerName] = data.models;
    }
  } catch {
    // silent
  } finally {
    loadingModels[providerName] = false;
  }
}

function save() {
  const config: any = {
    activeProvider: form.activeProvider,
    systemPrompt: form.systemPrompt,
    locale: form.locale,
    providers: JSON.parse(JSON.stringify(form.providers)),
  };
  // Don't send _meta back to server
  emit("save", config);
}
</script>
