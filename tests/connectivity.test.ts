import { describe, expect, it, vi } from "vitest";
import {
  batchCheckConnectivity,
  checkConnectivity,
  ipToLong,
  isChinaIp,
  resolveDns,
} from "@/src/lib/connectivity";

describe("connectivity utilities", () => {
  it("converts IPv4 to long and checks Chinese IP ranges", () => {
    expect(ipToLong("0.0.0.0")).toBe(0);
    expect(ipToLong("192.168.1.1")).toBe(0xc0a80101);
    expect(ipToLong("10.0.0.1")).toBe(0x0a000001);
    expect(ipToLong("255.255.255.255")).toBe(0xffffffff);
    expect(ipToLong("bad")).toBe(0);
    expect(ipToLong("999.999.999.999")).toBe(0);

    expect(isChinaIp("114.64.1.1")).toBe(true);
    expect(isChinaIp("222.128.1.1")).toBe(true);
    expect(isChinaIp("8.8.8.8")).toBe(false);
    expect(isChinaIp("1.1.1.1")).toBe(false);
    expect(isChinaIp("bad")).toBe(false);
  });

  it("resolves DNS via Cloudflare DoH", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("cloudflare-dns.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [
            { name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" },
          ],
        }));
      }
      return new Response("", { status: 500 });
    });

    const ips = await resolveDns("example.com", fetcher);
    expect(ips).toEqual(["93.184.216.34"]);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("falls back to Google DoH when Cloudflare fails", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("cloudflare-dns.com")) {
        return new Response("", { status: 500 });
      }
      if (url.includes("dns.google")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [
            { name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" },
          ],
        }));
      }
      return new Response("", { status: 500 });
    });

    const ips = await resolveDns("example.com", fetcher);
    expect(ips).toEqual(["93.184.216.34"]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("returns empty array when both DNS resolvers fail", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 500 }));
    const ips = await resolveDns("nonexistent.invalid", fetcher);
    expect(ips).toEqual([]);
  });

  it("classifies Chinese TLD domains as direct", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("cloudflare-dns.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "baidu.cn", type: 1, TTL: 300, data: "220.181.38.148" }],
        }));
      }
      return new Response("", { status: 500 });
    });

    const result = await checkConnectivity("baidu.cn", fetcher);
    expect(result.status).toBe("direct");
    expect(result.isChinaIp).toBe(true);
    expect(result.reason).toBe("Chinese TLD domain");
  });

  it("classifies domains resolving to Chinese IPs as likely-direct", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("cloudflare-dns.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "baidu.com", type: 1, TTL: 300, data: "220.181.38.148" }],
        }));
      }
      return new Response("", { status: 500 });
    });

    const result = await checkConnectivity("baidu.com", fetcher);
    expect(result.status).toBe("likely-direct");
    expect(result.isChinaIp).toBe(true);
    expect(result.reason).toContain("220.181.38.148");
  });

  it("classifies domains resolving to non-Chinese IPs as likely-proxy", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("cloudflare-dns.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "google.com", type: 1, TTL: 300, data: "142.250.80.46" }],
        }));
      }
      return new Response("", { status: 500 });
    });

    const result = await checkConnectivity("google.com", fetcher);
    expect(result.status).toBe("likely-proxy");
    expect(result.isChinaIp).toBe(false);
    expect(result.reason).toContain("142.250.80.46");
  });

  it("returns unknown when DNS resolution fails", async () => {
    const fetcher = vi.fn(async () => new Response("", { status: 500 }));
    const result = await checkConnectivity("nonexistent.invalid", fetcher);
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("DNS resolution failed");
    expect(result.resolvedIps).toEqual([]);
  });

  it("batch checks multiple hosts concurrently", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("baidu.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "baidu.com", type: 1, TTL: 300, data: "114.64.1.1" }],
        }));
      }
      if (url.includes("google.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "google.com", type: 1, TTL: 300, data: "142.250.80.46" }],
        }));
      }
      return new Response("", { status: 500 });
    });

    const results = await batchCheckConnectivity(["baidu.com", "google.com", ""], fetcher);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("likely-direct");
    expect(results[1].status).toBe("likely-proxy");
  });

  it("deduplicates hosts in batch check", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("cloudflare-dns.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "example.com", type: 1, TTL: 300, data: "93.184.216.34" }],
        }));
      }
      return new Response("", { status: 500 });
    });

    const results = await batchCheckConnectivity(["example.com", "example.com"], fetcher);
    expect(results).toHaveLength(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it("handles DNS failure in batch check", async () => {
    const fetcher = vi.fn(async (url: string) => {
      if (url.includes("good.com")) {
        return new Response(JSON.stringify({
          Status: 0,
          Answer: [{ name: "good.com", type: 1, TTL: 300, data: "93.184.216.34" }],
        }));
      }
      throw new Error("DNS failure");
    });

    const results = await batchCheckConnectivity(["good.com", "bad.com"], fetcher);
    expect(results).toHaveLength(2);
    expect(results[0].status).toBe("likely-proxy");
    expect(results[1].status).toBe("unknown");
    expect(results[1].reason).toBe("DNS resolution failed");
  });

  it("classifies domains with multiple Chinese IPs", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 0,
        Answer: [
          { name: "multi.cn", type: 1, TTL: 300, data: "114.64.1.1" },
          { name: "multi.cn", type: 1, TTL: 300, data: "222.128.1.1" },
        ],
      }));
    });

    const result = await checkConnectivity("multi.cn", fetcher);
    expect(result.status).toBe("direct");
    expect(result.isChinaIp).toBe(true);
    expect(result.resolvedIps).toHaveLength(2);
  });

  it("classifies domains with multiple non-Chinese IPs", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 0,
        Answer: [
          { name: "global.com", type: 1, TTL: 300, data: "142.250.80.46" },
          { name: "global.com", type: 1, TTL: 300, data: "142.250.80.78" },
        ],
      }));
    });

    const result = await checkConnectivity("global.com", fetcher);
    expect(result.status).toBe("likely-proxy");
    expect(result.isChinaIp).toBe(false);
    expect(result.resolvedIps).toHaveLength(2);
  });

  it("handles DNS response with non-A records", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 0,
        Answer: [
          { name: "example.com", type: 28, TTL: 300, data: "2001:db8::1" },
        ],
      }));
    });

    const result = await checkConnectivity("example.com", fetcher);
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("DNS resolution failed");
  });

  it("handles DNS response with non-zero status", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 3, // NXDOMAIN
        Answer: [],
      }));
    });

    const result = await checkConnectivity("nonexistent.example", fetcher);
    expect(result.status).toBe("unknown");
  });

  it("handles DNS response with empty Answer array", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 0,
        Answer: [],
      }));
    });

    const result = await checkConnectivity("no-records.example", fetcher);
    expect(result.status).toBe("unknown");
    expect(result.reason).toBe("DNS resolution failed");
  });

  it("handles DNS response with only AAAA records", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 0,
        Answer: [
          { name: "ipv6.example", type: 28, TTL: 300, data: "2001:db8::1" },
        ],
      }));
    });

    const result = await checkConnectivity("ipv6.example", fetcher);
    expect(result.status).toBe("unknown");
    expect(result.resolvedIps).toEqual([]);
  });

  it("handles DNS response without Answer field", async () => {
    const fetcher = vi.fn(async () => {
      return new Response(JSON.stringify({
        Status: 0,
      }));
    });

    const result = await checkConnectivity("no-answer.example", fetcher);
    expect(result.status).toBe("unknown");
  });
});
