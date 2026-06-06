import { expect, test } from "@playwright/test";

test("user can analyze, inspect categories, and see Surge output", async ({ page }) => {
  await page.route("**/api/analyze", async (route) => {
    await route.fulfill({
      contentType: "application/json",
      body: JSON.stringify({
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
    });
  });
  await page.route("https://apple.com/**", async (route) => {
    await route.fulfill({ status: 200, body: "" });
  });

  await page.goto("/", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "Surge Rule Studio" })).toBeVisible();
  await expect(page.getByTitle("GitHub URL placeholder")).toBeVisible();

  const targetInput = page.getByLabel("目标链接");
  await targetInput.click();
  await targetInput.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await targetInput.pressSequentially("https://apple.com/");
  await expect(page.getByRole("link", { name: "打开链接" })).toHaveAttribute("href", "https://apple.com/");
  await page.getByRole("button", { name: "判断并生成规则" }).click();

  await expect(page.locator(".font-mono", { hasText: "apple.com" }).first()).toBeVisible();
  await expect(page.locator(".font-mono", { hasText: "ads.doubleclick.net" }).first()).toBeVisible();
  await expect(page.locator("textarea").last()).toContainText("DOMAIN,apple.com");
});
