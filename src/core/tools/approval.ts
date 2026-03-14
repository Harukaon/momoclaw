export type ApprovalDecision = "allow" | "deny" | "always";

export interface ApprovalRequest {
  toolCallId: string;
  toolName: string;
  command: string;
}

export type RequestApprovalFn = (
  request: ApprovalRequest,
) => Promise<ApprovalDecision>;

export interface ApprovalGate {
  requestApproval: RequestApprovalFn;
  whitelist: Set<string>;
  timeoutMs: number;
}

const DEFAULT_WHITELIST = new Set([
  // filesystem / info
  "ls", "dir", "cat", "head", "tail", "echo", "pwd", "which", "where",
  "whoami", "date", "hostname", "type", "wc", "file", "stat", "find", "tree",
  // dev tools
  "git", "npm", "npx", "node", "tsc", "tsx", "python", "pip", "cargo", "go",
  // network diagnostics
  "ping", "curl", "wget", "nslookup", "dig", "traceroute",
]);

export function createApprovalGate(
  overrides?: Partial<Pick<ApprovalGate, "timeoutMs" | "requestApproval">>,
): ApprovalGate {
  return {
    requestApproval: overrides?.requestApproval ?? (async () => "deny" as const),
    whitelist: new Set(DEFAULT_WHITELIST),
    timeoutMs: overrides?.timeoutMs ?? 120_000,
  };
}

/**
 * Extract the command prefix (first token) from a shell command.
 * Handles env vars, sudo, and path prefixes.
 */
function extractPrefix(command: string): string {
  const trimmed = command.trim();

  // Strip leading env assignments like VAR=val cmd
  let rest = trimmed;
  while (/^\w+=\S*\s/.test(rest)) {
    rest = rest.replace(/^\w+=\S*\s+/, "");
  }

  // Strip sudo / nohup
  rest = rest.replace(/^(sudo|nohup)\s+/, "");

  // Take first token, strip path prefix
  const first = rest.split(/\s/)[0] || rest;
  const basename = first.replace(/^.*[\\/]/, "");
  return basename;
}

export class ApprovalDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalDeniedError";
  }
}

export async function checkApproval(
  gate: ApprovalGate,
  request: ApprovalRequest,
  signal?: AbortSignal,
): Promise<void> {
  const prefix = extractPrefix(request.command);

  // Whitelisted → pass through
  if (gate.whitelist.has(prefix)) return;

  // Race: user response vs timeout vs abort
  const decision = await Promise.race([
    gate.requestApproval(request),
    new Promise<ApprovalDecision>((_, reject) =>
      setTimeout(() => reject(new ApprovalDeniedError("Approval timed out")), gate.timeoutMs),
    ),
    ...(signal
      ? [
          new Promise<ApprovalDecision>((_, reject) => {
            if (signal.aborted) {
              reject(new ApprovalDeniedError("Aborted"));
              return;
            }
            signal.addEventListener(
              "abort",
              () => reject(new ApprovalDeniedError("Aborted")),
              { once: true },
            );
          }),
        ]
      : []),
  ]);

  if (decision === "always") {
    gate.whitelist.add(prefix);
    return;
  }

  if (decision === "allow") {
    return;
  }

  throw new ApprovalDeniedError("Command denied by user");
}
