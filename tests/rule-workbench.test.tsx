import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RuleWorkbench from "@/app/components/RuleWorkbench";

describe("RuleWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders the operational UI and preserves developer link placeholders", () => {
    render(<RuleWorkbench />);
    expect(screen.getByRole("heading", { name: "Surge Rule Studio" })).toBeInTheDocument();
    expect(screen.getByLabelText("Developer links")).toBeInTheDocument();
    expect(screen.getByTitle("GitHub URL placeholder")).toBeInTheDocument();
    expect(screen.getByTitle("Social URL placeholder")).toBeInTheDocument();
    expect(screen.getByTitle("Website URL placeholder")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "判断并生成规则" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("https://linux.do/")).toBeInTheDocument();
  });

  it("analyzes a URL, shows grouped domains, and updates generated rules after category changes", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://apple.com/",
              finalUrl: "https://www.apple.com/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "PROXY_VERIFIED",
              blockedHosts: ["ads.doubleclick.net"],
              stats: { discoveredHosts: 3, surgeEvidenceHosts: 1 },
              hosts: [
                {
                  host: "apple.com",
                  category: "region-sensitive",
                  rule: "DOMAIN,apple.com",
                  reasons: ["Known region-sensitive official site"],
                  score: 82,
                  selected: true,
                  evidence: "UNKNOWN",
                  confidence: "target",
                },
                {
                  host: "www.qq.com",
                  category: "direct-cn",
                  rule: "DOMAIN-SUFFIX,qq.com",
                  reasons: ["Matches China TLD"],
                  score: 78,
                  selected: true,
                  evidence: "UNKNOWN",
                  confidence: "noise",
                },
                {
                  host: "ads.doubleclick.net",
                  category: "blocked",
                  rule: "DOMAIN-SUFFIX,doubleclick.net",
                  reasons: ["Surge traffic/log marked it as blocked"],
                  score: 95,
                  selected: true,
                  evidence: "BLOCKED_VERIFIED",
                  confidence: "noise",
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.clear(screen.getByLabelText("目标链接"));
    await user.type(screen.getByLabelText("目标链接"), "https://apple.com");
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));

    expect(await screen.findByText("apple.com")).toBeInTheDocument();
    expect(screen.getByText("ads.doubleclick.net")).toBeInTheDocument();
    expect(screen.getByText(/浏览器当前路径可达 \//)).toBeInTheDocument();
    expect(screen.getByText("Surge 证据显示走代理，不是直连")).toBeInTheDocument();
    expect(screen.getByText("1 个域名")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Category for apple.com"), "proxy-global");
    await user.click(screen.getByLabelText("Select ads.doubleclick.net"));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/DOMAIN,apple.com/)).toBeInTheDocument();
      expect(screen.queryByDisplayValue(/DOMAIN-SUFFIX,doubleclick.net/)).not.toBeInTheDocument();
      expect(screen.getByDisplayValue(/# RULES: 2/)).toBeInTheDocument();
    });
  });

  it("posts generated rules to GitHub and clears the token after success", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url === "/api/github/upload") {
        const body = JSON.parse(String(init?.body || "{}")) as { content: string };
        expect(body.content).toBe("DOMAIN,edited.example\n");
        return new Response(JSON.stringify({ rawUrl: "https://raw.githubusercontent.com/o/r/main/rules/Custom.list" }), {
          status: 200,
        });
      }
      return new Response("", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RuleWorkbench />);
    const output = screen.getByDisplayValue(/# NAME: AI/);
    await user.clear(output);
    await user.type(output, "DOMAIN,edited.example\n");
    await user.type(screen.getByLabelText("Owner"), "o");
    await user.type(screen.getByLabelText("Repo"), "r");
    await user.clear(screen.getByLabelText("Path"));
    await user.type(screen.getByLabelText("Path"), "custom/Rules.list");
    await user.clear(screen.getByLabelText("Branch"));
    await user.type(screen.getByLabelText("Branch"), "develop");
    await user.clear(screen.getByLabelText("Commit message"));
    await user.type(screen.getByLabelText("Commit message"), "Append rules");
    await user.type(screen.getByLabelText("Fine-grained PAT"), "github_pat_12345678901234567890");
    await user.click(screen.getByRole("button", { name: "增量保存 .list" }));

    expect(await screen.findByText(/saved: https:\/\/raw.githubusercontent.com\/o\/r\/main\/rules\/Custom.list/)).toBeInTheDocument();
    expect(screen.getByLabelText("Fine-grained PAT")).toHaveValue("");
    expect(fetchMock).toHaveBeenCalledWith("/api/github/upload", expect.any(Object));
  });

  it("keeps tag-specific session buckets and lets manual path override tag paths", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/analyze") {
          const body = JSON.parse(String(init?.body || "{}")) as { url: string };
          const host = body.url.includes("alpha.test") ? "alpha.test" : body.url.includes("beta.test") ? "beta.test" : "gamma.test";
          return new Response(
            JSON.stringify({
              inputUrl: `https://${host}/`,
              finalUrl: `https://${host}/`,
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "UNKNOWN",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
              hosts: [{
                host,
                category: "proxy-global",
                rule: `DOMAIN,${host}`,
                reasons: ["test"],
                score: 90,
                selected: true,
                evidence: "UNKNOWN",
                confidence: "target",
              }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByLabelText("Path")).toHaveValue("rules/Google.list");

    await user.clear(screen.getByLabelText("Path"));
    await user.type(screen.getByLabelText("Path"), "custom/Manual.list");
    await user.clear(screen.getByLabelText("目标链接"));
    await user.type(screen.getByLabelText("目标链接"), "https://alpha.test/");
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await screen.findByText("alpha.test");

    await user.click(screen.getByRole("button", { name: "Netflix" }));
    expect(screen.getByLabelText("Path")).toHaveValue("custom/Manual.list");
    await user.clear(screen.getByLabelText("目标链接"));
    await user.type(screen.getByLabelText("目标链接"), "https://beta.test/");
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await screen.findByText("beta.test");

    await user.click(screen.getByRole("button", { name: "Google" }));
    await waitFor(() => {
      const output = screen.getByDisplayValue(/# NAME: Google/) as HTMLTextAreaElement;
      expect(output.value).toContain("alpha.test");
      expect(output.value).not.toContain("beta.test");
    });
    await user.clear(screen.getByLabelText("目标链接"));
    await user.type(screen.getByLabelText("目标链接"), "https://gamma.test/");
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));

    await waitFor(() => {
      const output = screen.getByDisplayValue(/# NAME: Google/) as HTMLTextAreaElement;
      expect(output.value).toMatch(/alpha.test[\s\S]*gamma.test|gamma.test[\s\S]*alpha.test/);
      expect(output.value).not.toContain("beta.test");
    });
  }, 10_000);

  it("supports custom tags, strict DIRECT evidence, and regenerating edited output", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://direct.example/",
              finalUrl: "https://direct.example/",
              workerReachable: true,
              statusCode: 204,
              fetchError: "",
              evidenceStatus: "DIRECT_VERIFIED",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 2 },
              hosts: [{
                host: "direct.example",
                category: "direct-cn",
                rule: "DOMAIN,direct.example",
                reasons: ["Surge evidence shows direct connection"],
                score: 100,
                selected: true,
                evidence: "DIRECT_VERIFIED",
                confidence: "target",
              }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "Custom" }));
    expect(screen.getByLabelText("Path")).toHaveValue("rules/Custom.list");
    await user.clear(screen.getByLabelText("自定义标签"));
    await user.type(screen.getByLabelText("自定义标签"), "Research");
    await user.clear(screen.getByLabelText("目标链接"));
    await user.type(screen.getByLabelText("目标链接"), "https://direct.example/");
    await user.type(screen.getByLabelText("Surge dump/log 输入"), "direct.example DIRECT");
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));

    expect(await screen.findByText("Surge 证据显示 DIRECT，才可视为直连")).toBeInTheDocument();
    expect(screen.getByText("2 个域名")).toBeInTheDocument();
    expect(screen.getByDisplayValue(/# NAME: Research/)).toBeInTheDocument();

    const output = screen.getByDisplayValue(/DOMAIN,direct.example/);
    await user.clear(output);
    await user.type(output, "DOMAIN,manual.example\n");
    expect(screen.getByText("使用用户编辑后的文本进行复制、下载和上传。")).toBeInTheDocument();
    await user.click(screen.getByTitle("Regenerate"));
    expect(screen.getByDisplayValue(/DOMAIN,direct.example/)).toBeInTheDocument();
    expect(screen.queryByDisplayValue(/manual.example/)).not.toBeInTheDocument();
  }, 10_000);

  it("copies, downloads, and reports analyze or upload failures", async () => {
    const user = userEvent.setup();
    const clipboard = { writeText: vi.fn(async () => undefined) };
    Object.defineProperty(navigator, "clipboard", { value: clipboard, configurable: true });
    if (!URL.createObjectURL) {
      Object.defineProperty(URL, "createObjectURL", { value: () => "", configurable: true });
    }
    if (!URL.revokeObjectURL) {
      Object.defineProperty(URL, "revokeObjectURL", { value: () => undefined, configurable: true });
    }
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:rules");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const target = String(input);
        if (target === "/api/analyze") {
          return new Response(JSON.stringify({ error: "bad url" }), { status: 400 });
        }
        if (target === "/api/github/upload") {
          return new Response(JSON.stringify({ error: "denied" }), { status: 400 });
        }
        throw new Error("direct blocked");
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByTitle("Copy"));
    await user.click(screen.getByTitle("Download"));
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("# NAME: AI"));
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:rules");
    expect(clickSpy).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("bad url")).toBeInTheDocument();
    expect(screen.getByText(/当前路径不可达/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Owner"), "o");
    await user.type(screen.getByLabelText("Repo"), "r");
    await user.type(screen.getByLabelText("Fine-grained PAT"), "github_pat_12345678901234567890");
    await user.click(screen.getByRole("button", { name: "增量保存 .list" }));
    expect(await screen.findByText("denied")).toBeInTheDocument();
  });
});
