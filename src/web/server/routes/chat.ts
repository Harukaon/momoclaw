import type { FastifyPluginAsync } from "fastify";
import type { SessionManager } from "../sessions.js";

export function chatRoutes(manager: SessionManager): FastifyPluginAsync {
  return async (app) => {
    // Send a message to a session
    app.post<{ Params: { id: string }; Body: { message: string } }>(
      "/:id/messages",
      async (req, reply) => {
        const session = manager.get(req.params.id);
        if (!session) {
          reply.code(404);
          return { error: "Session not found" };
        }

        const { message } = req.body as any;
        if (!message || typeof message !== "string") {
          reply.code(400);
          return { error: "message is required and must be a string" };
        }

        if (session.agent.state.isStreaming) {
          reply.code(409);
          return { error: "Agent is already streaming" };
        }

        // Fire-and-forget: prompt runs in background, events flow via SSE
        manager.prompt(req.params.id, message).catch((err) => {
          console.error("[prompt error]", req.params.id, err);
        });

        return { ok: true };
      }
    );

    // Abort current streaming response
    app.post<{ Params: { id: string } }>("/:id/abort", async (req, reply) => {
      const aborted = manager.abort(req.params.id);
      if (aborted === false && !manager.get(req.params.id)) {
        reply.code(404);
        return { error: "Session not found" };
      }
      return { aborted };
    });

    // Approve or deny a tool execution
    app.post<{
      Params: { id: string };
      Body: { toolCallId: string; decision: "allow" | "deny" | "always" };
    }>("/:id/tool-approve", async (req, reply) => {
      const session = manager.get(req.params.id);
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      const { toolCallId, decision } = req.body as any;
      if (!toolCallId || !decision) {
        reply.code(400);
        return { error: "toolCallId and decision are required" };
      }

      if (!["allow", "deny", "always"].includes(decision)) {
        reply.code(400);
        return { error: "decision must be allow, deny, or always" };
      }

      const resolved = manager.resolveApproval(req.params.id, toolCallId, decision);
      return { ok: resolved };
    });
  };
}
