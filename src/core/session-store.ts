import { readFile, writeFile, unlink, mkdir, readdir, rename } from "node:fs/promises";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

export interface AgentMessage {
  role: string;
  content: any;
}

export interface PersistedSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  modelId: string;
  messages: AgentMessage[];
}

export interface SessionSummary {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
}

export class SessionStore {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir || resolve(homedir(), ".my-assistant", "sessions");
  }

  async init(): Promise<void> {
    await mkdir(this.dir, { recursive: true });
  }

  async save(session: PersistedSession): Promise<void> {
    const filePath = join(this.dir, `${session.id}.json`);
    const tmpPath = join(this.dir, `${session.id}.tmp.${randomUUID()}`);
    const data = JSON.stringify(session, null, 2);
    await writeFile(tmpPath, data, "utf-8");
    await rename(tmpPath, filePath);
  }

  async load(id: string): Promise<PersistedSession | null> {
    const filePath = join(this.dir, `${id}.json`);
    try {
      const raw = await readFile(filePath, "utf-8");
      return JSON.parse(raw) as PersistedSession;
    } catch {
      return null;
    }
  }

  async delete(id: string): Promise<boolean> {
    const filePath = join(this.dir, `${id}.json`);
    try {
      await unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  async rename(id: string, title: string): Promise<void> {
    const session = await this.load(id);
    if (!session) throw new Error("Session not found");
    session.title = title;
    session.updatedAt = Date.now();
    await this.save(session);
  }

  async list(): Promise<SessionSummary[]> {
    let files: string[];
    try {
      files = await readdir(this.dir);
    } catch {
      return [];
    }

    const summaries: SessionSummary[] = [];
    for (const file of files) {
      if (!file.endsWith(".json") || file.includes(".tmp.")) continue;
      const id = file.replace(".json", "");
      const session = await this.load(id);
      if (session) {
        summaries.push({
          id: session.id,
          title: session.title,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          messageCount: session.messages.length,
        });
      }
    }

    // Sort by updatedAt descending (most recent first)
    summaries.sort((a, b) => b.updatedAt - a.updatedAt);
    return summaries;
  }

  static deriveTitle(messages: AgentMessage[]): string {
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return "New conversation";
    const content =
      typeof firstUser.content === "string"
        ? firstUser.content
        : JSON.stringify(firstUser.content);
    const cleaned = content.replace(/\n/g, " ").trim();
    return cleaned.length > 60 ? cleaned.slice(0, 57) + "..." : cleaned;
  }
}
