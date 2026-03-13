import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { getModel, getModels, getProviders } from "@mariozechner/pi-ai";
import type { Model, Api, KnownApi, KnownProvider } from "@mariozechner/pi-ai";

// --- Config types ---

export type ApiType = KnownApi | (string & {});

export interface ProviderConfig {
  api: ApiType;
  baseUrl?: string;
  apiKey: string;
}

export interface Config {
  activeProvider: string;
  defaultModel: string;
  systemPrompt: string;
  providers: Record<string, ProviderConfig>;
  sessionsDir?: string;
  locale?: "en" | "zh-CN";
}

const defaults: Config = {
  activeProvider: "anthropic",
  defaultModel: "claude-sonnet-4-20250514",
  systemPrompt: "You are a helpful personal assistant. Be concise and direct.",
  providers: {},
};

export function loadConfig(): Config {
  const configPath = resolve(process.cwd(), "config.json");

  try {
    const raw = readFileSync(configPath, "utf-8");
    const json = JSON.parse(raw);
    return { ...defaults, ...json };
  } catch {
    console.error(`Failed to read ${configPath}. Create a config.json file.`);
    process.exit(1);
  }
}

export function getActiveProvider(config: Config): ProviderConfig {
  const provider = config.providers[config.activeProvider];
  if (!provider) {
    console.error(`Provider "${config.activeProvider}" not found in config.json`);
    process.exit(1);
  }
  return provider;
}

// --- Model resolution ---

interface ModelsResponse {
  data: Array<{ id: string; owned_by?: string }>;
}

async function fetchRemoteModels(provider: ProviderConfig): Promise<string[] | null> {
  if (!provider.baseUrl) return null;

  const urls = [
    `${provider.baseUrl}/v1/models`,
    `${provider.baseUrl}/models`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      });
      if (!res.ok) continue;

      const json = (await res.json()) as ModelsResponse;
      if (json.data?.length > 0) {
        return json.data.map((m) => m.id).sort();
      }
    } catch {
      continue;
    }
  }

  return null;
}

function getStaticModels(providerName: string): string[] {
  try {
    const models = getModels(providerName as any);
    return Object.keys(models).sort();
  } catch {
    return [];
  }
}

function buildRemoteModel(modelId: string, provider: ProviderConfig): Model<Api> {
  return {
    id: modelId,
    name: modelId,
    api: provider.api as Api,
    provider: provider.api.split("-")[0] as any,
    baseUrl: provider.baseUrl!,
    reasoning: false,
    input: ["text", "image"] as ("text" | "image")[],
    cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
    contextWindow: 200000,
    maxTokens: 16384,
  };
}

export interface ModelRegistry {
  availableModels: string[];
  resolve: (modelId: string) => Model<Api>;
  source: "remote" | "static";
}

export async function initModelRegistry(config: Config): Promise<ModelRegistry> {
  const providerName = config.activeProvider;
  const provider = getActiveProvider(config);

  // 1) Try remote API
  const remoteModels = await fetchRemoteModels(provider);
  if (remoteModels && remoteModels.length > 0) {
    return {
      availableModels: remoteModels,
      source: "remote",
      resolve: (modelId: string) => buildRemoteModel(modelId, provider),
    };
  }

  // 2) Fallback to static registry
  const staticModels = getStaticModels(providerName);

  return {
    availableModels: staticModels.length > 0 ? staticModels : [config.defaultModel],
    source: "static",
    resolve: (modelId: string) => {
      try {
        const model = getModel(providerName as any, modelId as any);
        return provider.baseUrl ? { ...model, baseUrl: provider.baseUrl } : model;
      } catch {
        if (provider.baseUrl) {
          return buildRemoteModel(modelId, provider);
        }
        throw new Error(`Model "${modelId}" not found in ${providerName} registry`);
      }
    },
  };
}

// --- Known API types and providers from pi-ai ---

export const KNOWN_API_TYPES: string[] = [
  "anthropic-messages",
  "openai-completions",
  "openai-responses",
  "openai-codex-responses",
  "azure-openai-responses",
  "google-generative-ai",
  "google-gemini-cli",
  "google-vertex",
  "bedrock-converse-stream",
  "mistral-conversations",
];

export function getKnownProviders(): string[] {
  return getProviders();
}
