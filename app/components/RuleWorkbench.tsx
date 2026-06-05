"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Globe2,
  Loader2,
  RadioTower,
  ShieldAlert,
  UploadCloud,
  XCircle,
} from "lucide-react";
import { useMemo, useState } from "react";
import { developerLinks } from "@/src/config/developerLinks";
import {
  buildSurgeList,
  CATEGORY_LABELS,
  normalizeInputUrl,
  type ClassifiedDomain,
  type RuleCategory,
  type RuleMode,
} from "@/src/lib/surge";

interface AnalyzeApiResult {
  inputUrl: string;
  finalUrl: string;
  workerReachable: boolean;
  statusCode: number | null;
  fetchError: string;
  hosts: ClassifiedDomain[];
  blockedHosts: string[];
  stats: {
    discoveredHosts: number;
    surgeDumpHosts: number;
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
  const [githubForm, setGithubForm] = useState({
    owner: "",
    repo: "",
    path: "rules/Custom.list",
    branch: "main",
    token: "",
    message: "Update Surge rules",
  });
  const [uploadStatus, setUploadStatus] = useState("");

  const surgeList = useMemo(() => {
    return buildSurgeList(domains, {
      title: titleFromUrl(url),
      source: url,
      mode,
    }).text;
  }, [domains, mode, url]);

  const grouped = useMemo(() => {
    const groups: Record<RuleCategory, ClassifiedDomain[]> = {
      "direct-cn": [],
      "proxy-global": [],
      "region-sensitive": [],
      blocked: [],
      "ad-tracking": [],
    };
    for (const domain of domains) {
      groups[domain.category].push(domain);
    }
    return groups;
  }, [domains]);

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
        throw new Error(payload.error || "Analyze request failed");
      }
      setAnalysis(payload);
      setDomains(payload.hosts);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Analyze request failed");
    } finally {
      await directPromise.catch(() => undefined);
      setIsAnalyzing(false);
    }
  }

  function updateDomain(host: string, patch: Partial<ClassifiedDomain>) {
    setDomains((current) => current.map((domain) => (domain.host === host ? { ...domain, ...patch } : domain)));
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(surgeList);
  }

  function handleDownload() {
    const blob = new Blob([surgeList], { type: "text/plain;charset=utf-8" });
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
        body: JSON.stringify({ ...githubForm, content: surgeList }),
      });
      const payload = (await response.json()) as { rawUrl?: string; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || "GitHub upload failed");
      }
      setUploadStatus(`saved: ${payload.rawUrl}`);
      setGithubForm((current) => ({ ...current, token: "" }));
    } catch (uploadError) {
      setUploadStatus("");
      setError(uploadError instanceof Error ? uploadError.message : "GitHub upload failed");
    }
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
                  href={link.href || "#developer-link-placeholder"}
                  key={link.label}
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
          </div>

          <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
            <StatusTile
              icon={browserProbe.status === "blocked" ? XCircle : CheckCircle2}
              label="用户网络直连"
              tone={browserProbe.status === "reachable" ? "good" : browserProbe.status === "blocked" ? "bad" : "neutral"}
              value={browserStatusText(browserProbe)}
            />
            <StatusTile
              icon={analysis?.workerReachable ? CheckCircle2 : ShieldAlert}
              label="服务端抓取"
              tone={analysis?.workerReachable ? "good" : analysis ? "bad" : "neutral"}
              value={analysis ? `${analysis.statusCode ?? "ERR"} / ${analysis.finalUrl}` : "等待判断"}
            />
            <StatusTile
              icon={RadioTower}
              label="Surge 阻断输入"
              tone={analysis?.stats.surgeDumpHosts ? "warn" : "neutral"}
              value={analysis?.stats.surgeDumpHosts ? `${analysis.stats.surgeDumpHosts} 个域名` : "可粘贴 dump/log"}
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
                <div className="mt-3 text-3xl font-semibold">{grouped[category].length}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-5 py-7 xl:grid-cols-[minmax(0,1fr)_520px]">
        <div className="space-y-5">
          {categoryOrder.map((category) => (
            <DomainGroup
              category={category}
              domains={grouped[category]}
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
              readOnly
              value={surgeList}
            />
          </div>

          <div className="rounded-md border border-[#cbd4c6] bg-white">
            <div className="border-b border-[#e1e6dc] px-4 py-3">
              <h2 className="font-semibold">增量上传到 GitHub</h2>
              <p className="mt-1 text-sm text-[#5b645d]">Token 只用于本次请求，不会写入 D1。</p>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-2">
              <Field label="Owner" value={githubForm.owner} onChange={(owner) => setGithubForm((current) => ({ ...current, owner }))} />
              <Field label="Repo" value={githubForm.repo} onChange={(repo) => setGithubForm((current) => ({ ...current, repo }))} />
              <Field label="Path" value={githubForm.path} onChange={(path) => setGithubForm((current) => ({ ...current, path }))} />
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

function DomainGroup({
  category,
  domains,
  onUpdate,
}: {
  category: RuleCategory;
  domains: ClassifiedDomain[];
  onUpdate: (host: string, patch: Partial<ClassifiedDomain>) => void;
}) {
  return (
    <section className="rounded-md border border-[#cbd4c6] bg-white">
      <div className={`flex items-center justify-between border-b px-4 py-3 ${categoryTone[category]}`}>
        <h2 className="font-semibold">{CATEGORY_LABELS[category]}</h2>
        <span className="text-sm">{domains.length} hosts</span>
      </div>
      {domains.length === 0 ? (
        <p className="px-4 py-5 text-sm text-[#68746d]">暂无域名。运行判断或粘贴 Surge dump/log 后会显示。</p>
      ) : (
        <div className="divide-y divide-[#edf0ea]">
          {domains.map((domain) => (
            <div className="grid gap-3 px-4 py-3 md:grid-cols-[32px_minmax(0,1fr)_190px]" key={domain.host}>
              <input
                aria-label={`Select ${domain.host}`}
                checked={domain.selected}
                className="mt-1 h-5 w-5"
                onChange={(event) => onUpdate(domain.host, { selected: event.target.checked })}
                type="checkbox"
              />
              <div className="min-w-0">
                <div className="break-all font-mono text-sm font-semibold">{domain.host}</div>
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
      error: error instanceof Error ? error.message : "Direct probe failed",
    };
  } finally {
    clearTimeout(timer);
  }
}

function browserStatusText(probe: BrowserProbe): string {
  if (probe.status === "idle") {
    return "等待判断";
  }
  if (probe.status === "checking") {
    return "检测中";
  }
  if (probe.status === "reachable") {
    return `可直连 / ${probe.durationMs}ms`;
  }
  return `不可直连 / ${probe.error || "blocked"}`;
}

function titleFromUrl(rawUrl: string): string {
  try {
    return new URL(normalizeInputUrl(rawUrl)).hostname.replace(/^www\./, "");
  } catch {
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
