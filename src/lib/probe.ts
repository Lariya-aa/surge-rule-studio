import {
  classifyDomains,
  extractHostsFromText,
  hostFromUrl,
  normalizeInputUrl,
  parseSurgeTrafficHosts,
  type ClassifiedDomain,
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
  hosts: ClassifiedDomain[];
  blockedHosts: string[];
  stats: {
    discoveredHosts: number;
    surgeDumpHosts: number;
  };
}

export async function analyzeUrl(
  payload: AnalyzeRequest,
  fetcher: typeof fetch = fetch,
): Promise<AnalyzeResult> {
  const inputUrl = normalizeInputUrl(payload.url);
  const mode = payload.mode || "suffix";
  const blockedHosts = parseSurgeTrafficHosts(payload.surgeDump || "");
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

  return {
    inputUrl,
    finalUrl,
    workerReachable,
    statusCode,
    fetchError,
    hosts: classifyDomains(Array.from(discovered), blockedHosts, mode),
    blockedHosts,
    stats: {
      discoveredHosts: discovered.size,
      surgeDumpHosts: blockedHosts.length,
    },
  };
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
  return /\.(?:png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf|eot|mp4|webm|mp3|pdf|zip|gz|tgz|bz2|7z|rar)(?:$|[?#])/i.test(pathname);
}
