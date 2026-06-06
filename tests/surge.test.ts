import { describe, expect, it } from "vitest";
import {
  baseDomain,
  buildSurgeList,
  classifyDomains,
  consolidateDomains,
  dedupeRules,
  extractHostsFromText,
  hostFromUrl,
  isAdOrTracker,
  isChinaSite,
  isIpAddress,
  isRegionSensitive,
  mergeSurgeList,
  normalizeHost,
  normalizeInputUrl,
  parseSurgeList,
  parseSurgeEvidence,
  parseSurgeTrafficHosts,
  resolveUrl,
  ruleForHost,
  scoreHostConfidence,
  confidenceForHost,
  isProviderHost,
  selectHostsByConfidence,
  type ClassifiedDomain,
} from "@/src/lib/surge";

describe("surge domain utilities", () => {
  it("normalizes URLs and hosts", () => {
    expect(normalizeInputUrl("linux.do")).toBe("https://linux.do/");
    expect(normalizeInputUrl("https://linux.do/path#x")).toBe("https://linux.do/path#x");
    expect(normalizeHost("WWW.Example.COM.")).toBe("www.example.com");
    expect(normalizeHost("[2001:db8::1]")).toBe("2001:db8::1");
    expect(normalizeHost("2001:db8::2")).toBe("2001:db8::2");
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

  it("preserves direct, proxy, and blocked evidence without trusting browser reachability", () => {
    const evidence = parseSurgeEvidence(JSON.stringify({
      requests: [
        { remoteHost: "direct.example.com:443", policyName: "DIRECT" },
        { remoteHost: "proxied.example.com:443", remoteAddress: "1.1.1.1:443 (Proxy)", policyName: "Singapore" },
        { remoteHost: "blocked.example.com:443", notes: ["failed direct connection"] },
      ],
    }));

    expect(evidence).toEqual([
      { host: "blocked.example.com", status: "BLOCKED_VERIFIED" },
      { host: "direct.example.com", status: "DIRECT_VERIFIED" },
      { host: "proxied.example.com", status: "PROXY_VERIFIED" },
    ]);
    expect(parseSurgeEvidence(JSON.stringify({ records: [{ URL: "https://records.example.com", policy: "DIRECT" }] }))).toEqual([
      { host: "records.example.com", status: "DIRECT_VERIFIED" },
    ]);
  });

  it("selects target and high-confidence provider hosts while leaving schema and unrelated hosts out", () => {
    const html = `
      <a href="https://podcasts.apple.com/us/podcast/show/id1">show</a>
      <audio src="https://media.typlog.io/show.mp3"></audio>
      <script type="application/ld+json">{"@context":"https://schema.org","url":"https://amazon.com/noise"}</script>
      <a href="https://ximalaya.com/noise">noise</a>
    `;
    const hosts = extractHostsFromText(html, "https://podcasts.apple.com/us/podcast/show/id1");
    const scored = selectHostsByConfidence(hosts, "https://podcasts.apple.com/us/podcast/show/id1");
    const byHost = Object.fromEntries(scored.map((item) => [item.host, item]));

    expect(hosts).toContain("podcasts.apple.com");
    expect(hosts).toContain("media.typlog.io");
    expect(hosts).not.toContain("schema.org");
    expect(hosts).not.toContain("amazon.com");
    expect(hosts).not.toContain("ximalaya.com");
    expect(byHost["podcasts.apple.com"].selected).toBe(true);
    expect(byHost["media.typlog.io"].selected).toBe(true);
  });

  it("scores runtime confidence without selecting unrelated noise", () => {
    expect(scoreHostConfidence("", "example.com")).toBe(0);
    expect(scoreHostConfidence("api.other-service.net", "example.com")).toBe(65);
    expect(scoreHostConfidence("a.deep.example.com", "www.example.com")).toBe(90);
    expect(confidenceForHost("media.typlog.io", "https://podcasts.apple.com/show")).toBe("provider");
    expect(isProviderHost("")).toBe(false);
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
    // New expanded suffix list entries
    expect(isAdOrTracker("cdn.segment.com")).toBe(true);
    expect(isAdOrTracker("app.sentry.io")).toBe(true);
    expect(isAdOrTracker("cdn.tiktokcdn.com")).toBe(true);
    expect(isAdOrTracker("analytics.datadoghq.com")).toBe(true);
    // Keyword-based detection in subdomains
    expect(isAdOrTracker("ads.example.com")).toBe(true);
    expect(isAdOrTracker("tracking.example.com")).toBe(true);
    expect(isAdOrTracker("analytics.example.com")).toBe(true);
    expect(isAdOrTracker("pixel.example.com")).toBe(true);
    expect(isAdOrTracker("beacon.example.com")).toBe(true);
    expect(isAdOrTracker("telemetry.example.com")).toBe(true);
    expect(isAdOrTracker("counter.example.com")).toBe(true);
    expect(isAdOrTracker("click.example.com")).toBe(true);
    expect(isAdOrTracker("tracker.example.com")).toBe(true);
    expect(isAdOrTracker("tracking.example.com")).toBe(true);
    expect(isAdOrTracker("cookie.example.com")).toBe(true);
    expect(isAdOrTracker("consent.example.com")).toBe(true);
    expect(isAdOrTracker("retarget.example.com")).toBe(true);
    expect(isAdOrTracker("adtrack.example.com")).toBe(true);
    expect(isAdOrTracker("popup.example.com")).toBe(true);
    expect(isAdOrTracker("fingerprint.example.com")).toBe(true);
    expect(isAdOrTracker("pixel.example.com")).toBe(true);
    expect(isAdOrTracker("tagmanager.example.com")).toBe(true);
    // Should not match base domain labels
    expect(isAdOrTracker("example.com")).toBe(false);
    expect(isAdOrTracker("api.example.com")).toBe(false);
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
    expect(buildSurgeList([], { title: "", source: "https://example.com", mode: "suffix", generatedAt: "now" }).text).toContain("# NAME: SurgeRules");
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

  it("consolidates domains into groups by category and baseDomain", () => {
    const domains = classifyDomains(
      ["google.com", "apis.google.com", "mail.google.com", "accounts.google.com", "baidu.com", "www.baidu.com"],
      [],
      "suffix",
    );
    const groups = consolidateDomains(domains);

    const googleGroup = groups.find((g) => g.baseDomain === "google.com");
    expect(googleGroup).toBeDefined();
    expect(googleGroup!.category).toBe("region-sensitive");
    expect(googleGroup!.domains.length).toBe(4);
    expect(googleGroup!.parentDomain?.host).toBe("google.com");

    const baiduGroup = groups.find((g) => g.baseDomain === "baidu.com");
    expect(baiduGroup).toBeDefined();
    expect(baiduGroup!.category).toBe("direct-cn");
    expect(baiduGroup!.domains.length).toBe(2);
  });

  it("keeps cross-category domains in separate groups", () => {
    const domains = classifyDomains(
      ["apple.com", "developer.apple.com", "doubleclick.net", "ads.doubleclick.net"],
      [],
      "suffix",
    );
    const groups = consolidateDomains(domains);

    const appleGroup = groups.find((g) => g.baseDomain === "apple.com" && g.category === "region-sensitive");
    const adGroup = groups.find((g) => g.baseDomain === "doubleclick.net" && g.category === "ad-tracking");

    expect(appleGroup).toBeDefined();
    expect(appleGroup!.domains.length).toBe(2);

    expect(adGroup).toBeDefined();
    expect(adGroup!.domains.length).toBe(2);
  });

  it("handles empty domain list in consolidation", () => {
    const groups = consolidateDomains([]);
    expect(groups).toEqual([]);
  });

  it("handles single-domain groups in consolidation", () => {
    const domains = classifyDomains(["example.com"], [], "suffix");
    const groups = consolidateDomains(domains);
    expect(groups.length).toBe(1);
    expect(groups[0].domains.length).toBe(1);
    expect(groups[0].parentDomain?.host).toBe("example.com");
  });

  it("classifies domains with empty and invalid hosts gracefully", () => {
    const domains = classifyDomains(["", "  ", "valid.com", "bad host"], [], "suffix");
    const byHost = Object.fromEntries(domains.map((d) => [d.host, d]));
    expect(byHost["valid.com"]).toBeDefined();
    expect(Object.keys(byHost)).not.toContain("");
    expect(Object.keys(byHost)).not.toContain("bad host");
  });

  it("extracts hosts from edge-case HTML patterns", () => {
    // srcset with empty entries
    expect(extractHostsFromText('<img srcset="" />', "https://base.com")).toEqual(["base.com"]);
    // CSS url() with empty value
    expect(extractHostsFromText('body { background: url() }', "https://base.com")).toEqual(["base.com"]);
    // @import with empty value
    expect(extractHostsFromText('@import ""', "https://base.com")).toEqual(["base.com"]);
    // protocol-relative URL
    expect(extractHostsFromText('//cdn.example.com/app.js', "https://base.com")).toEqual(["base.com", "cdn.example.com"]);
    // bare domain with port
    expect(extractHostsFromText("api.example.com:8080", "https://base.com")).toEqual(["base.com", "api.example.com"]);
    // meta refresh
    expect(extractHostsFromText('<meta content="0; url=https://redirect.example.com">', "https://base.com")).toEqual(["base.com", "redirect.example.com"]);
    // meta refresh with quotes
    expect(extractHostsFromText('<meta content="0; url=\'https://redirect.example.com\'">', "https://base.com")).toEqual(["base.com", "redirect.example.com"]);
  });

  it("handles resolveUrl edge cases", () => {
    expect(resolveUrl("", "https://example.com")).toBe("");
    expect(resolveUrl("  ", "https://example.com")).toBe("");
    expect(resolveUrl(null as unknown as string, "https://example.com")).toBe("");
    expect(resolveUrl(undefined as unknown as string, "https://example.com")).toBe("");
    expect(resolveUrl("javascript:alert(1)", "https://example.com")).toBe("");
    expect(resolveUrl("mailto:test@example.com", "https://example.com")).toBe("");
    expect(resolveUrl("tel:+1234567890", "https://example.com")).toBe("");
    expect(resolveUrl("data:text/html,<h1>hi</h1>", "https://example.com")).toBe("");
    expect(resolveUrl("blob:https://example.com/id", "https://example.com")).toBe("");
    // ftp protocol (parsed but not http/https)
    expect(resolveUrl("ftp://files.example.com/doc", "https://example.com")).toBe("");
    // bare domain
    expect(resolveUrl("api.example.com/v1", "https://example.com")).toBe("https://api.example.com/v1");
    // bare domain with port
    expect(resolveUrl("api.example.com:8080/v1", "https://example.com")).toBe("https://api.example.com:8080/v1");
  });

  it("detects IPv4 and IPv6 addresses correctly", () => {
    expect(isIpAddress("192.168.1.1")).toBe(true);
    expect(isIpAddress("0.0.0.0")).toBe(true);
    expect(isIpAddress("255.255.255.255")).toBe(true);
    expect(isIpAddress("2001:db8::1")).toBe(true);
    expect(isIpAddress("::1")).toBe(true);
    expect(isIpAddress("fe80::1")).toBe(true);
    expect(isIpAddress("example.com")).toBe(false);
    expect(isIpAddress("")).toBe(false);
    expect(isIpAddress("abc.def.ghi.jkl")).toBe(false);
  });

  it("handles baseDomain edge cases", () => {
    expect(baseDomain("")).toBe("");
    expect(baseDomain("localhost")).toBe("localhost");
    expect(baseDomain("a.b.c.d.example.com")).toBe("example.com");
    expect(baseDomain("sub.example.co.uk")).toBe("example.co.uk");
    expect(baseDomain("deeply.nested.sub.example.com.cn")).toBe("example.com.cn");
  });

  it("handles isDeniedHost and isAdOrTracker edge cases", () => {
    expect(isChinaSite("")).toBe(false);
    expect(isChinaSite("example.com")).toBe(false);
    expect(isRegionSensitive("")).toBe(false);
    expect(isRegionSensitive("unknown.com")).toBe(false);
    expect(isAdOrTracker("")).toBe(false);
    expect(isAdOrTracker("normal.com")).toBe(false);
    expect(isProviderHost("unknown.com")).toBe(false);
  });

  it("handles scoreHostConfidence edge cases", () => {
    expect(scoreHostConfidence("", "")).toBe(0);
    expect(scoreHostConfidence("example.com", "")).toBe(0);
    expect(scoreHostConfidence("", "example.com")).toBe(0);
    // provider host
    expect(scoreHostConfidence("cdn-apple.com", "example.com")).toBe(70);
    // runtime keyword host
    expect(scoreHostConfidence("api.example.com", "other.com")).toBe(65);
    // same base domain
    expect(scoreHostConfidence("www.example.com", "example.com")).toBe(90);
    // noise (default)
    expect(scoreHostConfidence("unrelated.org", "example.com")).toBe(40);
  });

  it("handles confidenceForHost edge cases", () => {
    expect(confidenceForHost("", "https://example.com")).toBe("noise");
    expect(confidenceForHost("cdn-apple.com", "https://example.com")).toBe("provider");
    expect(confidenceForHost("media.typlog.io", "https://example.com")).toBe("provider");
  });

  it("handles selectHostsByConfidence edge cases", () => {
    const result = selectHostsByConfidence([], "https://example.com");
    expect(result).toEqual([]);
    const single = selectHostsByConfidence(["example.com"], "https://example.com");
    expect(single[0].selected).toBe(true);
    expect(single[0].score).toBe(100);
  });

  it("handles parseSurgeEvidence edge cases", () => {
    expect(parseSurgeEvidence("")).toEqual([]);
    expect(parseSurgeEvidence("  ")).toEqual([]);
    expect(parseSurgeEvidence("null")).toEqual([]);
    expect(parseSurgeEvidence(JSON.stringify({}))).toEqual([]);
    expect(parseSurgeEvidence(JSON.stringify({ requests: [] }))).toEqual([]);
    expect(parseSurgeEvidence(JSON.stringify({ records: [] }))).toEqual([]);
    expect(parseSurgeEvidence(JSON.stringify({ logs: [] }))).toEqual([]);
    // nested arrays
    expect(parseSurgeEvidence(JSON.stringify([["nested.example.com"]]))).toEqual([
      { host: "nested.example.com", status: "UNKNOWN" },
    ]);
    // object with nested domain
    expect(parseSurgeEvidence(JSON.stringify([{ other: { domain: "deep.example.net" } }]))).toEqual([
      { host: "deep.example.net", status: "UNKNOWN" },
    ]);
  });

  it("handles parseSurgeList and mergeSurgeList edge cases", () => {
    expect(parseSurgeList("")).toEqual([]);
    expect(parseSurgeList("# comment only")).toEqual([]);
    expect(parseSurgeList("FINAL,DIRECT")).toEqual([]);
    expect(parseSurgeList("DOMAIN,example.com")).toEqual(["DOMAIN,example.com"]);
    expect(mergeSurgeList("", "")).toContain("# RULES: 0");
    expect(mergeSurgeList("DOMAIN,a.com\n", "DOMAIN,b.com\n")).toContain("DOMAIN,a.com");
  });

  it("handles buildSurgeList edge cases", () => {
    const empty = buildSurgeList([], { title: "", source: "", mode: "suffix" });
    expect(empty.text).toContain("# RULES: 0");
    expect(empty.groups["direct-cn"]).toEqual([]);
    expect(empty.groups["proxy-global"]).toEqual([]);
  });

  it("handles normalizeHost and hostFromUrl edge cases", () => {
    expect(normalizeHost("")).toBe("");
    expect(normalizeHost("  ")).toBe("");
    expect(normalizeHost("bad host")).toBe("");
    expect(normalizeHost("UPPER.CASE")).toBe("upper.case");
    expect(normalizeHost("trailing.dot.")).toBe("trailing.dot");
    expect(hostFromUrl("not-a-url")).toBe("");
    expect(hostFromUrl("")).toBe("");
  });

  it("handles ruleForHost edge cases", () => {
    expect(ruleForHost("", "suffix")).toBe("");
    expect(ruleForHost("", "exact")).toBe("");
    expect(ruleForHost("localhost", "suffix")).toBe("DOMAIN,localhost");
    expect(ruleForHost("192.168.0.1", "suffix")).toBe("DOMAIN,192.168.0.1");
    expect(ruleForHost("192.168.0.1", "exact")).toBe("DOMAIN,192.168.0.1");
    expect(ruleForHost("example.com", "suffix")).toBe("DOMAIN,example.com");
    expect(ruleForHost("sub.example.com", "suffix")).toBe("DOMAIN-SUFFIX,example.com");
    expect(ruleForHost("sub.example.co.uk", "suffix")).toBe("DOMAIN-SUFFIX,example.co.uk");
    expect(ruleForHost("a.b.c.example.com", "exact")).toBe("DOMAIN,a.b.c.example.com");
  });

  it("merges evidence with different statuses for same host", () => {
    const evidence = parseSurgeEvidence(JSON.stringify({
      requests: [
        { remoteHost: "mixed.example.com:443", policyName: "DIRECT" },
        { remoteHost: "mixed.example.com:443", notes: ["failed"] },
      ],
    }));
    // BLOCKED should win over DIRECT (higher rank)
    expect(evidence.find((e) => e.host === "mixed.example.com")?.status).toBe("BLOCKED_VERIFIED");
  });

  it("handles classifyDomains with evidence and blocked hosts", () => {
    const domains = classifyDomains(
      ["direct.example.com", "proxy.example.com", "blocked.example.com", "unknown.example.com"],
      ["blocked.example.com"],
      "suffix",
      [
        { host: "direct.example.com", status: "DIRECT_VERIFIED" },
        { host: "proxy.example.com", status: "PROXY_VERIFIED" },
      ],
    );
    const byHost = Object.fromEntries(domains.map((d) => [d.host, d]));
    expect(byHost["direct.example.com"].category).toBe("direct-cn");
    expect(byHost["proxy.example.com"].category).toBe("proxy-global");
    expect(byHost["blocked.example.com"].category).toBe("blocked");
    expect(byHost["unknown.example.com"].category).toBe("proxy-global");
  });

  it("handles classifyLogText with no matching keywords", () => {
    const evidence = parseSurgeEvidence("some random log text without keywords");
    expect(evidence).toEqual([]);
  });

  it("classifies proxy evidence without parentheses", () => {
    const evidence = parseSurgeEvidence("proxy.example.com connected via proxy");
    expect(evidence.find((e) => e.host === "proxy.example.com")?.status).toBe("PROXY_VERIFIED");
  });

  it("classifies direct evidence from plain text logs", () => {
    const evidence = parseSurgeEvidence("direct.example.com direct connection");
    expect(evidence.find((e) => e.host === "direct.example.com")?.status).toBe("DIRECT_VERIFIED");
  });

  it("handles stringifyRecordValue with object values", () => {
    const evidence = parseSurgeEvidence(JSON.stringify({
      requests: [{ remoteHost: "test.example.com:443", notes: { key: "value" } }],
    }));
    expect(evidence.length).toBeGreaterThan(0);
  });

  it("handles consolidateDomains with mixed categories", () => {
    const domains = classifyDomains(
      ["apple.com", "developer.apple.com", "icloud.com", "www.icloud.com"],
      [],
      "suffix",
    );
    const groups = consolidateDomains(domains);
    // apple.com and icloud.com are different base domains, both region-sensitive
    const appleGroup = groups.find((g) => g.baseDomain === "apple.com");
    const icloudGroup = groups.find((g) => g.baseDomain === "icloud.com");
    expect(appleGroup).toBeDefined();
    expect(icloudGroup).toBeDefined();
    expect(appleGroup!.domains.length).toBe(2);
    expect(icloudGroup!.domains.length).toBe(2);
  });
});
