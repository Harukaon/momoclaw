import type { FastifyPluginAsync } from "fastify";
import type { SessionManager } from "../sessions.js";

export function modelRoutes(manager: SessionManager): FastifyPluginAsync {
  return async (app) => {
    // Get available models
    app.get("/", async () => {
      return { models: manager.getModels() };
    });
  };
}
