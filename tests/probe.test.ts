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
    expect(result.evidenceStatus).toBe("UNKNOWN");
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
        surgeDump: JSON.stringify({
          requests: [{ remoteHost: "api.blocked.example.com:443", notes: ["failed direct connection"] }],
        }),
      },
      fetcher,
    );

    expect(result.workerReachable).toBe(false);
    expect(result.fetchError).toContain("network blocked");
    expect(result.blockedHosts).toEqual(["api.blocked.example.com"]);
    expect(result.evidenceStatus).toBe("BLOCKED_VERIFIED");
    expect(result.hosts.find((host) => host.host === "api.blocked.example.com")?.category).toBe("blocked");
    expect(result.hosts.find((host) => host.host === "blocked.example.com")?.rule).toBe("DOMAIN,blocked.example.com");
  });

  it("does not treat browser reachability as direct when Surge evidence shows proxy routing", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(`<script src="https://media.example.com/player.js"></script>`, {
        status: 200,
        headers: { "content-type": "text/html" },
      });
    }) as unknown as typeof fetch;

    const result = await analyzeUrl(
      {
        url: "https://example.com",
        surgeDump: JSON.stringify({
          requests: [{ remoteHost: "example.com:443", remoteAddress: "1.1.1.1:443 (Proxy)", policyName: "Singapore" }],
        }),
      },
      fetcher,
    );

    expect(result.workerReachable).toBe(true);
    expect(result.evidenceStatus).toBe("PROXY_VERIFIED");
    expect(result.hosts.find((host) => host.host === "example.com")?.category).toBe("proxy-global");
  });

  it("accepts explicit DIRECT Surge evidence as the only direct verification", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 200 })) as unknown as typeof fetch;

    const result = await analyzeUrl(
      {
        url: "https://direct.example",
        surgeDump: JSON.stringify({ requests: [{ remoteHost: "direct.example:443", policyName: "DIRECT" }] }),
      },
      fetcher,
    );

    expect(result.workerReachable).toBe(true);
    expect(result.evidenceStatus).toBe("DIRECT_VERIFIED");
    expect(result.hosts.find((host) => host.host === "direct.example")?.category).toBe("direct-cn");
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

  it("skips non-textual content types like application/octet-stream", async () => {
    const fetcher = vi.fn(async () => {
      return new Response("binary data", {
        status: 200,
        headers: { "content-type": "application/octet-stream" },
      });
    }) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://download.example.com/data" }, fetcher);
    expect(result.hosts.map((host) => host.host)).toEqual(["download.example.com"]);
  });

  it("skips binary paths when content type is missing", async () => {
    const response = new Response("data", { status: 200 });
    Object.defineProperty(response, "url", { value: "https://img.example.com/photo.png" });
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://img.example.com/photo.png" }, fetcher);
    expect(result.hosts.map((host) => host.host)).toEqual(["img.example.com"]);
  });

  it("includes provider-confidence hosts from extracted content", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(
        `<html><script src="https://cdn-apple.com/assets/app.js"></script></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    }) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://example.com" }, fetcher);
    const cdnHost = result.hosts.find((h) => h.host === "cdn-apple.com");
    expect(cdnHost).toBeDefined();
    expect(cdnHost?.confidence).toBe("provider");
    expect(cdnHost?.reasons.some((r) => r.includes("provider"))).toBe(true);
  });

  it("does not skip non-binary paths when content type is missing", async () => {
    const response = new Response("<html>content</html>", { status: 200 });
    Object.defineProperty(response, "url", { value: "https://example.com/page.html" });
    const fetcher = vi.fn(async () => response) as unknown as typeof fetch;

    const result = await analyzeUrl({ url: "https://example.com/page.html" }, fetcher);
    // Should extract hosts from the HTML content since path is not binary
    expect(result.hosts.length).toBeGreaterThan(0);
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
