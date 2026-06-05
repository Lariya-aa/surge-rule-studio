import { describe, expect, it, vi } from "vitest";
import { uploadMergedSurgeList, validateGitHubUploadRequest } from "@/src/lib/github";

describe("github upload helper", () => {
  const validPayload = {
    owner: "owner",
    repo: "rules",
    path: "surge/OpenAI.list",
    branch: "main",
    token: "github_pat_12345678901234567890",
    content: "DOMAIN,new.com\n",
    message: "Update list",
  };

  it("validates repository, path, token, and content", () => {
    expect(validateGitHubUploadRequest(validPayload)).toEqual([]);
    expect(
      validateGitHubUploadRequest({
        ...validPayload,
        repo: "bad/repo",
        owner: "bad/name",
        path: "../secret.txt",
        token: "",
        content: "",
      }),
    ).toEqual([
      "owner is invalid",
      "repo is invalid",
      "path must be a relative file path",
      "path must end with .list",
      "GitHub token is required for this request",
      "content is empty",
    ]);
  });

  it("creates a missing GitHub list file", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ message: "Not Found" }), { status: 404 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            content: { html_url: "https://github.com/owner/rules/blob/main/surge/OpenAI.list", path: "surge/OpenAI.list" },
            commit: { sha: "abc123" },
          }),
          { status: 200 },
        ),
      ) as unknown as typeof fetch;

    const result = await uploadMergedSurgeList(validPayload, fetcher);
    expect(result.rawUrl).toBe("https://raw.githubusercontent.com/owner/rules/main/surge/OpenAI.list");
    expect(result.commitSha).toBe("abc123");
    expect(fetcher).toHaveBeenCalledTimes(2);
    const putBody = JSON.parse(String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body));
    expect(putBody.sha).toBeUndefined();
    expect(Buffer.from(putBody.content, "base64").toString("utf8")).toContain("DOMAIN,new.com");
  });

  it("merges with existing content and preserves sha updates", async () => {
    const existing = Buffer.from("DOMAIN,old.com\nDOMAIN,new.com\n", "utf8").toString("base64");
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "file-sha", encoding: "base64", content: existing }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ content: { path: "surge/OpenAI.list" }, commit: { sha: "commit-sha" } }), { status: 200 })) as unknown as typeof fetch;

    const result = await uploadMergedSurgeList({ ...validPayload, content: "DOMAIN,new.com\nDOMAIN,another.com\n" }, fetcher);
    const putBody = JSON.parse(String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body));
    const merged = Buffer.from(putBody.content, "base64").toString("utf8");
    expect(putBody.sha).toBe("file-sha");
    expect(result.mergedRules).toBe(3);
    expect(merged.match(/DOMAIN,new.com/g)).toHaveLength(1);
    expect(merged).toContain("DOMAIN,old.com");
    expect(merged).toContain("DOMAIN,another.com");
  });

  it("reports GitHub API errors", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ message: "Bad credentials" }), { status: 401 })) as unknown as typeof fetch;
    await expect(uploadMergedSurgeList(validPayload, fetcher)).rejects.toThrow("Bad credentials");
  });

  it("uses default branch and commit message, and reports write errors without API message", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 500 })) as unknown as typeof fetch;

    await expect(
      uploadMergedSurgeList({ ...validPayload, branch: "", message: "", path: "Rules.list" }, fetcher),
    ).rejects.toThrow("GitHub upload failed with 500");

    const putBody = JSON.parse(String((fetcher as unknown as ReturnType<typeof vi.fn>).mock.calls[1][1].body));
    expect(putBody.branch).toBe("main");
    expect(putBody.message).toBe("Update Rules.list");
  });

  it("reports read errors without API message and falls back when response omits content metadata", async () => {
    const readErrorFetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({}), { status: 503 })) as unknown as typeof fetch;
    await expect(uploadMergedSurgeList(validPayload, readErrorFetcher)).rejects.toThrow("GitHub read failed with 503");

    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ sha: "sha", encoding: "utf8", content: "not-base64" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 200 })) as unknown as typeof fetch;
    const result = await uploadMergedSurgeList(validPayload, fetcher);
    expect(result.path).toBe(validPayload.path);
    expect(result.htmlUrl).toBe("");
    expect(result.commitSha).toBe("");
  });

  it("throws before network calls for invalid upload payloads", async () => {
    const fetcher = vi.fn() as unknown as typeof fetch;
    await expect(uploadMergedSurgeList({ ...validPayload, token: "short" }, fetcher)).rejects.toThrow("GitHub token is required");
    expect(fetcher).not.toHaveBeenCalled();
  });
});
