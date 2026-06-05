import { describe, expect, it } from "vitest";
import {
  baseDomain,
  buildSurgeList,
  classifyDomains,
  dedupeRules,
  extractHostsFromText,
  isAdOrTracker,
  isChinaSite,
  isRegionSensitive,
  mergeSurgeList,
  normalizeHost,
  normalizeInputUrl,
  parseSurgeList,
  parseSurgeTrafficHosts,
  resolveUrl,
  ruleForHost,
  type ClassifiedDomain,
} from "@/src/lib/surge";

describe("surge domain utilities", () => {
  it("normalizes URLs and hosts", () => {
    expect(normalizeInputUrl("linux.do")).toBe("https://linux.do/");
    expect(normalizeInputUrl("https://linux.do/path#x")).toBe("https://linux.do/path#x");
    expect(normalizeHost("WWW.Example.COM.")).toBe("www.example.com");
    expect(() => normalizeInputUrl("")).toThrow("URL is required");
  });

  it("resolves crawlable URLs and rejects non-network schemes", () => {
    expect(resolveUrl("/app.js", "https://example.com/a/")).toBe("https://example.com/app.js");
    expect(resolveUrl("//cdn.example.com/a.css", "https://example.com")).toBe("https://cdn.example.com/a.css");
    expect(resolveUrl("api.example.com/v1", "https://example.com")).toBe("https://api.example.com/v1");
    expect(resolveUrl("mailto:test@example.com", "https://example.com")).toBe("");
    expect(resolveUrl("http://[bad", "https://example.com")).toBe("");
  });

  it("extracts hosts from HTML, CSS, srcset, meta refresh, and bare domains", () => {
    const html = `
      <meta content="0; url=https://login.example.net/home">
      <script src="/app.js"></script>
      <img srcset="https://img.example.com/a.png 1x, https://img2.example.com/a.png 2x">
      <style>@import "https://static.example.org/app.css"; body{background:url(//cdn.example.org/bg.png)}</style>
      window.api = "api.service.test";
      schema.org should be ignored.
    `;
    expect(extractHostsFromText(html, "https://www.example.com")).toEqual([
      "api.service.test",
      "cdn.example.org",
      "img.example.com",
      "img2.example.com",
      "login.example.net",
      "static.example.org",
      "www.example.com",
    ]);
  });

  it("parses Surge JSON and loose logs into hosts", () => {
    const json = JSON.stringify({
      requests: [
        { remoteHost: "api.apple.com:443", URL: "https://ignored.test" },
        { URL: "https://doubleclick.net/ad" },
      ],
    });
    expect(parseSurgeTrafficHosts(json)).toEqual(["doubleclick.net", "ignored.test", "api.apple.com"]);
    expect(parseSurgeTrafficHosts("blocked cdn.example.com:443 and https://track.example.net/a")).toEqual([
      "cdn.example.com",
      "track.example.net",
    ]);
    expect(parseSurgeTrafficHosts("")).toEqual([]);
    expect(parseSurgeTrafficHosts(JSON.stringify([["nested.example.com"], { other: { domain: "deep.example.net" } }]))).toEqual([
      "deep.example.net",
      "nested.example.com",
    ]);
  });

  it("classifies domestic, global, region-sensitive, blocked, and tracker domains", () => {
    const domains = classifyDomains(
      ["www.qq.com", "developer.apple.com", "api.openai.com", "stats.doubleclick.net", "blocked.example.com"],
      ["blocked.example.com"],
      "suffix",
    );
    const byHost = Object.fromEntries(domains.map((domain) => [domain.host, domain]));
    expect(byHost["www.qq.com"].category).toBe("direct-cn");
    expect(byHost["developer.apple.com"].category).toBe("region-sensitive");
    expect(byHost["api.openai.com"].category).toBe("proxy-global");
    expect(byHost["stats.doubleclick.net"].category).toBe("ad-tracking");
    expect(byHost["blocked.example.com"].category).toBe("blocked");
  });

  it("detects base domain categories and suffix rules", () => {
    expect(baseDomain("localhost")).toBe("localhost");
    expect(baseDomain("a.b.example.com.cn")).toBe("example.com.cn");
    expect(ruleForHost("api.example.com", "exact")).toBe("DOMAIN,api.example.com");
    expect(ruleForHost("api.example.com", "suffix")).toBe("DOMAIN-SUFFIX,example.com");
    expect(ruleForHost("a.b.example.com.cn", "suffix")).toBe("DOMAIN-SUFFIX,example.com.cn");
    expect(ruleForHost("example.com", "suffix")).toBe("DOMAIN,example.com");
    expect(ruleForHost("localhost", "suffix")).toBe("DOMAIN,localhost");
    expect(ruleForHost("", "suffix")).toBe("");
    expect(ruleForHost("192.168.0.1", "suffix")).toBe("DOMAIN,192.168.0.1");
    expect(isChinaSite("news.gov.cn")).toBe(true);
    expect(isChinaSite("8.8.8.8")).toBe(false);
    expect(isRegionSensitive("store.apple.com")).toBe(true);
    expect(isAdOrTracker("events.hotjar.com")).toBe(true);
    expect(isAdOrTracker("127.0.0.1")).toBe(false);
  });

  it("builds grouped Surge list text with selected rules only", () => {
    const domains = classifyDomains(["www.qq.com", "api.openai.com", "doubleclick.net"], [], "suffix");
    const edited: ClassifiedDomain[] = domains.map((domain) =>
      domain.host === "doubleclick.net" ? { ...domain, selected: false } : domain,
    );
    const list = buildSurgeList(edited, {
      title: "Example\nBad",
      source: "https://example.com\nbad",
      mode: "suffix",
      generatedAt: "2026-06-05 00:00:00 UTC",
    });
    expect(list.text).toContain("# NAME: Example Bad");
    expect(list.text).toContain("# 国内直连");
    expect(list.text).toContain("DOMAIN-SUFFIX,qq.com");
    expect(list.text).toContain("DOMAIN-SUFFIX,openai.com");
    expect(list.text).not.toContain("doubleclick.net");
  });

  it("parses, dedupes, and merges Surge list files", () => {
    expect(parseSurgeList("# comment\nDOMAIN,example.com\nFINAL,DIRECT\nDOMAIN-SUFFIX,example.com")).toEqual([
      "DOMAIN,example.com",
      "DOMAIN-SUFFIX,example.com",
    ]);
    expect(dedupeRules(["DOMAIN,b.com", "DOMAIN,a.com", "DOMAIN,b.com"])).toEqual(["DOMAIN,a.com", "DOMAIN,b.com"]);
    const merged = mergeSurgeList("DOMAIN,old.com\n", "DOMAIN,new.com\nDOMAIN,old.com\n");
    expect(merged).toContain("DOMAIN,new.com");
    expect(merged.match(/DOMAIN,old.com/g)).toHaveLength(1);
  });

  it("filters invalid bare domain candidates and empty extraction input", () => {
    expect(extractHostsFromText("", "https://empty.example.com")).toEqual(["empty.example.com"]);
    expect(
      extractHostsFromText("window.api 1.2.3.4 file.bundle.ico file.bundle.js schema.org valid.example.com", "https://base.example.com"),
    ).toEqual(["base.example.com", "valid.example.com"]);
    expect(normalizeHost("bad host")).toBe("");
  });
});
