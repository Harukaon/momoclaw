import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { resolve } from "node:path";
import { loadConfig, initModelRegistry } from "../../core/config.js";
import { createToolsWithSubAgent } from "../../core/tools/index.js";
import { SessionStore } from "../../core/session-store.js";
import { OAuthStore } from "../../core/oauth-store.js";
import { SessionManager } from "./sessions.js";
import { sessionRoutes } from "./routes/session.js";
import { chatRoutes } from "./routes/chat.js";
import { streamRoutes } from "./routes/stream.js";
import { modelRoutes } from "./routes/models.js";
import { configRoutes } from "./routes/config.js";
import { setLocale } from "../../core/i18n/index.js";

let config = loadConfig();
let registry = await initModelRegistry(config);

setLocale(config.locale ?? "en");

const store = new SessionStore(config.sessionsDir);
await store.init();

// Initialize OAuth store (same directory as config.json)
const configDir = resolve(process.cwd());
const oauthStore = new OAuthStore(configDir);
await oauthStore.init();

// Create tools with sub-agent support (context will be available after manager is created)
let manager: SessionManager;
const tools = createToolsWithSubAgent(() => manager);

manager = new SessionManager(() => config, () => registry, tools, store, oauthStore);

// Ensure main agent exists on startup
await manager.getOrCreateMain();

const app = Fastify({ logger: true });
await app.register(cors);

// API routes
await app.register(sessionRoutes(manager), { prefix: "/api/sessions" });
await app.register(chatRoutes(manager), { prefix: "/api/sessions" });
await app.register(streamRoutes(manager), { prefix: "/api/sessions" });
await app.register(modelRoutes(manager), { prefix: "/api/models" });
await app.register(
  configRoutes(() => config, async () => {
    config = loadConfig();
    registry = await initModelRegistry(config);
    setLocale(config.locale ?? "en");
  }, oauthStore),
  { prefix: "/api/config" }
);

// Production: serve built static files
const isProd = process.env.NODE_ENV === "production";
if (isProd) {
  const clientDist = resolve(import.meta.dirname, "../client/dist");
  await app.register(fastifyStatic, { root: clientDist });
  app.setNotFoundHandler((req, reply) => {
    if (req.url.startsWith("/api")) {
      reply.code(404).send({ error: "Not found" });
    } else {
      reply.sendFile("index.html");
    }
  });
}

// Dev: port 3001 (Vite proxies /api here), Prod: port 3000
const PORT = parseInt(process.env.PORT || (isProd ? "3000" : "3001"), 10);
await app.listen({ port: PORT, host: "0.0.0.0" });
console.log(`API server running at http://localhost:${PORT}`);
