import { describe, it, expect } from "vitest";
import { buildEventMessage } from "../src/lib/message.ts";

describe("buildEventMessage", () => {
  it("reports a passing workflow with repo and branch", () => {
    const msg = buildEventMessage({
      workflow: "Build and test",
      repository: "speechify-api",
      branch: "main",
      sha: "4f2ab1c9d3",
      status: "success",
    });
    expect(msg).toContain("Build and test passed.");
    expect(msg).toContain("repository speechify-api");
    expect(msg).toContain("branch main");
    expect(msg).toContain("Commit 4f2ab1c");
  });

  it("uses a distinct verb for failures", () => {
    const msg = buildEventMessage({ workflow: "Deploy", status: "failure" });
    expect(msg).toContain("Deploy failed.");
  });

  it("handles a cancelled run", () => {
    const msg = buildEventMessage({ workflow: "Lint", status: "cancelled" });
    expect(msg).toContain("Lint was cancelled.");
  });

  it("includes the actor after the short sha", () => {
    const msg = buildEventMessage({
      workflow: "CI",
      sha: "abcdef12345",
      actor: "luke",
      status: "success",
    });
    expect(msg).toContain("Commit abcdef1 by luke.");
  });

  it("falls back gracefully when the workflow is unknown", () => {
    const msg = buildEventMessage({ status: "success" });
    expect(msg).toContain("CI passed.");
  });

  it("does not emit an empty commit message clause", () => {
    const msg = buildEventMessage({ workflow: "CI", commitMessage: "   ", status: "success" });
    expect(msg).not.toContain("Message:");
  });

  it("trims a commit message into the output", () => {
    const msg = buildEventMessage({
      workflow: "CI",
      commitMessage: "  fix flaky test  ",
      status: "success",
    });
    expect(msg).toContain("Message: fix flaky test.");
  });

  it("orders clauses headline, context, commit", () => {
    const msg = buildEventMessage({
      workflow: "CI",
      repository: "speechify-api",
      branch: "main",
      sha: "abc",
      status: "success",
    });
    const h = msg.indexOf("CI passed.");
    const ctx = msg.indexOf("repository speechify-api");
    const sha = msg.indexOf("Commit abc");
    expect(h).toBeGreaterThanOrEqual(0);
    expect(ctx).toBeGreaterThan(h);
    expect(sha).toBeGreaterThan(ctx);
  });
});
