import type { FastifyPluginAsync } from "fastify";
import type { SessionManager } from "../sessions.js";

export function streamRoutes(manager: SessionManager): FastifyPluginAsync {
  return async (app) => {
    // SSE stream for a session
    app.get<{ Params: { id: string } }>("/:id/stream", async (req, reply) => {
      let session = manager.get(req.params.id);
      if (!session) {
        // Try to resume from disk
        session = (await manager.resume(req.params.id)) ?? undefined;
      }
      if (!session) {
        reply.code(404);
        return { error: "Session not found" };
      }

      // Tell Fastify we're handling the response ourselves
      reply.hijack();

      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      });

      // Replay missed events — check header first, then query param
      const lastEventId =
        parseInt(req.headers["last-event-id"] as string, 10) ||
        parseInt((req.query as any)?.lastEventId as string, 10) ||
        0;
      const missed = manager.getEventsSince(req.params.id, lastEventId);
      for (const event of missed) {
        reply.raw.write(
          `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        );
      }

      // Register for live events
      const sendEvent = (event: {
        id: number;
        type: string;
        data: Record<string, any>;
      }) => {
        reply.raw.write(
          `id: ${event.id}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`
        );
      };

      const unsubscribe = manager.addSseClient(req.params.id, sendEvent);

      // Send keepalive every 15s
      const keepalive = setInterval(() => {
        reply.raw.write(":keepalive\n\n");
      }, 15000);

      req.raw.on("close", () => {
        clearInterval(keepalive);
        if (unsubscribe) unsubscribe();
      });
    });
  };
}
