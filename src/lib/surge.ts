export type RuleCategory =
  | "direct-cn"
  | "proxy-global"
  | "region-sensitive"
  | "blocked"
  | "ad-tracking";

export type RuleMode = "exact" | "suffix";

export type EvidenceStatus =
  | "DIRECT_VERIFIED"
  | "PROXY_VERIFIED"
  | "BLOCKED_VERIFIED"
  | "UNKNOWN";

export type HostConfidence = "target" | "provider" | "noise";

export interface ClassifiedDomain {
  host: string;
  category: RuleCategory;
  rule: string;
  reasons: string[];
  score: number;
  selected: boolean;
  evidence: EvidenceStatus;
  confidence: HostConfidence;
}

export interface SurgeList {
  title: string;
  source: string;
  mode: RuleMode;
  generatedAt: string;
  groups: Record<RuleCategory, ClassifiedDomain[]>;
  text: string;
}

export interface DomainGroup {
  baseDomain: string;
  category: RuleCategory;
  domains: ClassifiedDomain[];
  parentDomain?: ClassifiedDomain;
}

export const CATEGORY_LABELS: Record<RuleCategory, string> = {
  "direct-cn": "国内直连",
  "proxy-global": "国外规则",
  "region-sensitive": "区域敏感",
  blocked: "阻断域名",
  "ad-tracking": "广告/推广/跟踪",
};

const COMMON_SECOND_LEVEL_SUFFIXES = new Set([
  "ac.cn",
  "ac.in",
  "ac.jp",
  "ac.kr",
  "ac.nz",
  "ac.uk",
  "ah.cn",
  "asn.au",
  "bj.cn",
  "co.id",
  "co.il",
  "co.in",
  "co.jp",
  "co.kr",
  "co.nz",
  "co.uk",
  "co.za",
  "com.au",
  "com.br",
  "com.cn",
  "com.hk",
  "com.mx",
  "com.sg",
  "com.tr",
  "com.tw",
  "csiro.au",
  "edu.au",
  "edu.cn",
  "edu.hk",
  "firm.in",
  "gen.in",
  "gov.au",
  "gov.cn",
  "gov.hk",
  "gov.in",
  "gov.uk",
  "id.au",
  "idv.tw",
  "info.cn",
  "ltd.uk",
  "me.uk",
  "net.au",
  "net.cn",
  "net.hk",
  "net.in",
  "net.sg",
  "net.tw",
  "nic.in",
  "or.jp",
  "or.kr",
  "org.au",
  "org.cn",
  "org.hk",
  "org.in",
  "org.sg",
  "org.uk",
  "plc.uk",
  "res.in",
  "sa.cn",
  "sch.uk",
  "sh.cn",
  "web.cn",
]);

const AD_TRACKER_SUFFIXES = [
  "doubleclick.net",
  "googlesyndication.com",
  "googleadservices.com",
  "googletagmanager.com",
  "googletagservices.com",
  "google-analytics.com",
  "adservice.google.com",
  "facebook.net",
  "adnxs.com",
  "criteo.com",
  "criteo.net",
  "pubmatic.com",
  "rubiconproject.com",
  "openx.net",
  "taboola.com",
  "outbrain.com",
  "mgid.com",
  "adsrvr.org",
  "adroll.com",
  "rlcdn.com",
  "bidswitch.net",
  "casalemedia.com",
  "3lift.com",
  "segment.io",
  "segment.com",
  "mixpanel.com",
  "amplitude.com",
  "hotjar.com",
  "mouseflow.com",
  "fullstory.com",
  "logrocket.com",
  "newrelic.com",
  "nr-data.net",
  "scorecardresearch.com",
  "quantserve.com",
  "quantcount.com",
  "comscore.com",
  "optimizely.com",
  "crazyegg.com",
  "kissmetrics.com",
  "matomo.cloud",
  "snowplowanalytics.com",
  "mktoresp.com",
  "marketo.net",
  "pardot.com",
  "hsforms.net",
  "hs-analytics.net",
  "hs-scripts.com",
  "clarity.ms",
  "bat.bing.com",
  "ads-twitter.com",
  "analytics.twitter.com",
  "cnzz.com",
  "umeng.com",
  "umengcloud.com",
  "mmstat.com",
  "branch.io",
  "appsflyer.com",
  "adjust.com",
  "singular.net",
  "kochava.com",
  "onesignal.com",
  "braze.com",
  "iterable.com",
  "customer.io",
  "klaviyo.com",
  "intercom.io",
  "intercomcdn.com",
  "drift.com",
  "pendo.io",
  "heap.io",
  "chartbeat.com",
  "parsely.com",
  "bit.ly",
  "bitly.com",
  "t.co",
  "buff.ly",
];

const CN_SUFFIXES = [
  ".cn",
  ".中国",
  ".公司",
  ".网络",
  ".com.cn",
  ".net.cn",
  ".org.cn",
  ".gov.cn",
  ".edu.cn",
];

const CN_BASE_DOMAINS = new Set([
  "baidu.com",
  "bilibili.com",
  "douyin.com",
  "jd.com",
  "mi.com",
  "netease.com",
  "qq.com",
  "taobao.com",
  "tmall.com",
  "weibo.com",
  "xiaohongshu.com",
  "zhihu.com",
]);

const REGION_SENSITIVE_DOMAINS = new Set([
  "apple.com",
  "icloud.com",
  "microsoft.com",
  "msn.com",
  "netflix.com",
  "spotify.com",
  "amazon.com",
  "google.com",
]);

const BARE_DOMAIN_DENYLIST = new Set([
  "amazon.com",
  "example.com",
  "example.net",
  "example.org",
  "schema.org",
  "ximalaya.com",
  "window.api",
  "w3.org",
  "www.w3.org",
]);

const BASE_DOMAIN_DENYLIST = new Set([
  "amazon.com",
  "schema.org",
  "ximalaya.com",
  "w3.org",
]);

const FILE_LIKE_TLDS = new Set([
  "avif",
  "bz2",
  "cjs",
  "css",
  "eot",
  "gif",
  "gz",
  "htm",
  "html",
  "ico",
  "jpeg",
  "jpg",
  "js",
  "json",
  "map",
  "mjs",
  "mp3",
  "mp4",
  "otf",
  "pdf",
  "png",
  "rar",
  "svg",
  "tgz",
  "ttf",
  "txt",
  "wasm",
  "webm",
  "webp",
  "woff",
  "woff2",
  "xml",
  "xz",
  "zip",
]);

const PROVIDER_SUFFIXES = new Set([
  "acast.com",
  "cdn-apple.com",
  "fireside.fm",
  "firstory.me",
  "ghostisland.media",
  "mzstatic.com",
  "omny.fm",
  "omnycontent.com",
  "typlog.io",
  "typlog.com",
  "xyzfm.space",
  "libsyn.com",
  "simplecast.com",
  "anchor.fm",
  "podbean.com",
  "buzzsprout.com",
  "transistor.fm",
  "captivate.fm",
  "spreaker.com",
  "audioboom.com",
  "player.fm",
  "podtrac.com",
  "chartable.com",
  "megaphone.fm",
  "art19.com",
  "redcircle.com",
  "castbox.fm",
  "ivoox.com",
  "podcast.co",
  "rss.com",
  "soundon.fm",
  "pinecast.com",
]);

const RUNTIME_KEYWORDS = /\b(api|asset|assets|audio|cdn|edge|feed|file|image|img|media|play|player|playback|podcast|rss|static|stream|video)\b/;

const CATEGORY_ORDER: RuleCategory[] = [
  "direct-cn",
  "proxy-global",
  "region-sensitive",
  "blocked",
  "ad-tracking",
];

export function normalizeInputUrl(input: string): string {
  const trimmed = String(input || "").trim();
  if (!trimmed) {
    throw new Error("URL is required");
  }
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return new URL(trimmed).toString();
  }
  return new URL(`https://${trimmed}`).toString();
}

export function normalizeHost(hostname: string): string {
  const rawHost = String(hostname || "").trim().toLowerCase().replace(/\.$/, "");
  if (!rawHost) {
    return "";
  }
  const host = rawHost.startsWith("[") && rawHost.endsWith("]")
    ? rawHost.slice(1, -1)
    : rawHost;
  if (isIpAddress(host)) {
    return host;
  }
  if (!/^[a-z0-9.-]+$/.test(host)) {
    return "";
  }
  return host;
}

export function hostFromUrl(rawUrl: string): string {
  try {
    return normalizeHost(new URL(rawUrl).hostname);
  } catch {
    return "";
  }
}

export function isIpAddress(host: string): boolean {
  return /^\d{1,3}(?:\.\d{1,3}){3}$/.test(host) || (/^[0-9a-f:]+$/i.test(host) && host.includes(":"));
}

export function extractCandidates(text: string, baseUrl: string): Set<string> {
  const candidates = new Set<string>();
  if (!text) {
    return candidates;
  }

  const absoluteUrlPattern = /https?:\/\/[^\s"'<>`,;)]+/gi;
  const protocolRelativePattern = /(^|[^a-zA-Z0-9_:-])\/\/[A-Za-z0-9.-]+(?::\d+)?(?:\/[^\s"'<>`]*)?/g;
  const attrPattern = /(?:href|src|action|poster|data-src|data-href|content)\s*=\s*["']([^"']+)["']/gi;
  const srcsetPattern = /srcset\s*=\s*["']([^"']+)["']/gi;
  const cssUrlPattern = /url\(\s*['"]?([^'"()]+)['"]?\s*\)/gi;
  const importPattern = /@import\s+['"]([^'"]+)['"]/gi;
  const bareDomainPattern = /(^|[^A-Za-z0-9@_:/.-])((?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?)(?![A-Za-z0-9-])/gi;

  collectMatches(text, absoluteUrlPattern, candidates, (match) => match[0]);
  collectMatches(text, protocolRelativePattern, candidates, (match) => match[0].replace(/^[^/]*\/\//, "//"));
  collectMatches(text, attrPattern, candidates, (match) => {
    const value = match[1] || "";
    const metaRefreshValue = extractMetaRefreshUrl(value);
    return metaRefreshValue ? [value, metaRefreshValue] : value;
  });
  collectMatches(text, srcsetPattern, candidates, (match) => {
    return (match[1] || "")
      .split(",")
      .map((entry) => entry.trim().split(/\s+/)[0])
      .filter(Boolean);
  });
  collectMatches(text, cssUrlPattern, candidates, (match) => match[1] || "");
  collectMatches(text, importPattern, candidates, (match) => match[1] || "");
  collectMatches(text, bareDomainPattern, candidates, (match) => normalizeBareDomainCandidate((match[2] || "").trim()));

  return new Set(Array.from(candidates).filter((candidate) => resolveUrl(candidate, baseUrl)));
}

export function extractHostsFromText(text: string, baseUrl: string): string[] {
  const hosts = new Set<string>();
  hosts.add(hostFromUrl(baseUrl));
  for (const candidate of extractCandidates(text, baseUrl)) {
    const resolved = resolveUrl(candidate, baseUrl);
    const host = resolved ? hostFromUrl(resolved) : "";
    if (host && !isDeniedHost(host)) {
      hosts.add(host);
    }
  }
  return Array.from(hosts).filter(Boolean).sort(sortHosts);
}

export function resolveUrl(candidate: string, baseUrl: string): string {
  const value = String(candidate || "").trim();
  if (!value || /^(?:javascript|mailto|tel|data|blob):/i.test(value)) {
    return "";
  }
  if (/^(?:[A-Za-z0-9-]+\.)+[A-Za-z]{2,}(?::\d+)?(?:\/.*)?$/.test(value)) {
    return resolveUrl(`https://${value}`, baseUrl);
  }
  try {
    const url = new URL(value, baseUrl);
    if (url.protocol === "http:" || url.protocol === "https:") {
      url.hash = "";
      return url.toString();
    }
    return "";
  } catch {
    return "";
  }
}

export interface SurgeEvidence {
  host: string;
  status: EvidenceStatus;
}

export function parseSurgeEvidence(input: string): SurgeEvidence[] {
  const raw = String(input || "").trim();
  if (!raw) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = raw;
  }

  const records: unknown[] = [];
  if (Array.isArray(parsed)) {
    records.push(...parsed);
  } else if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.requests)) {
      records.push(...obj.requests);
    } else if (Array.isArray(obj.records)) {
      records.push(...obj.records);
    } else if (Array.isArray(obj.logs)) {
      records.push(...obj.logs);
    } else {
      records.push(obj);
    }
  } else {
    records.push(parsed);
  }

  const evidenceMap = new Map<string, EvidenceStatus>();

  for (const record of records) {
    if (Array.isArray(record)) {
      const nestedHosts = new Set<string>();
      collectHostsFromUnknown(record, nestedHosts);
      for (const host of nestedHosts) {
        mergeEvidence(evidenceMap, host, "UNKNOWN");
      }
      continue;
    }

    if (!record || typeof record !== "object") {
      // For plain text logs, scan the whole string for host + marker patterns
      const text = String(record || "");
      for (const host of hostsFromText(text)) {
        const status = classifyLogText(text);
        mergeEvidence(evidenceMap, host, status);
      }
      continue;
    }

    const obj = record as Record<string, unknown>;
    const status = classifyRecord(obj);
    for (const host of extractHostsFromRecord(obj)) {
      mergeEvidence(evidenceMap, host, status);
    }
  }

  return Array.from(evidenceMap.entries())
    .map(([host, status]) => ({ host, status }))
    .sort((a, b) => sortHosts(a.host, b.host));
}

function classifyRecord(obj: Record<string, unknown>): EvidenceStatus {
  const note = stringifyRecordValue(obj.notes || obj.note || obj.error);
  const remoteAddress = stringifyRecordValue(obj.remoteAddress || obj.remote);
  const policyName = stringifyRecordValue(obj.policyName || obj.policy);
  const rule = stringifyRecordValue(obj.rule || obj.ruleName);
  const statusText = stringifyRecordValue(obj.status || obj.result);
  const combined = `${note} ${remoteAddress} ${policyName} ${rule} ${statusText}`;

  if (
    /\b(failed|rejected|reset|timeout|block|drop|blocked)\b/i.test(combined) ||
    /\b(failed|rejected|reset|timeout|block|drop|blocked)\b/i.test(statusText)
  ) {
    return "BLOCKED_VERIFIED";
  }
  if (
    /\(Proxy\)/i.test(combined) ||
    /proxy/i.test(policyName) ||
    /proxy/i.test(rule)
  ) {
    return "PROXY_VERIFIED";
  }
  if (
    /\bdirect\b/i.test(policyName) ||
    /\bdirect\b/i.test(rule) ||
    /\bdirect\b/i.test(combined)
  ) {
    return "DIRECT_VERIFIED";
  }

  return "UNKNOWN";
}

function extractHostsFromRecord(obj: Record<string, unknown>): string[] {
  const hosts = new Set<string>();
  const candidates = [
    obj.remoteHost,
    obj.host,
    obj.domain,
    obj.hostname,
    obj.url,
    obj.URL,
  ];
  for (const candidate of candidates) {
    const value = String(candidate || "").trim();
    if (!value) continue;
    const host = normalizeHost(value.includes("://") ? hostFromUrl(value) : value.replace(/:\d+$/, ""));
    if (host) hosts.add(host);
  }

  collectHostsFromUnknown(obj, hosts);
  return Array.from(hosts).filter(Boolean);
}

function classifyLogText(text: string): EvidenceStatus {
  const t = text.toLowerCase();
  if (/\b(failed|rejected|reset|timeout|block|drop|blocked)\b/.test(t)) return "BLOCKED_VERIFIED";
  if (/\(proxy\)/.test(t) || /\bproxy\b/.test(t)) return "PROXY_VERIFIED";
  if (/\bdirect\b/.test(t)) return "DIRECT_VERIFIED";
  return "UNKNOWN";
}

function stringifyRecordValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.map(stringifyRecordValue).join(" ");
  }
  if (value && typeof value === "object") {
    return JSON.stringify(value);
  }
  return String(value || "");
}

function mergeEvidence(map: Map<string, EvidenceStatus>, host: string, status: EvidenceStatus) {
  const current = map.get(host);
  if (!current) {
    map.set(host, status);
    return;
  }
  // Prefer more specific statuses over UNKNOWN; BLOCKED > PROXY > DIRECT > UNKNOWN
  const rank = (s: EvidenceStatus) =>
    s === "BLOCKED_VERIFIED" ? 4 : s === "PROXY_VERIFIED" ? 3 : s === "DIRECT_VERIFIED" ? 2 : 1;
  if (rank(status) > rank(current)) {
    map.set(host, status);
  }
}

function hostsFromText(text: string): string[] {
  const hosts = new Set<string>();
  const hostPortPattern = /\b(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?(?:[/?#][^\s"']*)?/gi;
  let match: RegExpExecArray | null;
  while ((match = hostPortPattern.exec(text)) !== null) {
    const host = normalizeHost(match[1] || "");
    if (host && !BARE_DOMAIN_DENYLIST.has(host)) {
      hosts.add(host);
    }
  }
  return Array.from(hosts);
}

export function parseSurgeTrafficHosts(input: string): string[] {
  return parseSurgeEvidence(input).map((e) => e.host);
}

export function classifyHost(
  host: string,
  blockedHosts: Set<string> = new Set(),
  evidenceStatus: EvidenceStatus = "UNKNOWN",
): Omit<ClassifiedDomain, "rule"> {
  const normalized = normalizeHost(host);
  const reasons: string[] = [];
  let category: RuleCategory = "proxy-global";
  let score = 50;

  if (evidenceStatus === "BLOCKED_VERIFIED" || blockedHosts.has(normalized)) {
    category = "blocked";
    reasons.push("Surge traffic/log marked it as blocked or captured during a failed direct attempt");
    score = 95;
  } else if (evidenceStatus === "PROXY_VERIFIED") {
    category = "proxy-global";
    reasons.push("Surge evidence shows traffic routed through proxy");
    score = 88;
  } else if (evidenceStatus === "DIRECT_VERIFIED") {
    category = "direct-cn";
    reasons.push("Surge evidence shows direct connection");
    score = 80;
  } else if (isAdOrTracker(normalized)) {
    category = "ad-tracking";
    reasons.push("Matched local ad / analytics / tracker suffix list");
    score = 90;
  } else if (isRegionSensitive(normalized)) {
    category = "region-sensitive";
    reasons.push("Known region-sensitive official site; user should choose DIRECT or PROXY");
    score = 82;
  } else if (isChinaSite(normalized)) {
    category = "direct-cn";
    reasons.push("Matches China TLD or high-confidence domestic base domain");
    score = 78;
  } else {
    reasons.push("Default global rule candidate");
  }

  return {
    host: normalized,
    category,
    reasons,
    score,
    selected: true,
    evidence: evidenceStatus,
    confidence: "noise",
  };
}

export function classifyDomains(
  hosts: string[],
  blockedHosts: string[] = [],
  mode: RuleMode = "suffix",
  evidence: SurgeEvidence[] = [],
): ClassifiedDomain[] {
  const blocked = new Set(blockedHosts.map(normalizeHost).filter(Boolean));
  const evidenceMap = new Map(evidence.map((e) => [normalizeHost(e.host), e.status]));
  const seen = new Map<string, ClassifiedDomain>();

  for (const host of hosts) {
    const normalized = normalizeHost(host);
    if (!normalized) {
      continue;
    }
    const evidenceStatus = evidenceMap.get(normalized) || "UNKNOWN";
    const classified = classifyHost(normalized, blocked, evidenceStatus);
    seen.set(normalized, {
      ...classified,
      rule: ruleForHost(normalized, mode),
    });
  }

  return Array.from(seen.values()).sort((a, b) => {
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return byCategory || sortHosts(a.host, b.host);
  });
}

export function consolidateDomains(domains: ClassifiedDomain[]): DomainGroup[] {
  const groupMap = new Map<string, DomainGroup>();

  for (const domain of domains) {
    const base = baseDomain(domain.host);
    const key = `${domain.category}::${base}`;
    let group = groupMap.get(key);
    if (!group) {
      group = { baseDomain: base, category: domain.category, domains: [] };
      groupMap.set(key, group);
    }
    group.domains.push(domain);
    if (domain.host === base) {
      group.parentDomain = domain;
    }
  }

  const groups = Array.from(groupMap.values());
  groups.sort((a, b) => {
    const byCategory = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
    return byCategory || sortHosts(a.baseDomain, b.baseDomain);
  });

  for (const group of groups) {
    group.domains.sort((a, b) => {
      if (a.host === group.baseDomain) return -1;
      if (b.host === group.baseDomain) return 1;
      return sortHosts(a.host, b.host);
    });
  }

  return groups;
}

export function scoreHostConfidence(host: string, inputHost: string): number {
  const normalized = normalizeHost(host);
  const input = normalizeHost(inputHost);
  if (!normalized || !input) return 0;

  // Exact match or root domain of input
  if (normalized === input) return 100;
  if (baseDomain(normalized) === baseDomain(input)) return 90;
  if (normalized.endsWith(`.${baseDomain(input)}`)) return 85;

  // Provider/runtime hosts
  if (isProviderHost(normalized)) return 70;

  // Known CDN / media / API patterns
  if (RUNTIME_KEYWORDS.test(normalized)) {
    return 65;
  }

  return 40;
}

export function confidenceForHost(host: string, inputUrl: string): HostConfidence {
  const inputHost = hostFromUrl(inputUrl);
  const score = scoreHostConfidence(host, inputHost);
  if (score >= 85) {
    return "target";
  }
  if (score >= 65) {
    return "provider";
  }
  return "noise";
}

export function isProviderHost(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized) return false;
  return PROVIDER_SUFFIXES.has(normalized) || PROVIDER_SUFFIXES.has(baseDomain(normalized));
}

export function selectHostsByConfidence(
  hosts: string[],
  inputUrl: string,
): Array<{ host: string; selected: boolean; score: number }> {
  const inputHost = hostFromUrl(inputUrl);
  const scored = hosts.map((host) => ({
    host,
    score: scoreHostConfidence(host, inputHost),
  }));

  // Always select target host and high-confidence provider/runtime hosts
  return scored.map(({ host, score }) => ({
    host,
    score,
    selected: score >= 65,
  }));
}

export function buildSurgeList(
  domains: ClassifiedDomain[],
  options: { title: string; source: string; mode: RuleMode; generatedAt?: string },
): SurgeList {
  const groups = emptyGroups();
  const selected = domains.filter((domain) => domain.selected);
  for (const domain of selected) {
    groups[domain.category].push({
      ...domain,
      rule: ruleForHost(domain.host, options.mode),
    });
  }

  const lines = [
    `# NAME: ${sanitizeHeaderValue(options.title || "SurgeRules")}`,
    `# SOURCE: ${sanitizeHeaderValue(options.source)}`,
    `# UPDATED: ${options.generatedAt || new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC"}`,
    `# MODE: ${options.mode}`,
    `# FORMAT: surge`,
    `# RULES: ${selected.length}`,
  ];

  for (const category of CATEGORY_ORDER) {
    const rules = dedupeRules(groups[category].map((domain) => ruleForHost(domain.host, options.mode)));
    if (rules.length === 0) {
      continue;
    }
    lines.push("", `# ${CATEGORY_LABELS[category]}`);
    lines.push(...rules);
  }

  return {
    title: options.title,
    source: options.source,
    mode: options.mode,
    generatedAt: options.generatedAt || new Date().toISOString(),
    groups,
    text: `${lines.join("\n")}\n`,
  };
}

export function ruleForHost(host: string, mode: RuleMode): string {
  const normalized = normalizeHost(host);
  if (!normalized) {
    return "";
  }
  if (mode === "exact" || isIpAddress(normalized) || normalized === "localhost") {
    return `DOMAIN,${normalized}`;
  }
  const labels = normalized.split(".").filter(Boolean);
  if (labels.length <= 2) {
    return `DOMAIN,${normalized}`;
  }
  const twoLabelSuffix = labels.slice(-2).join(".");
  if (COMMON_SECOND_LEVEL_SUFFIXES.has(twoLabelSuffix) && labels.length >= 3) {
    return `DOMAIN-SUFFIX,${labels.slice(-3).join(".")}`;
  }
  return `DOMAIN-SUFFIX,${twoLabelSuffix}`;
}

export function parseSurgeList(text: string): string[] {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .filter((line) => /^(DOMAIN|DOMAIN-SUFFIX|DOMAIN-KEYWORD|IP-CIDR|IP-CIDR6),/i.test(line));
}

export function mergeSurgeList(existingText: string, newText: string): string {
  const existingRules = parseSurgeList(existingText);
  const newRules = parseSurgeList(newText);
  const merged = dedupeRules([...existingRules, ...newRules]);
  const header = [
    "# NAME: SurgeRulesMerged",
    "# UPDATED: " + new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC",
    "# FORMAT: surge",
    `# RULES: ${merged.length}`,
  ];
  return `${header.join("\n")}\n${merged.join("\n")}\n`;
}

export function isAdOrTracker(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized || isIpAddress(normalized)) {
    return false;
  }
  return AD_TRACKER_SUFFIXES.some((suffix) => normalized === suffix || normalized.endsWith(`.${suffix}`));
}

export function isChinaSite(host: string): boolean {
  const normalized = normalizeHost(host);
  if (!normalized || isIpAddress(normalized)) {
    return false;
  }
  if (CN_SUFFIXES.some((suffix) => normalized.endsWith(suffix))) {
    return true;
  }
  const base = baseDomain(normalized);
  return CN_BASE_DOMAINS.has(base);
}

export function isRegionSensitive(host: string): boolean {
  const normalized = normalizeHost(host);
  const base = baseDomain(normalized);
  return REGION_SENSITIVE_DOMAINS.has(base);
}

export function baseDomain(host: string): string {
  const normalized = normalizeHost(host);
  const labels = normalized.split(".").filter(Boolean);
  if (labels.length <= 2) {
    return normalized;
  }
  const twoLabelSuffix = labels.slice(-2).join(".");
  if (COMMON_SECOND_LEVEL_SUFFIXES.has(twoLabelSuffix) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return twoLabelSuffix;
}

export function dedupeRules(rules: string[]): string[] {
  return Array.from(new Set(rules.map((rule) => rule.trim()).filter(Boolean))).sort();
}

function emptyGroups(): Record<RuleCategory, ClassifiedDomain[]> {
  return {
    "direct-cn": [],
    "proxy-global": [],
    "region-sensitive": [],
    blocked: [],
    "ad-tracking": [],
  };
}

function collectMatches(
  text: string,
  pattern: RegExp,
  candidates: Set<string>,
  mapMatch: (match: RegExpExecArray) => string | string[],
) {
  pattern.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text)) !== null) {
    const values = mapMatch(match);
    for (const value of Array.isArray(values) ? values : [values]) {
      if (value) {
        candidates.add(value.trim());
      }
    }
  }
}

function extractMetaRefreshUrl(value: string): string {
  const match = /(?:^|;)\s*url\s*=\s*([^;]+)/i.exec(String(value || ""));
  return match ? match[1].trim().replace(/^['"]|['"]$/g, "") : "";
}

function normalizeBareDomainCandidate(value: string): string {
  const candidate = String(value || "").trim().toLowerCase().replace(/\.$/, "");
  if (!candidate) {
    return "";
  }
  const host = candidate.replace(/:\d+$/, "");
  if (!/^[a-z0-9.-]+$/.test(host) || BARE_DOMAIN_DENYLIST.has(host)) {
    return "";
  }
  const labels = host.split(".").filter(Boolean);
  if (labels.length < 2 || labels.some((label) => /^\d+$/.test(label))) {
    return "";
  }
  if (FILE_LIKE_TLDS.has(labels[labels.length - 1])) {
    return "";
  }
  return candidate;
}

function isDeniedHost(host: string): boolean {
  const normalized = normalizeHost(host);
  return BARE_DOMAIN_DENYLIST.has(normalized) || BASE_DOMAIN_DENYLIST.has(baseDomain(normalized));
}

function collectHostsFromUnknown(value: unknown, hosts: Set<string>) {
  if (typeof value === "string") {
    collectHostsFromText(value, hosts);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => collectHostsFromUnknown(entry, hosts));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value as Record<string, unknown>).forEach(([key, entry]) => {
      if (/host|url|domain|remote/i.test(key)) {
        collectHostsFromUnknown(entry, hosts);
      } else if (typeof entry === "object") {
        collectHostsFromUnknown(entry, hosts);
      }
    });
  }
}

function collectHostsFromText(text: string, hosts: Set<string>) {
  const hostPortPattern = /\b(?:https?:\/\/)?([a-z0-9.-]+\.[a-z]{2,})(?::\d+)?(?:[/?#][^\s"']*)?/gi;
  let match: RegExpExecArray | null;
  while ((match = hostPortPattern.exec(text)) !== null) {
    const host = normalizeHost(match[1] || "");
    if (host && !BARE_DOMAIN_DENYLIST.has(host)) {
      hosts.add(host);
    }
  }
}

function sanitizeHeaderValue(value: string): string {
  return String(value || "").replace(/[\r\n]/g, " ").trim();
}

function sortHosts(a: string, b: string): number {
  const depth = a.split(".").length - b.split(".").length;
  return depth || a.localeCompare(b);
}
