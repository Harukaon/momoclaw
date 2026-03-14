import type { FastifyPluginAsync } from "fastify";
import type { SessionManager } from "../sessions.js";

export function sessionRoutes(manager: SessionManager): FastifyPluginAsync {
  return async (app) => {
    // List all persisted sessions
    app.get("/", async () => {
      const summaries = await manager.getStore().list();
      return { sessions: summaries };
    });

    // Get or create main session
    app.post("/", async (_req, reply) => {
      const session = await manager.getOrCreateMain();
      return { id: session.id, createdAt: session.createdAt, type: session.type };
    });

    // Create sub-agent
    app.post<{ Body: { parentId?: string; taskPrompt?: string } }>(
      "/sub",
      async (req, reply) => {
        const { parentId, taskPrompt } = (req.body as any) ?? {};
        const session = manager.createSubAgent(parentId, taskPrompt, "user");
        return { id: session.id, createdAt: session.createdAt, type: session.type, parentId: session.parentId };
      }
    );

    // Get session info (try in-memory, then resume from disk)
    app.get<{ Params: { id: string } }>("/:id", async (req, reply) => {
      let session = manager.get(req.params.id);

      // Try to resume from disk if not in memory
      if (!session) {
        session = (await manager.resume(req.params.id)) ?? undefined;
      }

      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      const messages = session.agent.state.messages.map((m: any) => ({
        role: m.role,
        content: m.content,
      }));
      return {
        id: session.id,
        type: session.type,
        parentId: session.parentId,
        createdAt: session.createdAt,
        isStreaming: session.agent.state.isStreaming,
        model: session.agent.state.model.id,
        messages,
      };
    });

    // Delete session (main agent is protected)
    app.delete<{ Params: { id: string } }>("/:id", async (req, reply) => {
      // Protect main agent
      if (req.params.id === manager.getMainSessionId()) {
        reply.code(403);
        return { error: "Cannot delete main agent" };
      }

      const deleted = manager.delete(req.params.id);
      if (!deleted) {
        const diskDeleted = await manager.getStore().delete(req.params.id);
        if (!diskDeleted) {
          reply.code(404);
          return { error: "Session not found" };
        }
      }
      return { ok: true };
    });

    // Resume a persisted session
    app.post<{ Params: { id: string } }>(
      "/:id/resume",
      async (req, reply) => {
        const session = await manager.resume(req.params.id);
        if (!session) {
          reply.code(404);
          return { error: "Session not found" };
        }
        const messages = session.agent.state.messages.map((m: any) => ({
          role: m.role,
          content: m.content,
        }));
        return {
          id: session.id,
          type: session.type,
          parentId: session.parentId,
          createdAt: session.createdAt,
          isStreaming: session.agent.state.isStreaming,
          model: session.agent.state.model.id,
          messages,
        };
      }
    );

    // Rename a session
    app.put<{ Params: { id: string }; Body: { title: string } }>(
      "/:id/title",
      async (req, reply) => {
        const { title } = req.body as any;
        if (!title || typeof title !== "string") {
          reply.code(400);
          return { error: "title is required and must be a string" };
        }
        try {
          await manager.getStore().rename(req.params.id, title);
          return { ok: true };
        } catch {
          reply.code(404);
          return { error: "Session not found" };
        }
      }
    );

    // Switch model for a session
    app.put<{ Params: { id: string }; Body: { model: string } }>(
      "/:id/model",
      async (req, reply) => {
        const session = manager.get(req.params.id);
        if (!session) {
          reply.code(404);
          return { error: "Session not found" };
        }

        const { model } = req.body as any;
        if (!model || typeof model !== "string") {
          reply.code(400);
          return { error: "model is required and must be a string" };
        }

        try {
          manager.setModel(req.params.id, model);
          return { ok: true, model };
        } catch (err) {
          reply.code(400);
          return { error: err instanceof Error ? err.message : String(err) };
        }
      }
    );
  };
}
