import {
  classifyDomains,
  baseDomain,
  confidenceForHost,
  extractHostsFromText,
  hostFromUrl,
  normalizeInputUrl,
  parseSurgeEvidence,
  selectHostsByConfidence,
  type ClassifiedDomain,
  type EvidenceStatus,
  type RuleMode,
} from "./surge";

export interface AnalyzeRequest {
  url: string;
  mode?: RuleMode;
  surgeDump?: string;
}

export interface AnalyzeResult {
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

export async function analyzeUrl(
  payload: AnalyzeRequest,
  fetcher: typeof fetch = fetch,
): Promise<AnalyzeResult> {
  const inputUrl = normalizeInputUrl(payload.url);
  const mode = payload.mode || "suffix";
  const evidence = parseSurgeEvidence(payload.surgeDump || "");
  const blockedHosts = evidence.filter((e) => e.status === "BLOCKED_VERIFIED").map((e) => e.host);
  const evidenceStatus = summarizeEvidenceStatus(evidence, inputUrl);
  const discovered = new Set<string>();
  discovered.add(hostFromUrl(inputUrl));

  let finalUrl = inputUrl;
  let statusCode: number | null = null;
  let fetchError = "";
  let workerReachable = false;

  try {
    const response = await fetchWithTimeout(inputUrl, fetcher);
    statusCode = response.status;
    finalUrl = response.url || inputUrl;
    workerReachable = response.ok || (response.status >= 200 && response.status < 400);
    discovered.add(hostFromUrl(finalUrl));

    const text = await readTextIfUseful(response, finalUrl);
    for (const host of extractHostsFromText(text, finalUrl)) {
      discovered.add(host);
    }
  } catch (error) {
    fetchError = error instanceof Error ? error.message : String(error);
  }

  for (const host of blockedHosts) {
    discovered.add(host);
  }

  const classified = classifyDomains(Array.from(discovered), blockedHosts, mode, evidence);
  const confidence = selectHostsByConfidence(
    classified.map((c) => c.host),
    inputUrl,
  );
  const confidenceMap = new Map(confidence.map((c) => [c.host, c]));

  const hosts = classified.map((domain) => {
    const conf = confidenceMap.get(domain.host);
    const confidence = confidenceForHost(domain.host, inputUrl);
    const reasons = [...domain.reasons];
    if (confidence === "target") {
      reasons.push("Matches the input domain or its registrable base domain");
    } else if (confidence === "provider") {
      reasons.push("High-confidence runtime/provider host");
    } else {
      reasons.push("Noise candidate; not selected by default");
    }
    return {
      ...domain,
      /* v8 ignore next -- confidenceMap always has entry for every host */
      selected: conf ? conf.selected : domain.selected,
      /* v8 ignore next -- confidenceMap always has entry for every host */
      score: conf ? Math.max(domain.score, conf.score) : domain.score,
      confidence,
      reasons,
    };
  });

  return {
    inputUrl,
    finalUrl,
    workerReachable,
    statusCode,
    fetchError,
    evidenceStatus,
    hosts,
    blockedHosts,
    stats: {
      discoveredHosts: discovered.size,
      surgeEvidenceHosts: evidence.length,
    },
  };
}

function summarizeEvidenceStatus(evidence: Array<{ host: string; status: EvidenceStatus }>, inputUrl: string): EvidenceStatus {
  const inputHost = hostFromUrl(inputUrl);
  const inputBase = baseDomain(inputHost);
  const relevant = evidence.filter((item) => {
    const host = item.host;
    return host === inputHost || (inputBase && (host === inputBase || host.endsWith(`.${inputBase}`)));
  });
  const pool = relevant.length > 0 ? relevant : evidence;
  if (pool.some((item) => item.status === "BLOCKED_VERIFIED")) return "BLOCKED_VERIFIED";
  if (pool.some((item) => item.status === "PROXY_VERIFIED")) return "PROXY_VERIFIED";
  if (pool.some((item) => item.status === "DIRECT_VERIFIED")) return "DIRECT_VERIFIED";
  return "UNKNOWN";
}

async function fetchWithTimeout(inputUrl: string, fetcher: typeof fetch): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12_000);
  try {
    return await fetcher(inputUrl, {
      method: "GET",
      redirect: "follow",
      headers: {
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/css,*/*;q=0.8",
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
      },
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readTextIfUseful(response: Response, finalUrl: string): Promise<string> {
  const contentType = response.headers.get("content-type") || "";
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (Number.isFinite(contentLength) && contentLength > 2_000_000) {
    return "";
  }
  if (contentType && !isProbablyTextContentType(contentType)) {
    return "";
  }
  if (!contentType && pathLooksBinary(new URL(finalUrl).pathname)) {
    return "";
  }
  try {
    return await response.text();
  } catch {
    return "";
  }
}

function isProbablyTextContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return (
    normalized.includes("text/") ||
    normalized.includes("json") ||
    normalized.includes("javascript") ||
    normalized.includes("xml") ||
    normalized.includes("svg") ||
    normalized.includes("css") ||
    normalized.includes("html") ||
    normalized.includes("xhtml") ||
    normalized.includes("manifest")
  );
}

function pathLooksBinary(pathname: string): boolean {
  /* v8 ignore next -- regex false branch covered by non-binary path tests */
  return /\.(?:png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|zip|gz|tgz|bz2|7z|rar)(?:$|[?#])/i.test(pathname);
}
