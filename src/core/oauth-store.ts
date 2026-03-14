import { readFile, writeFile, mkdir, rename } from "node:fs/promises";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import type { OAuthCredentials } from "@mariozechner/pi-ai/oauth";

const FILENAME = "oauth-credentials.json";

export class OAuthStore {
  private dir: string;
  private filePath: string;

  constructor(configDir: string) {
    this.dir = configDir;
    this.filePath = join(configDir, FILENAME);
  }

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async loadAll(): Promise<Record<string, OAuthCredentials>> {
    try {
      const raw = await readFile(this.filePath, "utf-8");
      return JSON.parse(raw) as Record<string, OAuthCredentials>;
    } catch {
      return {};
    }
  }

  async get(providerId: string): Promise<OAuthCredentials | null> {
    const all = await this.loadAll();
    return all[providerId] ?? null;
  }

  async save(providerId: string, creds: OAuthCredentials): Promise<void> {
    const all = await this.loadAll();
    all[providerId] = creds;
    await this.writeAtomic(all);
  }

  async delete(providerId: string): Promise<boolean> {
    const all = await this.loadAll();
    if (!(providerId in all)) return false;
    delete all[providerId];
    await this.writeAtomic(all);
    return true;
  }

  private async writeAtomic(data: Record<string, OAuthCredentials>): Promise<void> {
    const tmpPath = join(this.dir, `${FILENAME}.tmp.${randomUUID()}`);
    await writeFile(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    await rename(tmpPath, this.filePath);
  }
}
