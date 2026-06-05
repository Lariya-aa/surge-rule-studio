import { mergeSurgeList } from "./surge";

export interface GitHubUploadRequest {
  owner: string;
  repo: string;
  path: string;
  branch?: string;
  token: string;
  content: string;
  message?: string;
}

export interface GitHubUploadResult {
  path: string;
  branch: string;
  mergedRules: number;
  htmlUrl: string;
  rawUrl: string;
  commitSha: string;
}

interface GitHubContentResponse {
  sha?: string;
  content?: string;
  encoding?: string;
  html_url?: string;
}

export function validateGitHubUploadRequest(payload: GitHubUploadRequest): string[] {
  const errors: string[] = [];
  if (!/^[A-Za-z0-9_.-]+$/.test(payload.owner || "")) {
    errors.push("owner is invalid");
  }
  if (!/^[A-Za-z0-9_.-]+$/.test(payload.repo || "")) {
    errors.push("repo is invalid");
  }
  if (!payload.path || payload.path.startsWith("/") || payload.path.includes("..")) {
    errors.push("path must be a relative file path");
  }
  if (!payload.path.endsWith(".list")) {
    errors.push("path must end with .list");
  }
  if (!payload.token || payload.token.length < 20) {
    errors.push("GitHub token is required for this request");
  }
  if (!payload.content.trim()) {
    errors.push("content is empty");
  }
  return errors;
}

export async function uploadMergedSurgeList(
  payload: GitHubUploadRequest,
  fetcher: typeof fetch = fetch,
): Promise<GitHubUploadResult> {
  const errors = validateGitHubUploadRequest(payload);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const branch = payload.branch?.trim() || "main";
  const encodedPath = payload.path
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  const baseUrl = `https://api.github.com/repos/${payload.owner}/${payload.repo}/contents/${encodedPath}`;
  const headers = {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${payload.token}`,
    "x-github-api-version": "2022-11-28",
  };

  const existing = await readExistingContent(`${baseUrl}?ref=${encodeURIComponent(branch)}`, headers, fetcher);
  const merged = mergeSurgeList(existing.text, payload.content);
  const body: Record<string, string> = {
    message: payload.message?.trim() || `Update ${payload.path}`,
    content: encodeBase64(merged),
    branch,
  };
  if (existing.sha) {
    body.sha = existing.sha;
  }

  const response = await fetcher(baseUrl, {
    method: "PUT",
    headers: {
      ...headers,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const data = (await response.json().catch(() => ({}))) as {
    content?: { html_url?: string; path?: string };
    commit?: { sha?: string };
    message?: string;
  };

  if (!response.ok) {
    throw new Error(data.message || `GitHub upload failed with ${response.status}`);
  }

  return {
    path: data.content?.path || payload.path,
    branch,
    mergedRules: merged.split(/\r?\n/).filter((line) => /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6),/i.test(line)).length,
    htmlUrl: data.content?.html_url || "",
    rawUrl: `https://raw.githubusercontent.com/${payload.owner}/${payload.repo}/${branch}/${payload.path}`,
    commitSha: data.commit?.sha || "",
  };
}

async function readExistingContent(
  url: string,
  headers: Record<string, string>,
  fetcher: typeof fetch,
): Promise<{ text: string; sha: string }> {
  const response = await fetcher(url, { headers });
  if (response.status === 404) {
    return { text: "", sha: "" };
  }
  const data = (await response.json().catch(() => ({}))) as GitHubContentResponse;
  if (!response.ok) {
    throw new Error((data as { message?: string }).message || `GitHub read failed with ${response.status}`);
  }
  const text = data.encoding === "base64" && data.content ? decodeBase64(data.content) : "";
  return { text, sha: data.sha || "" };
}

function encodeBase64(value: string): string {
  if (typeof Buffer !== "undefined") {
    return Buffer.from(value, "utf8").toString("base64");
  }
  /* v8 ignore next 1 -- Browser-only fallback; Node test runtime exercises Buffer path. */
  return btoa(unescape(encodeURIComponent(value)));
}

function decodeBase64(value: string): string {
  const compact = value.replace(/\s/g, "");
  if (typeof Buffer !== "undefined") {
    return Buffer.from(compact, "base64").toString("utf8");
  }
  /* v8 ignore next 1 -- Browser-only fallback; Node test runtime exercises Buffer path. */
  return decodeURIComponent(escape(atob(compact)));
}
