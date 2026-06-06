import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import RuleWorkbench from "@/app/components/RuleWorkbench";
import { connectivityBadge } from "@/app/components/RuleWorkbench";

describe("RuleWorkbench", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    try { localStorage.clear(); } catch { /* ignore */ }
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
    await user.click(screen.getByTitle("添加自定义标签"));
    await user.type(screen.getByPlaceholderText("标签名称"), "Research");
    await user.click(screen.getByRole("button", { name: "保存" }));
    expect(screen.getByLabelText("Path")).toHaveValue("rules/research.list");
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

  it("groups subdomains under base domain with expandable sections", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://example.com/",
              finalUrl: "https://example.com/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "UNKNOWN",
              blockedHosts: [],
              stats: { discoveredHosts: 4, surgeEvidenceHosts: 0 },
              hosts: [
                { host: "example.com", category: "proxy-global", rule: "DOMAIN,example.com", reasons: ["target"], score: 100, selected: true, evidence: "UNKNOWN", confidence: "target" },
                { host: "api.example.com", category: "proxy-global", rule: "DOMAIN-SUFFIX,example.com", reasons: ["subdomain"], score: 85, selected: true, evidence: "UNKNOWN", confidence: "target" },
                { host: "cdn.example.com", category: "proxy-global", rule: "DOMAIN-SUFFIX,example.com", reasons: ["subdomain"], score: 85, selected: true, evidence: "UNKNOWN", confidence: "provider" },
                { host: "other.com", category: "direct-cn", rule: "DOMAIN,other.com", reasons: ["cn"], score: 78, selected: true, evidence: "UNKNOWN", confidence: "noise" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await screen.findByText("example.com");

    expect(screen.getByText("3 子域名")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /展开/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /展开/ }));
    expect(screen.getByText("api.example.com")).toBeInTheDocument();
    expect(screen.getByText("cdn.example.com")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /收起/ })).toBeInTheDocument();

    const childCheckbox = screen.getByLabelText("Select api.example.com");
    fireEvent.click(childCheckbox);
    await waitFor(() => {
      expect(screen.getByLabelText("Select api.example.com")).not.toBeChecked();
    });

    // Also test category change on child domain
    const categorySelect = screen.getByLabelText("Category for api.example.com");
    fireEvent.change(categorySelect, { target: { value: "direct-cn" } });
    await waitFor(() => {
      expect(screen.getByLabelText("Category for api.example.com")).toHaveValue("direct-cn");
    });

    // Collapse the group by clicking the toggle button again
    const toggleButton = screen.getByText("收起").closest("button")!;
    await user.click(toggleButton);
    await waitFor(() => {
      expect(screen.getByText("展开")).toBeInTheDocument();
    });

    await user.selectOptions(screen.getByLabelText("Category for api.example.com"), "direct-cn");
    expect(screen.getByLabelText("Category for api.example.com")).toHaveValue("direct-cn");

    const selectAll = screen.getByLabelText("Select all example.com");
    expect(selectAll).toBeInTheDocument();

    await user.click(selectAll);
    await waitFor(() => {
      expect(screen.getByLabelText("Category for api.example.com")).toHaveValue("direct-cn");
    });
  }, 10_000);

  it("creates and deletes custom tags via [+] button", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    render(<RuleWorkbench />);
    await user.click(screen.getByTitle("添加自定义标签"));
    await user.type(screen.getByPlaceholderText("标签名称"), "MyTag");
    // Also type in the path input to cover its onChange
    await user.clear(screen.getByPlaceholderText("rules/Tag.list"));
    await user.type(screen.getByPlaceholderText("rules/Tag.list"), "custom/my-tag.list");
    await user.click(screen.getByRole("button", { name: "保存" }));

    expect(screen.getByRole("button", { name: "MyTag" })).toBeInTheDocument();

    await user.click(screen.getByTitle('删除标签 "MyTag"'));
    expect(screen.queryByRole("button", { name: "MyTag" })).not.toBeInTheDocument();
  });

  it("handles empty URL in titleFromUrl gracefully", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    render(<RuleWorkbench />);
    await user.clear(screen.getByLabelText("目标链接"));
    // The generated surge list should still render (using fallback title)
    await waitFor(() => {
      expect(screen.getByDisplayValue(/# NAME:/)).toBeInTheDocument();
    });
  });

  it("cancels custom tag creation", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    render(<RuleWorkbench />);
    await user.click(screen.getByTitle("添加自定义标签"));
    await user.type(screen.getByPlaceholderText("标签名称"), "TempTag");
    await user.click(screen.getByRole("button", { name: "取消" }));

    expect(screen.queryByPlaceholderText("标签名称")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "TempTag" })).not.toBeInTheDocument();
  });

  it("shows connectivity badges after analysis", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/analyze") {
        return new Response(
          JSON.stringify({
            inputUrl: "https://example.com/",
            finalUrl: "https://example.com/",
            workerReachable: true,
            statusCode: 200,
            fetchError: "",
            evidenceStatus: "UNKNOWN",
            blockedHosts: [],
            stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
            hosts: [
              { host: "example.com", category: "proxy-global", rule: "DOMAIN,example.com", reasons: ["target"], score: 100, selected: true, evidence: "UNKNOWN", confidence: "target" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url === "/api/connectivity") {
        return new Response(
          JSON.stringify({
            results: [
              { host: "example.com", status: "likely-proxy", reason: "Resolved to 93.184.216.34", resolvedIps: ["93.184.216.34"], isChinaIp: false },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await screen.findByText("example.com");

    // Wait for connectivity API to be called
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/connectivity", expect.any(Object));
    });

    // Wait for badge to appear
    await waitFor(() => {
      expect(screen.getByTitle("Resolved to 93.184.216.34")).toBeInTheDocument();
    });
  }, 15_000);

  it("shows connectivity badges in expanded group child domains", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/analyze") {
        return new Response(
          JSON.stringify({
            inputUrl: "https://example.com/",
            finalUrl: "https://example.com/",
            workerReachable: true,
            statusCode: 200,
            fetchError: "",
            evidenceStatus: "UNKNOWN",
            blockedHosts: [],
            stats: { discoveredHosts: 2, surgeEvidenceHosts: 0 },
            hosts: [
              { host: "example.com", category: "proxy-global", rule: "DOMAIN,example.com", reasons: ["target"], score: 100, selected: true, evidence: "UNKNOWN", confidence: "target" },
              { host: "api.example.com", category: "proxy-global", rule: "DOMAIN-SUFFIX,example.com", reasons: ["subdomain"], score: 85, selected: true, evidence: "UNKNOWN", confidence: "target" },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url === "/api/connectivity") {
        return new Response(
          JSON.stringify({
            results: [
              { host: "example.com", status: "likely-proxy", reason: "Resolved to 93.184.216.34", resolvedIps: ["93.184.216.34"], isChinaIp: false },
              { host: "api.example.com", status: "likely-proxy", reason: "Resolved to 93.184.216.35", resolvedIps: ["93.184.216.35"], isChinaIp: false },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response("", { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await screen.findByText("example.com");

    // Wait for connectivity API
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/connectivity", expect.any(Object));
    });

    // Expand the group
    await user.click(screen.getByRole("button", { name: /展开/ }));
    await waitFor(() => {
      expect(screen.getByText("api.example.com")).toBeInTheDocument();
    });

    // Verify badge in expanded child view
    await waitFor(() => {
      expect(screen.getByTitle("Resolved to 93.184.216.35")).toBeInTheDocument();
    });
  }, 15_000);

  it("renders blocked probe status and error messages", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(JSON.stringify({ error: "bad url" }), { status: 400 });
        }
        throw new Error("network error");
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("bad url")).toBeInTheDocument();
    expect(screen.getByText(/当前路径不可达/)).toBeInTheDocument();
  });

  it("handles analyze with empty hosts gracefully", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://empty.test/",
              finalUrl: "https://empty.test/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "UNKNOWN",
              blockedHosts: [],
              stats: { discoveredHosts: 0, surgeEvidenceHosts: 0 },
              hosts: [],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await waitFor(() => {
      expect(screen.getAllByText(/暂无域名/).length).toBeGreaterThan(0);
    });
  });

  it("generates rules with correct tag name from URL", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://test.example/",
              finalUrl: "https://test.example/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "UNKNOWN",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
              hosts: [{
                host: "test.example",
                category: "proxy-global",
                rule: "DOMAIN,test.example",
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
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("test.example")).toBeInTheDocument();
  });

  it("handles non-Error analyze and upload failures", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          throw "string-error";
        }
        if (url === "/api/github/upload") {
          throw "upload-string-error";
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("Analyze request failed")).toBeInTheDocument();
  });

  it("switches between suffix and exact mode", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    render(<RuleWorkbench />);
    // Default is suffix mode
    expect(screen.getByRole("button", { name: "后缀规则" })).toHaveClass("bg-[#173b35]");
    expect(screen.getByRole("button", { name: "精确规则" })).not.toHaveClass("bg-[#173b35]");

    // Switch to exact mode
    await user.click(screen.getByRole("button", { name: "精确规则" }));
    expect(screen.getByRole("button", { name: "精确规则" })).toHaveClass("bg-[#173b35]");
    expect(screen.getByRole("button", { name: "后缀规则" })).not.toHaveClass("bg-[#173b35]");

    // Switch back to suffix mode
    await user.click(screen.getByRole("button", { name: "后缀规则" }));
    expect(screen.getByRole("button", { name: "后缀规则" })).toHaveClass("bg-[#173b35]");
  });

  it("shows correct tag highlight for different tags", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    render(<RuleWorkbench />);
    // Default tag is AI
    expect(screen.getByRole("button", { name: "AI" })).toHaveClass("bg-[#173b35]");

    // Switch to Google
    await user.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByRole("button", { name: "Google" })).toHaveClass("bg-[#173b35]");
    expect(screen.getByRole("button", { name: "AI" })).not.toHaveClass("bg-[#173b35]");

    // Switch to YouTube
    await user.click(screen.getByRole("button", { name: "YouTube" }));
    expect(screen.getByRole("button", { name: "YouTube" })).toHaveClass("bg-[#173b35]");
  });

  it("shows evidence status for all evidence types", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://test.example/",
              finalUrl: "https://test.example/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "BLOCKED_VERIFIED",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
              hosts: [{
                host: "test.example",
                category: "blocked",
                rule: "DOMAIN,test.example",
                reasons: ["blocked"],
                score: 95,
                selected: true,
                evidence: "BLOCKED_VERIFIED",
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
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("Surge 证据显示失败或阻断")).toBeInTheDocument();
  });

  it("shows PROXY_VERIFIED evidence status", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://test.example/",
              finalUrl: "https://test.example/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "PROXY_VERIFIED",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
              hosts: [{
                host: "test.example",
                category: "proxy-global",
                rule: "DOMAIN,test.example",
                reasons: ["proxy"],
                score: 88,
                selected: true,
                evidence: "PROXY_VERIFIED",
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
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("Surge 证据显示走代理，不是直连")).toBeInTheDocument();
  });

  it("shows DIRECT_VERIFIED evidence status", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://test.example/",
              finalUrl: "https://test.example/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "DIRECT_VERIFIED",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
              hosts: [{
                host: "test.example",
                category: "direct-cn",
                rule: "DOMAIN,test.example",
                reasons: ["direct"],
                score: 80,
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
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("Surge 证据显示 DIRECT，才可视为直连")).toBeInTheDocument();
  });

  it("shows UNKNOWN evidence status and browser probe blocked state", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://test.example/",
              finalUrl: "https://test.example/",
              workerReachable: false,
              statusCode: 500,
              fetchError: "server error",
              evidenceStatus: "UNKNOWN",
              blockedHosts: [],
              stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
              hosts: [{
                host: "test.example",
                category: "proxy-global",
                rule: "DOMAIN,test.example",
                reasons: ["default"],
                score: 50,
                selected: true,
                evidence: "UNKNOWN",
                confidence: "noise",
              }],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        throw new Error("blocked");
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("test.example")).toBeInTheDocument();
    expect(screen.getByText(/当前路径不可达/)).toBeInTheDocument();
    expect(screen.getByText("未提供可证明直连的 Surge 证据")).toBeInTheDocument();
  });

  it("renders all category tiles with correct tones", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/analyze") {
          return new Response(
            JSON.stringify({
              inputUrl: "https://test.example/",
              finalUrl: "https://test.example/",
              workerReachable: true,
              statusCode: 200,
              fetchError: "",
              evidenceStatus: "UNKNOWN",
              blockedHosts: [],
              stats: { discoveredHosts: 5, surgeEvidenceHosts: 0 },
              hosts: [
                { host: "direct.example", category: "direct-cn", rule: "DOMAIN,direct.example", reasons: ["cn"], score: 78, selected: true, evidence: "UNKNOWN", confidence: "noise" },
                { host: "proxy.example", category: "proxy-global", rule: "DOMAIN,proxy.example", reasons: ["default"], score: 50, selected: true, evidence: "UNKNOWN", confidence: "noise" },
                { host: "region.example", category: "region-sensitive", rule: "DOMAIN,region.example", reasons: ["region"], score: 82, selected: true, evidence: "UNKNOWN", confidence: "noise" },
                { host: "blocked.example", category: "blocked", rule: "DOMAIN,blocked.example", reasons: ["blocked"], score: 95, selected: true, evidence: "UNKNOWN", confidence: "noise" },
                { host: "ad.example", category: "ad-tracking", rule: "DOMAIN,ad.example", reasons: ["ad"], score: 90, selected: true, evidence: "UNKNOWN", confidence: "noise" },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          );
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    await screen.findByText("direct.example");

    // Verify all category sections are rendered
    expect(screen.getAllByText("国内直连").length).toBeGreaterThan(0);
    expect(screen.getAllByText("国外规则").length).toBeGreaterThan(0);
    expect(screen.getAllByText("区域敏感").length).toBeGreaterThan(0);
    expect(screen.getAllByText("阻断域名").length).toBeGreaterThan(0);
    expect(screen.getAllByText("广告/推广/跟踪").length).toBeGreaterThan(0);
  });

  it("shows analyzing state with disabled button", async () => {
    const user = userEvent.setup();
    let resolveFetch: (value: Response) => void;
    const fetchPromise = new Promise<Response>((resolve) => {
      resolveFetch = resolve;
    });
    vi.stubGlobal("fetch", vi.fn((input: RequestInfo | URL) => {
      const url = String(input);
      if (url === "/api/analyze") return fetchPromise;
      return Promise.resolve(new Response("", { status: 200 }));
    }));

    render(<RuleWorkbench />);
    const button = screen.getByRole("button", { name: "判断并生成规则" });
    expect(button).not.toBeDisabled();

    await user.click(button);
    expect(button).toBeDisabled();
    // Loader2 spinner should be visible during analysis
    expect(button.querySelector(".animate-spin")).toBeInTheDocument();

    // Resolve the fetch to clean up
    resolveFetch!(new Response(
      JSON.stringify({
        inputUrl: "https://test.example/",
        finalUrl: "https://test.example/",
        workerReachable: true,
        statusCode: 200,
        fetchError: "",
        evidenceStatus: "UNKNOWN",
        blockedHosts: [],
        stats: { discoveredHosts: 1, surgeEvidenceHosts: 0 },
        hosts: [{
          host: "test.example",
          category: "proxy-global",
          rule: "DOMAIN,test.example",
          reasons: ["test"],
          score: 90,
          selected: true,
          evidence: "UNKNOWN",
          confidence: "target",
        }],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    ));

    await waitFor(() => {
      expect(button).not.toBeDisabled();
    });
  });

  it("locks path after manual edit and prevents tag override", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn(async () => new Response("", { status: 200 })));

    render(<RuleWorkbench />);
    // Click AI tag to set path
    await user.click(screen.getByRole("button", { name: "AI" }));
    expect(screen.getByLabelText("Path")).toHaveValue("rules/AI.list");

    // Manually edit path (locks it)
    await user.clear(screen.getByLabelText("Path"));
    await user.type(screen.getByLabelText("Path"), "custom/My.list");

    // Click Google tag — path should NOT change because it's locked
    await user.click(screen.getByRole("button", { name: "Google" }));
    expect(screen.getByLabelText("Path")).toHaveValue("custom/My.list");
  });
});

describe("connectivityBadge", () => {
  it("returns correct badge for each status", () => {
    expect(connectivityBadge(undefined)).toEqual({ emoji: "⚪", label: "未知" });
    expect(connectivityBadge("direct")).toEqual({ emoji: "🟢", label: "直连" });
    expect(connectivityBadge("likely-direct")).toEqual({ emoji: "🟡", label: "可能直连" });
    expect(connectivityBadge("likely-proxy")).toEqual({ emoji: "🔴", label: "需代理" });
    expect(connectivityBadge("proxy")).toEqual({ emoji: "🔴", label: "需代理" });
    expect(connectivityBadge("unknown")).toEqual({ emoji: "⚪", label: "未知" });
  });
});
