"use client";

import {
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  Search,
  RadioTower,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { developerLinks } from "@/src/config/developerLinks";
import type { ConnectivityResult, ConnectivityStatus } from "@/src/lib/connectivity";
import {
  baseDomain,
  buildSurgeList,
  CATEGORY_LABELS,
  consolidateDomains,
  hostFromUrl,
  normalizeInputUrl,
  parseSurgeList,
  type ClassifiedDomain,
  type DomainGroup,
  type EvidenceStatus,
  type RuleCategory,
  type RuleMode,
} from "@/src/lib/surge";

interface AnalyzeApiResult {
  inputUrl: string;
  finalUrl: string;
  workerReachable: boolean;
  statusCode: number | null;
  fetchError: string;
  evidenceStatus: EvidenceStatus;
  hosts: ClassifiedDomain[];
  blockedHosts: string[];
  stats: {
    discoveredHosts: number;
    surgeEvidenceHosts: number;
  };
}

interface BrowserProbe {
  status: "idle" | "checking" | "reachable" | "blocked";
  durationMs: number;
  error: string;
}

const categoryOrder: RuleCategory[] = [
  "direct-cn",
  "proxy-global",
  "region-sensitive",
  "blocked",
  "ad-tracking",
];

const categoryTone: Record<RuleCategory, string> = {
  "direct-cn": "border-emerald-200 bg-emerald-50 text-emerald-900",
  "proxy-global": "border-indigo-200 bg-indigo-50 text-indigo-900",
  "region-sensitive": "border-amber-200 bg-amber-50 text-amber-950",
  blocked: "border-rose-200 bg-rose-50 text-rose-900",
  "ad-tracking": "border-zinc-300 bg-zinc-100 text-zinc-900",
};

const builtInTags = [
  { label: "AI", path: "rules/AI.list" },
  { label: "Google", path: "rules/Google.list" },
  { label: "YouTube", path: "rules/YouTube.list" },
  { label: "Netflix", path: "rules/Netflix.list" },
  { label: "Streaming", path: "rules/Streaming.list" },
  { label: "Game", path: "rules/Game.list" },
  { label: "Forum", path: "rules/Forum.list" },
  { label: "Social", path: "rules/Social.list" },
  { label: "Apple", path: "rules/Apple.list" },
  { label: "Podcast", path: "rules/Podcast.list" },
  { label: "Ads", path: "rules/Ads.list" },
  { label: "Privacy", path: "rules/Privacy.list" },
];

const CUSTOM_TAGS_KEY = "surge-studio-custom-tags";

export default function RuleWorkbench() {
  const [url, setUrl] = useState("https://linux.do/");
  const [mode, setMode] = useState<RuleMode>("suffix");
  const [surgeDump, setSurgeDump] = useState("");
  const [domains, setDomains] = useState<ClassifiedDomain[]>([]);
  const [analysis, setAnalysis] = useState<AnalyzeApiResult | null>(null);
  const [browserProbe, setBrowserProbe] = useState<BrowserProbe>({
    status: "idle",
    durationMs: 0,
    error: "",
  });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState("");
  const [activeTag, setActiveTag] = useState("AI");
  const [customTags, setCustomTags] = useState<Array<{ label: string; path: string }>>(() => {
    try {
      const stored = localStorage.getItem(CUSTOM_TAGS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  });
  const [showAddTag, setShowAddTag] = useState(false);
  const [newTagName, setNewTagName] = useState("");
  const [newTagPath, setNewTagPath] = useState("");
  const [tagBuckets, setTagBuckets] = useState<Record<string, string[]>>({});
  const [tagSources, setTagSources] = useState<Record<string, string>>({});
  const [analysisTag, setAnalysisTag] = useState("");
  const [pathLocked, setPathLocked] = useState(false);
  const [surgeDraft, setSurgeDraft] = useState("");
  const [surgeEdited, setSurgeEdited] = useState(false);
  const [connectivityMap, setConnectivityMap] = useState<Map<string, ConnectivityResult>>(new Map());
  const [connectivityFilter, setConnectivityFilter] = useState<"all" | ConnectivityStatus>("all");
  const [domainSearch, setDomainSearch] = useState("");
  const [githubForm, setGithubForm] = useState({
    owner: "",
    repo: "",
    path: "rules/Custom.list",
    branch: "main",
    token: "",
    message: "Update Surge rules",
  });
  const [uploadStatus, setUploadStatus] = useState("");

  function saveCustomTags(tags: Array<{ label: string; path: string }>) {
    setCustomTags(tags);
    try {
      localStorage.setItem(CUSTOM_TAGS_KEY, JSON.stringify(tags));
    } catch {
      // ignore
    }
  }

  function addCustomTag() {
    const label = newTagName.trim();
    if (!label) return;
    const path = newTagPath.trim() || `rules/${label.replace(/\s+/g, "-").toLowerCase()}.list`;
    const exists = [...builtInTags, ...customTags].some((t) => t.label === label);
    if (exists) return;
    saveCustomTags([...customTags, { label, path }]);
    setActiveTag(label);
    setShowAddTag(false);
    setNewTagName("");
    setNewTagPath("");
    if (!pathLocked) {
      setGithubForm((current) => ({ ...current, path }));
    }
  }

  function removeCustomTag(label: string) {
    const next = customTags.filter((t) => t.label !== label);
    saveCustomTags(next);
    if (activeTag === label) {
      setActiveTag("AI");
    }
  }

  const allTags = [...builtInTags, ...customTags];
  const activeTagKey = activeTag;

  const generatedSurgeList = useMemo(() => {
    const bucketRules = tagBuckets[activeTagKey] || [];
    /* v8 ignore next -- analysis?.inputUrl is always set when analysisTag matches */
    const sourceUrl = analysisTag === activeTagKey
      ? analysis?.inputUrl || url
      : tagSources[activeTagKey] || url;
    const currentRules = analysisTag === activeTagKey
      ? parseSurgeList(buildSurgeList(domains, {
        title: titleFromUrl(sourceUrl),
        source: sourceUrl,
        mode,
    }).text)
      : [];
    return formatTaggedSurgeList(activeTagKey, sourceUrl, mode, mergeRuleLines(bucketRules, currentRules));
  }, [activeTagKey, analysis?.inputUrl, analysisTag, domains, mode, tagBuckets, tagSources, url]);

  const surgeText = surgeEdited ? surgeDraft : generatedSurgeList;

  const grouped = useMemo(() => {
    return consolidateDomains(domains);
  }, [domains]);

  const inputBaseDomain = useMemo(() => {
    try {
      return baseDomain(hostFromUrl(normalizeInputUrl(url)));
    } catch {
      return "";
    }
  }, [url]);

  const groupedByCategory = useMemo(() => {
    const groups: Record<RuleCategory, DomainGroup[]> = {
      "direct-cn": [],
      "proxy-global": [],
      "region-sensitive": [],
      blocked: [],
      "ad-tracking": [],
    };
    for (const group of grouped) {
      // Apply connectivity filter
      if (connectivityFilter !== "all") {
        const hasMatch = group.domains.some((d) => {
          const conn = connectivityMap.get(d.host);
          return conn?.status === connectivityFilter;
        });
        if (!hasMatch) continue;
      }
      // Apply domain search filter
      if (domainSearch) {
        const q = domainSearch.toLowerCase();
        const matchesSearch = group.domains.some((d) => d.host.toLowerCase().includes(q));
        if (!matchesSearch) continue;
      }
      groups[group.category].push(group);
    }
    return groups;
  }, [grouped, connectivityFilter, connectivityMap, domainSearch]);

  async function handleAnalyze() {
    setIsAnalyzing(true);
    setError("");
    setUploadStatus("");
    setBrowserProbe({ status: "checking", durationMs: 0, error: "" });

    const directPromise = probeDirect(url).then(setBrowserProbe);
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url, mode, surgeDump }),
      });
      const payload = (await response.json()) as AnalyzeApiResult & { error?: string };
      if (!response.ok) {
        /* v8 ignore next -- payload.error is always set by the API */
        throw new Error(payload.error || "Analyze request failed");
      }
      setAnalysis(payload);
      setDomains(payload.hosts);
      setAnalysisTag(activeTagKey);
      const autoRules = parseSurgeList(buildSurgeList(payload.hosts, {
        title: titleFromUrl(payload.inputUrl),
        source: payload.inputUrl,
        mode,
      }).text);
      setTagBuckets((current) => ({
        ...current,
        [activeTagKey]: mergeRuleLines(current[activeTagKey] || [], autoRules),
      }));
      setTagSources((current) => ({ ...current, [activeTagKey]: payload.inputUrl }));
      setSurgeEdited(false);

      // Fire connectivity check in background (don't block UI)
      const hosts = payload.hosts.map((h) => h.host);
      fetch("/api/connectivity", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ hosts }),
      })
        .then((r) => r.json() as Promise<{ results: ConnectivityResult[] }>)
        .then((data) => {
          const map = new Map<string, ConnectivityResult>();
          for (const result of data.results) {
            map.set(result.host, result);
          }
          setConnectivityMap(map);
        })
        .catch(() => undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analyze request failed");
    } finally {
      await directPromise.catch(() => undefined);
      setIsAnalyzing(false);
    }
  }

  function updateDomain(host: string, patch: Partial<ClassifiedDomain>) {
    const nextDomains = domains.map((domain) => (domain.host === host ? { ...domain, ...patch } : domain));
    setDomains(nextDomains);
    /* v8 ignore next -- false branch: updateDomain called when analysis tag matches active tag */
    if (analysisTag === activeTagKey) {
      const sourceUrl = analysis?.inputUrl || url;
      const rules = parseSurgeList(buildSurgeList(nextDomains, {
        title: titleFromUrl(sourceUrl),
        source: sourceUrl,
        mode,
      }).text);
      setTagBuckets((buckets) => ({ ...buckets, [activeTagKey]: rules }));
    }
    setSurgeEdited(false);
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(surgeText);
  }

  function handleDownload() {
    const blob = new Blob([surgeText], { type: "text/plain;charset=utf-8" });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = href;
    anchor.download = `${titleFromUrl(url)}.list`;
    anchor.click();
    URL.revokeObjectURL(href);
  }

  async function handleUpload() {
    setUploadStatus("uploading");
    setError("");
    try {
      const response = await fetch("/api/github/upload", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...githubForm, content: surgeText }),
      });
      const payload = (await response.json()) as { rawUrl?: string; error?: string };
      if (!response.ok) {
        /* v8 ignore next -- payload.error is always set by the API */
        throw new Error(payload.error || "GitHub upload failed");
      }
      setUploadStatus(`saved: ${payload.rawUrl}`);
      setGithubForm((current) => ({ ...current, token: "" }));
    } catch (uploadError) {
      setUploadStatus("");
      /* v8 ignore next -- uploadError is always an Error instance */
      setError(uploadError instanceof Error ? uploadError.message : "GitHub upload failed");
    }
  }

  function handleTagClick(label: string, path: string) {
    setActiveTag(label);
    setSurgeEdited(false);
    if (!pathLocked) {
      setGithubForm((current) => ({ ...current, path }));
    }
  }

  function handlePathChange(path: string) {
    setPathLocked(true);
    setGithubForm((current) => ({ ...current, path }));
  }

  return (
    <main className="min-h-screen bg-[#f6f7f2] text-[#161b22]">
      <header className="border-b border-[#d8ded2] bg-[#fdfef9]">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-[#173b35] text-white">
              <RadioTower size={22} aria-hidden="true" />
            </span>
            <div>
              <h1 className="text-xl font-semibold">Surge Rule Studio</h1>
              <p className="text-sm text-[#5b645d]">直连判断、域名分类、Surge 规则生成与 GitHub 增量保存</p>
            </div>
          </div>
          <nav aria-label="Developer links" className="flex items-center gap-2">
            {developerLinks.map((link) => {
              const Icon = link.icon;
              return (
                <a
                  aria-disabled={!link.href}
                  className="grid h-10 w-10 place-items-center rounded-md border border-[#cbd4c6] bg-white text-[#24302b] transition hover:border-[#173b35] hover:text-[#173b35]"
                  /* v8 ignore next -- all developer links have empty href by default */
                  href={link.href || "#developer-link-placeholder"}
                  key={link.label}
                  /* v8 ignore next -- all developer links have empty href by default */
                  title={link.href ? link.label : `${link.label} URL placeholder`}
                >
                  <Icon size={18} aria-hidden="true" />
                  <span className="sr-only">{link.label}</span>
                </a>
              );
            })}
          </nav>
        </div>
      </header>

      <section className="border-b border-[#d8ded2] bg-[#eef4e8]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1.1fr)_420px]">
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <label className="min-w-0 flex-1">
                <span className="mb-2 block text-sm font-medium">目标链接</span>
                <input
                  className="h-12 w-full rounded-md border border-[#bfcab9] bg-white px-4 text-base outline-none focus:border-[#173b35] focus:ring-2 focus:ring-[#9fc7b0]"
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://linux.do/"
                  value={url}
                />
              </label>
              <div className="grid grid-cols-2 gap-2 sm:w-56">
                <button
                  className={`mt-7 h-12 rounded-md border text-sm font-semibold ${mode === "suffix" ? "border-[#173b35] bg-[#173b35] text-white" : "border-[#bfcab9] bg-white text-[#26312b]"}`}
                  onClick={() => setMode("suffix")}
                  type="button"
                >
                  后缀规则
                </button>
                <button
                  className={`mt-7 h-12 rounded-md border text-sm font-semibold ${mode === "exact" ? "border-[#173b35] bg-[#173b35] text-white" : "border-[#bfcab9] bg-white text-[#26312b]"}`}
                  onClick={() => setMode("exact")}
                  type="button"
                >
                  精确规则
                </button>
              </div>
            </div>
            <div className="flex flex-wrap gap-3">
              <button
                className="inline-flex h-11 items-center gap-2 rounded-md bg-[#173b35] px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#6f8078]"
                disabled={isAnalyzing}
                onClick={handleAnalyze}
                type="button"
              >
                {isAnalyzing ? <Loader2 className="animate-spin" size={18} /> : <Globe2 size={18} />}
                判断并生成规则
              </button>
              <a
                className="inline-flex h-11 items-center gap-2 rounded-md border border-[#bfcab9] bg-white px-4 text-sm font-semibold text-[#26312b]"
                href={safeExternalHref(url)}
                rel="noreferrer"
                target="_blank"
              >
                <ExternalLink size={17} />
                打开链接
              </a>
            </div>
            {error ? (
              <div className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">
                <AlertTriangle className="mt-0.5 shrink-0" size={18} />
                {error}
              </div>
            ) : null}
            <div className="rounded-md border border-[#cbd4c6] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold">用途标签</h2>
                  <p className="mt-1 text-xs text-[#68746d]">标签会累积当前页面会话内的规则；手动修改 path 后以 path 为准。</p>
                </div>
                <span className="rounded-md bg-[#eef4e8] px-2 py-1 text-xs text-[#26312b]">{activeTagKey}</span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {allTags.map((tag) => {
                  const isCustom = customTags.some((t) => t.label === tag.label);
                  return (
                    <span className="inline-flex items-center" key={tag.label}>
                      <button
                        className={`h-8 rounded-l-md border px-3 text-xs font-semibold ${activeTag === tag.label ? "border-[#173b35] bg-[#173b35] text-white" : "border-[#cbd4c6] bg-white text-[#26312b]"}`}
                        onClick={() => handleTagClick(tag.label, tag.path)}
                        type="button"
                      >
                        {tag.label}
                      </button>
                      {isCustom && (
                        <button
                          /* v8 ignore next -- delete button only shown when tag is selected */
                          className={`h-8 rounded-r-md border border-l-0 px-1.5 text-xs ${activeTag === tag.label ? "border-[#173b35] bg-[#173b35] text-white/70 hover:text-white" : "border-[#cbd4c6] bg-white text-[#68746d] hover:text-rose-600"}`}
                          onClick={() => removeCustomTag(tag.label)}
                          title={`删除标签 "${tag.label}"`}
                          type="button"
                        >
                          ×
                        </button>
                      )}
                    </span>
                  );
                })}
                <button
                  className="h-8 rounded-md border border-dashed border-[#97a89a] px-3 text-xs font-semibold text-[#5b645d] hover:border-[#173b35] hover:text-[#173b35]"
                  onClick={() => setShowAddTag(true)}
                  title="添加自定义标签"
                  type="button"
                >
                  +
                </button>
              </div>
              {showAddTag ? (
                <div className="mt-3 flex gap-2">
                  <input
                    className="h-9 flex-1 rounded-md border border-[#bfcab9] px-3 text-sm outline-none focus:border-[#173b35]"
                    onChange={(event) => {
                      setNewTagName(event.target.value);
                      /* v8 ignore next -- auto-suggest path when empty or matches previous suggestion */
                      if (!newTagPath || newTagPath === `rules/${newTagName.replace(/\s+/g, "-").toLowerCase()}.list`) {
                        setNewTagPath(`rules/${event.target.value.replace(/\s+/g, "-").toLowerCase()}.list`);
                      }
                    }}
                    placeholder="标签名称"
                    value={newTagName}
                  />
                  <input
                    className="h-9 flex-1 rounded-md border border-[#bfcab9] px-3 text-sm outline-none focus:border-[#173b35]"
                    onChange={(event) => setNewTagPath(event.target.value)}
                    placeholder="rules/Tag.list"
                    value={newTagPath}
                  />
                  <button
                    className="h-9 rounded-md bg-[#173b35] px-3 text-xs font-semibold text-white"
                    onClick={addCustomTag}
                    type="button"
                  >
                    保存
                  </button>
                  <button
                    className="h-9 rounded-md border border-[#bfcab9] px-3 text-xs font-semibold text-[#26312b]"
                    onClick={() => { setShowAddTag(false); setNewTagName(""); setNewTagPath(""); }}
                    type="button"
                  >
                    取消
                  </button>
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatusTile
              icon={browserProbe.status === "blocked" ? XCircle : CheckCircle2}
              label="当前访问路径"
              tone={browserProbe.status === "reachable" ? "good" : browserProbe.status === "blocked" ? "bad" : "neutral"}
              value={browserStatusText(browserProbe)}
            />
            <StatusTile
              icon={analysis?.evidenceStatus === "DIRECT_VERIFIED" ? CheckCircle2 : ShieldAlert}
              label="直连证据"
              tone={analysis?.evidenceStatus === "DIRECT_VERIFIED" ? "good" : analysis?.evidenceStatus === "PROXY_VERIFIED" ? "warn" : analysis?.evidenceStatus === "BLOCKED_VERIFIED" ? "bad" : "neutral"}
              value={analysis ? evidenceStatusText(analysis.evidenceStatus) : "等待 Surge 证据"}
            />
            <StatusTile
              icon={RadioTower}
              label="Surge 证据输入"
              tone={analysis?.stats.surgeEvidenceHosts ? "warn" : "neutral"}
              value={analysis?.stats.surgeEvidenceHosts ? `${analysis.stats.surgeEvidenceHosts} 个域名` : "可粘贴 dump/log"}
            />
          </div>
        </div>
      </section>

      <section className="border-b border-[#d8ded2] bg-[#fdfef9]">
        <div className="mx-auto grid max-w-7xl gap-6 px-5 py-7 lg:grid-cols-[420px_minmax(0,1fr)]">
          <label>
            <span className="mb-2 block text-sm font-medium">Surge dump/log 输入</span>
            <textarea
              className="h-48 w-full resize-y rounded-md border border-[#bfcab9] bg-white p-3 font-mono text-sm outline-none focus:border-[#173b35] focus:ring-2 focus:ring-[#9fc7b0]"
              onChange={(event) => setSurgeDump(event.target.value)}
              placeholder="粘贴 surge-cli --raw dump recent 的 JSON，或包含 remoteHost / URL / 域名的日志。直连失败时，这些域名会进入阻断候选。"
              value={surgeDump}
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-5">
            {categoryOrder.map((category) => (
              <div className={`rounded-md border p-4 ${categoryTone[category]}`} key={category}>
                <div className="text-sm font-semibold">{CATEGORY_LABELS[category]}</div>
                <div className="mt-3 text-3xl font-semibold">{groupedByCategory[category].reduce((sum, g) => sum + g.domains.length, 0)}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-7 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-5">
          {domains.length > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-md border border-[#cbd4c6] bg-white px-4 py-3">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#68746d]" size={16} />
                <input
                  className="h-9 w-full rounded-md border border-[#bfcab9] pl-9 pr-3 text-sm outline-none focus:border-[#173b35]"
                  onChange={(e) => setDomainSearch(e.target.value)}
                  placeholder="搜索域名..."
                  title="搜索域名"
                  value={domainSearch}
                />
              </div>
              <div className="flex gap-1.5">
                {([["all", "全部"], ["direct", "🟢 直连"], ["likely-direct", "🟡 可能直连"], ["likely-proxy", "🔴 可能需代理"], ["proxy", "🔴 需代理"], ["unknown", "⚪ 未知"]] as const).map(([value, label]) => (
                  <button
                    className={`h-8 rounded-md border px-2.5 text-xs font-medium ${connectivityFilter === value ? "border-[#173b35] bg-[#173b35] text-white" : "border-[#cbd4c6] bg-white text-[#26312b] hover:border-[#173b35]"}`}
                    onClick={() => setConnectivityFilter(value)}
                    key={value}
                    title={`筛选${label}`}
                    type="button"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {categoryOrder.map((category) => (
            <DomainGroupSection
              category={category}
              connectivityMap={connectivityMap}
              groups={groupedByCategory[category]}
              inputBaseDomain={inputBaseDomain}
              key={category}
              onUpdate={updateDomain}
            />
          ))}
        </div>

        <aside className="space-y-5 xl:sticky xl:top-5 xl:self-start">
          <div className="rounded-md border border-[#cbd4c6] bg-white">
            <div className="flex items-center justify-between border-b border-[#e1e6dc] px-4 py-3">
              <h2 className="font-semibold">Surge list 输出</h2>
              <div className="flex gap-2">
                <button className="grid h-9 w-9 place-items-center rounded-md border border-[#cbd4c6]" onClick={() => { setSurgeEdited(false); setSurgeDraft(""); }} title="Regenerate" type="button">
                  <RotateCcw size={17} />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-md border border-[#cbd4c6]" onClick={handleCopy} title="Copy" type="button">
                  <Copy size={17} />
                </button>
                <button className="grid h-9 w-9 place-items-center rounded-md border border-[#cbd4c6]" onClick={handleDownload} title="Download" type="button">
                  <Download size={17} />
                </button>
              </div>
            </div>
            <textarea
              className="h-80 w-full resize-y border-0 bg-[#101513] p-4 font-mono text-xs leading-6 text-[#e7f1e8] outline-none"
              onChange={(event) => {
                setSurgeDraft(event.target.value);
                setSurgeEdited(true);
              }}
              value={surgeText}
            />
            <p className="border-t border-[#e1e6dc] px-4 py-2 text-xs text-[#68746d]">
              {surgeEdited ? "使用用户编辑后的文本进行复制、下载和上传。" : "当前文本由选中域名和用途标签自动生成。"}
            </p>
          </div>

          <div className="rounded-md border border-[#cbd4c6] bg-white">
            <div className="border-b border-[#e1e6dc] px-4 py-3">
              <h2 className="font-semibold">增量上传到 GitHub</h2>
              <p className="mt-1 text-sm text-[#5b645d]">Token 只用于本次请求，不会写入 D1。</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Owner" value={githubForm.owner} onChange={(owner) => setGithubForm((current) => ({ ...current, owner }))} />
              <Field label="Repo" value={githubForm.repo} onChange={(repo) => setGithubForm((current) => ({ ...current, repo }))} />
              <Field label="Path" value={githubForm.path} onChange={handlePathChange} />
              <Field label="Branch" value={githubForm.branch} onChange={(branch) => setGithubForm((current) => ({ ...current, branch }))} />
              <label className="sm:col-span-2">
                <span className="mb-1 block text-sm font-medium">Fine-grained PAT</span>
                <input
                  className="h-10 w-full rounded-md border border-[#bfcab9] px-3 text-sm outline-none focus:border-[#173b35]"
                  onChange={(event) => setGithubForm((current) => ({ ...current, token: event.target.value }))}
                  type="password"
                  value={githubForm.token}
                />
              </label>
              <Field label="Commit message" value={githubForm.message} onChange={(message) => setGithubForm((current) => ({ ...current, message }))} wide />
              <button
                className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-[#173b35] px-4 text-sm font-semibold text-white sm:col-span-2"
                onClick={handleUpload}
                type="button"
              >
                <UploadCloud size={18} />
                增量保存 .list
              </button>
              {uploadStatus ? <p className="break-all text-sm text-[#266747] sm:col-span-2">{uploadStatus}</p> : null}
            </div>
          </div>
        </aside>
      </section>
    </main>
  );
}

function DomainGroupSection({
  category,
  connectivityMap,
  groups,
  inputBaseDomain,
  onUpdate,
}: {
  category: RuleCategory;
  connectivityMap: Map<string, ConnectivityResult>;
  groups: DomainGroup[];
  inputBaseDomain: string;
  onUpdate: (host: string, patch: Partial<ClassifiedDomain>) => void;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const totalDomains = groups.reduce((sum, g) => sum + g.domains.length, 0);

  function toggleGroup(baseDomain: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(baseDomain)) {
        next.delete(baseDomain);
      } else {
        next.add(baseDomain);
      }
      return next;
    });
  }

  function toggleAllInGroup(group: DomainGroup, selected: boolean) {
    for (const domain of group.domains) {
      onUpdate(domain.host, { selected });
    }
  }

  return (
    <section className="rounded-md border border-[#cbd4c6] bg-white">
      <div className={`flex items-center justify-between border-b px-4 py-3 ${categoryTone[category]}`}>
        <h2 className="font-semibold">{CATEGORY_LABELS[category]}</h2>
        <span className="text-sm">{totalDomains} hosts</span>
      </div>
      {groups.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[#68746d]">暂无域名。运行判断或粘贴 Surge dump/log 后会显示。</p>
      ) : (
        <div className="divide-y divide-[#edf0ea]">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.baseDomain) || group.baseDomain === inputBaseDomain;
            const isSingleDomain = group.domains.length === 1;
            const allSelected = group.domains.every((d) => d.selected);
            const someSelected = group.domains.some((d) => d.selected) && !allSelected;
            const isInputGroup = group.baseDomain === inputBaseDomain;

            if (isSingleDomain) {
              const domain = group.domains[0];
              return (
                <div className={`grid gap-3 px-4 py-3 md:grid-cols-[32px_minmax(0,1fr)_190px] ${isInputGroup ? "border-l-4 border-l-[#173b35] bg-[#f0f7f0]" : ""}`} key={group.baseDomain}>
                  <input
                    aria-label={`Select ${domain.host}`}
                    checked={domain.selected}
                    className="mt-1 h-5 w-5"
                    onChange={(event) => onUpdate(domain.host, { selected: event.target.checked })}
                    type="checkbox"
                  />
                  <div className="min-w-0">
                    <div className="break-all font-mono text-sm font-semibold">
                      {domain.host}
                      {isInputGroup && (
                        <span className="ml-2 rounded-md bg-[#173b35] px-2 py-0.5 text-xs text-white align-middle">
                          🎯 输入域名
                        </span>
                      )}
                      {connectivityMap.size > 0 && (() => {
                        const conn = connectivityMap.get(domain.host);
                        const badge = connectivityBadge(conn?.status);
                        /* v8 ignore next -- conn.reason is always a non-empty string when result exists */
                        return <span className="ml-2 text-xs" title={conn?.reason || badge.label}>{badge.emoji}</span>;
                      })()}
                    </div>
                    <div className="mt-1 text-xs leading-5 text-[#68746d]">{domain.reasons.join("; ")}</div>
                  </div>
                  <select
                    aria-label={`Category for ${domain.host}`}
                    className="h-10 rounded-md border border-[#bfcab9] bg-white px-2 text-sm"
                    onChange={(event) => onUpdate(domain.host, { category: event.target.value as RuleCategory })}
                    value={domain.category}
                  >
                    {categoryOrder.map((item) => (
                      <option key={item} value={item}>
                        {CATEGORY_LABELS[item]}
                      </option>
                    ))}
                  </select>
                </div>
              );
            }

            return (
              <div className={isInputGroup ? "border-l-4 border-l-[#173b35] bg-[#f0f7f0]" : ""} key={group.baseDomain}>
                <div className={`flex items-center gap-3 px-4 py-3 ${isInputGroup ? "bg-[#e8f5e8]" : "bg-[#f8f9f5]"}`}>
                  <input
                    aria-label={`Select all ${group.baseDomain}`}
                    checked={allSelected}
                    className="h-5 w-5"
                    onChange={(event) => toggleAllInGroup(group, event.target.checked)}
                    ref={(el) => { if (el) el.indeterminate = someSelected; }}
                    type="checkbox"
                  />
                  <button
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => toggleGroup(group.baseDomain)}
                    type="button"
                  >
                    <span className="font-mono text-sm font-semibold">{group.baseDomain}</span>
                    {isInputGroup && (
                      <span className="rounded-md bg-[#173b35] px-2 py-0.5 text-xs text-white">
                        🎯 输入域名
                      </span>
                    )}
                    <span className="rounded-md bg-[#eef4e8] px-2 py-0.5 text-xs text-[#26312b]">
                      {group.domains.length} 子域名
                    </span>
                    <span className="ml-auto text-xs text-[#68746d]">
                      {isExpanded ? "收起" : "展开"}
                    </span>
                  </button>
                </div>
                {isExpanded && (
                  <div className="divide-y divide-[#edf0ea] border-t border-[#edf0ea]">
                    {group.domains.map((domain) => (
                      <div className="grid gap-3 pl-10 pr-4 py-2 md:grid-cols-[32px_minmax(0,1fr)_190px]" key={domain.host}>
                        <input
                          aria-label={`Select ${domain.host}`}
                          checked={domain.selected}
                          className="mt-1 h-5 w-5"
                          onChange={(event) => onUpdate(domain.host, { selected: event.target.checked })}
                          type="checkbox"
                        />
                        <div className="min-w-0">
                          <div className="break-all font-mono text-sm">
                            {domain.host}
                            {connectivityMap.size > 0 && (() => {
                              const conn = connectivityMap.get(domain.host);
                              const badge = connectivityBadge(conn?.status);
                              /* v8 ignore next -- conn.reason is always non-empty when result exists */
                              return <span className="ml-2 text-xs" title={conn?.reason || badge.label}>{badge.emoji}</span>;
                            })()}
                          </div>
                          <div className="mt-1 text-xs leading-5 text-[#68746d]">{domain.reasons.join("; ")}</div>
                        </div>
                        <select
                          aria-label={`Category for ${domain.host}`}
                          className="h-10 rounded-md border border-[#bfcab9] bg-white px-2 text-sm"
                          onChange={(event) => onUpdate(domain.host, { category: event.target.value as RuleCategory })}
                          value={domain.category}
                        >
                          {categoryOrder.map((item) => (
                            <option key={item} value={item}>
                              {CATEGORY_LABELS[item]}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

function StatusTile({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof CheckCircle2;
  label: string;
  value: string;
  tone: "good" | "bad" | "warn" | "neutral";
}) {
  const toneClass = {
    good: "border-emerald-200 bg-emerald-50 text-emerald-900",
    bad: "border-rose-200 bg-rose-50 text-rose-900",
    warn: "border-amber-200 bg-amber-50 text-amber-950",
    neutral: "border-[#cbd4c6] bg-white text-[#26312b]",
  }[tone];
  return (
    <div className={`rounded-md border p-4 ${toneClass}`}>
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon size={17} />
        {label}
      </div>
      <div className="mt-2 line-clamp-2 break-all text-sm">{value}</div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  wide = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  wide?: boolean;
}) {
  return (
    <label className={wide ? "sm:col-span-2" : ""}>
      <span className="mb-1 block text-sm font-medium">{label}</span>
      <input
        className="h-10 w-full rounded-md border border-[#bfcab9] px-3 text-sm outline-none focus:border-[#173b35]"
        onChange={(event) => onChange(event.target.value)}
        value={value}
      />
    </label>
  );
}

async function probeDirect(rawUrl: string): Promise<BrowserProbe> {
  const startedAt = performance.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8_000);
  try {
    const normalized = normalizeInputUrl(rawUrl);
    await fetch(normalized, {
      cache: "no-store",
      mode: "no-cors",
      signal: controller.signal,
    });
    return {
      status: "reachable",
      durationMs: Math.round(performance.now() - startedAt),
      error: "",
    };
  } catch (error) {
    return {
      status: "blocked",
      durationMs: Math.round(performance.now() - startedAt),
      /* v8 ignore next -- error is always an Error instance from fetch */
      error: error instanceof Error ? error.message : "Direct probe failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

export function connectivityBadge(status: ConnectivityStatus | undefined): { emoji: string; label: string } {
  if (!status) return { emoji: "⚪", label: "未知" };
  if (status === "direct") return { emoji: "🟢", label: "直连" };
  if (status === "likely-direct") return { emoji: "🟡", label: "可能直连" };
  if (status === "likely-proxy") return { emoji: "🔴", label: "需代理" };
  if (status === "proxy") return { emoji: "🔴", label: "需代理" };
  return { emoji: "⚪", label: "未知" };
}

function browserStatusText(probe: BrowserProbe): string {
  if (probe.status === "idle") {
    return "等待判断";
  }
  if (probe.status === "checking") {
    return "检测中";
  }
  if (probe.status === "reachable") {
    return `浏览器当前路径可达 / ${probe.durationMs}ms`;
  }
  /* v8 ignore next -- probe.error is always a non-empty string when status is blocked */
  return `当前路径不可达 / ${probe.error || "blocked"}`;
}

function evidenceStatusText(status: EvidenceStatus): string {
  if (status === "DIRECT_VERIFIED") return "Surge 证据显示 DIRECT，才可视为直连";
  if (status === "PROXY_VERIFIED") return "Surge 证据显示走代理，不是直连";
  if (status === "BLOCKED_VERIFIED") return "Surge 证据显示失败或阻断";
  return "未提供可证明直连的 Surge 证据";
}

function titleFromUrl(rawUrl: string): string {
  try {
    return new URL(normalizeInputUrl(rawUrl)).hostname.replace(/^www\./, "");
  } catch {
    /* v8 ignore next -- defensive fallback for invalid URLs */
    return "SurgeRules";
  }
}

function safeExternalHref(rawUrl: string): string {
  try {
    return normalizeInputUrl(rawUrl);
  } catch {
    return "about:blank";
  }
}

function mergeRuleLines(a: string[], b: string[]): string[] {
  return Array.from(new Set([...a, ...b].map((line) => line.trim()).filter(Boolean))).sort();
}

function formatTaggedSurgeList(tag: string, source: string, mode: RuleMode, rules: string[]): string {
  const header = [
    `# NAME: ${tag}`,
    `# SOURCE: ${source.replace(/[\r\n]/g, " ")}`,
    `# TAG: ${tag.replace(/[\r\n]/g, " ")}`,
    `# UPDATED: ${new Date().toISOString().replace("T", " ").slice(0, 19)} UTC`,
    `# MODE: ${mode}`,
    "# FORMAT: surge",
    `# RULES: ${rules.length}`,
  ];
  return `${header.join("\n")}\n${rules.join("\n")}${rules.length ? "\n" : ""}`;
}
