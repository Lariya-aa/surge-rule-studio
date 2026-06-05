import { describe, expect, it, vi } from "vitest";
import { analyzeUrl } from "@/src/lib/probe";

describe("analyzeUrl", () => {
  it("fetches a URL, extracts domains, and classifies them", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        `<html><script src="https://cdn.example.com/app.js"></script><img src="https://doubleclick.net/ad.gif"></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://example.com", mode: "suffix" }, fetcher);
    expect(fetcher).toHaveBeenCalledOnce();
    expect(result.workerReachable).toBe(true);
    expect(result.statusCode).toBe(200);
    expect(result.hosts.map((host) => host.host)).toEqual(["example.com", "cdn.example.com", "doubleclick.net"]);
    expect(result.hosts.find((host) => host.host === "doubleclick.net")?.category).toBe("ad-tracking");
  });

  it("keeps the input host and blocked dump hosts when fetch fails", async () => {
    const fetcher = vi.fn(async () => {
      throw new Error("network blocked");
    }) as unknown as typeof fetch;

    const result = await analyzeUrl(
      {
        url: "blocked.example.com",
        mode: "exact",
        surgeDump: JSON.stringify({ requests: [{ remoteHost: "api.blocked.example.com:443" }] }),
      },
      fetcher,
    );

    expect(result.workerReachable).toBe(false);
    expect(result.fetchError).toContain("network blocked");
    expect(result.blockedHosts).toEqual(["api.blocked.example.com"]);
    expect(result.hosts.find((host) => host.host === "api.blocked.example.com")?.category).toBe("blocked");
    expect(result.hosts.find((host) => host.host === "blocked.example.com")?.rule).toBe("DOMAIN,blocked.example.com");
  });

  it("skips large or binary bodies while preserving final URL host", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("ignored", {
        status: 204,
        headers: {
          "content-type": "image/png",
          "content-length": "30",
        },
      });
    }) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://assets.example.net/logo.png" }, fetcher);
    expect(result.hosts.map((host) => host.host)).toEqual(["assets.example.net"]);
  });

  it("treats redirects as reachable and skips oversized text bodies", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("too large", {
        status: 302,
        headers: {
          "content-type": "text/html",
          "content-length": "2000001",
        },
      });
    }) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://redirect.example.com/path" }, fetcher);
    expect(result.workerReachable).toBe(true);
    expect(result.hosts.map((host) => host.host)).toEqual(["redirect.example.com"]);
  });

  it("skips binary paths when content type is missing", async () => {
    const response = new Response("binary-ish", { status: 200 });
    Object.defineProperty(response, "url", { value: "https://cdn.example.com/file.zip" });
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://cdn.example.com/file.zip" }, fetcher);
    expect(result.hosts.map((host) => host.host)).toEqual(["cdn.example.com"]);
  });

  it("handles body read errors and non-Error fetch throws", async () => {
    const brokenResponse = {
      status: 200,
      ok: true,
      url: "https://broken.example.com/",
      headers: new Headers({ "content-type": "text/html" }),
      text: async () => {
        throw new Error("body exploded");
      },
    } as Response;
    const fetcher = vi.fn(async () => brokenResponse) as unknown as typeof fetch;
    const bodyResult = await analyzeUrl({ url: "https://broken.example.com/" }, fetcher);
    expect(bodyResult.fetchError).toBe("");
    expect(bodyResult.hosts.map((host) => host.host)).toEqual(["broken.example.com"]);

    const throwingFetcher = vi.fn(async () => {
      throw "blocked-string";
    }) as unknown as typeof fetch;
    const throwResult = await analyzeUrl({ url: "https://string-error.example.com/" }, throwingFetcher);
    expect(throwResult.fetchError).toBe("blocked-string");
  });

  it("accepts each supported textual content type", async () => {
    const contentTypes = [
      "application/json",
      "application/javascript",
      "application/xml",
      "image/svg+xml",
      "text/css",
      "text/html",
      "application/xhtml+xml",
      "application/manifest+json",
    ];

    for (const contentType of contentTypes) {
      const fetcher = vi.fn(async () => {
        return new Response(`{"url":"https://asset.${contentType.split("/")[0]}.example.com/file.js"}`, {
          status: 200,
          headers: { "content-type": contentType },
        });
      }) as unknown as typeof fetch;
      const result = await analyzeUrl({ url: `https://${contentType.replace(/[^a-z]/g, "")}.example.com/` }, fetcher);
      expect(result.hosts.length).toBeGreaterThan(1);
    }
  });
});
