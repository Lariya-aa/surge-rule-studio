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
              blockedHosts: ["ads.doubleclick.net"],
              stats: { discoveredHosts: 3, surgeDumpHosts: 1 },
              hosts: [
                {
                  host: "apple.com",
                  category: "region-sensitive",
                  rule: "DOMAIN,apple.com",
                  reasons: ["Known region-sensitive official site"],
                  score: 82,
                  selected: true,
                },
                {
                  host: "www.qq.com",
                  category: "direct-cn",
                  rule: "DOMAIN-SUFFIX,qq.com",
                  reasons: ["Matches China TLD"],
                  score: 78,
                  selected: true,
                },
                {
                  host: "ads.doubleclick.net",
                  category: "blocked",
                  rule: "DOMAIN-SUFFIX,doubleclick.net",
                  reasons: ["Surge traffic/log marked it as blocked"],
                  score: 95,
                  selected: true,
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
    expect(screen.getByText(/可直连 \//)).toBeInTheDocument();
    expect(screen.getByText("1 个域名")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Category for apple.com"), "proxy-global");
    await user.click(screen.getByLabelText("Select ads.doubleclick.net"));

    await waitFor(() => {
      expect(screen.getByDisplayValue(/# 国外规则[\s\S]*DOMAIN,apple.com/)).toBeInTheDocument();
      expect(screen.getByDisplayValue(/# RULES: 2/)).toBeInTheDocument();
    });
  });

  it("posts generated rules to GitHub and clears the token after success", async () => {
    const user = userEvent.setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url === "/api/github/upload") {
          return new Response(JSON.stringify({ rawUrl: "https://raw.githubusercontent.com/o/r/main/rules/Custom.list" }), {
            status: 200,
          });
        }
        return new Response("", { status: 200 });
      }),
    );

    render(<RuleWorkbench />);
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
  });

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
    expect(clipboard.writeText).toHaveBeenCalledWith(expect.stringContaining("# NAME: linux.do"));
    expect(createObjectURL).toHaveBeenCalled();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:rules");
    expect(clickSpy).toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "判断并生成规则" }));
    expect(await screen.findByText("bad url")).toBeInTheDocument();
    expect(screen.getByText(/不可直连/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("Owner"), "o");
    await user.type(screen.getByLabelText("Repo"), "r");
    await user.type(screen.getByLabelText("Fine-grained PAT"), "github_pat_12345678901234567890");
    await user.click(screen.getByRole("button", { name: "增量保存 .list" }));
    expect(await screen.findByText("denied")).toBeInTheDocument();
  });
});
