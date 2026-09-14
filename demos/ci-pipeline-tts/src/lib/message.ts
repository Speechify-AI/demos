// Turn raw CI event facts into the spoken sentence. This is kept pure (no I/O,
// no API) so the phrasing is fully unit-testable.

export type CiStatus = "success" | "failure" | "cancelled" | "started" | string;

export interface CiEvent {
  workflow?: string;
  repository?: string;
  branch?: string;
  sha?: string;
  status?: CiStatus;
  eventName?: string;
  actor?: string;
  commitMessage?: string;
}

const STATUS_VERB: Record<string, string> = {
  success: "passed",
  failure: "failed",
  cancelled: "was cancelled",
  started: "started",
};

function shortSha(sha?: string): string {
  if (!sha) return "";
  return sha.slice(0, 7);
}

// "CI passed. Repository speechify-api, branch main. Commit 4f2ab1c by luke.
//  Build and test finished in 3 minutes."
export function buildEventMessage(event: CiEvent): string {
  const verb = STATUS_VERB[event.status ?? ""] ?? (event.status ? `finished with status ${event.status}` : "finished");
  const who = event.actor ? ` by ${event.actor}` : "";

  const clauses: string[] = [];

  const headline = event.workflow
    ? `${event.workflow} ${verb}.`
    : `CI ${verb}.`;
  clauses.push(headline);

  const context: string[] = [];
  if (event.repository) context.push(`repository ${event.repository}`);
  if (event.branch) context.push(`branch ${event.branch}`);
  if (context.length > 0) {
    clauses.push(`${context.join(", ")}.`);
  }

  const sha = shortSha(event.sha);
  const commit = sha ? `Commit ${sha}${who}.` : who ? `Run by${who}.` : "";
  if (commit) clauses.push(commit);

  if (event.commitMessage) {
    const cleaned = event.commitMessage.trim();
    if (cleaned) clauses.push(`Message: ${cleaned}.`);
  }

  return clauses.join(" ");
}
