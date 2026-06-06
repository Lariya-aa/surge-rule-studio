# Surge Rule Studio — 4-Feature Optimization Plan

**Created**: 2026-06-06
**Status**: ✅ Completed (2026-06-06)
**Commit**: 335beeb
**Coverage target**: 95%

---

## Problem Analysis

### Issue 1: Refresh button appears non-functional
The "Regenerate" button (RotateCcw icon, line 436 of `RuleWorkbench.tsx`) sets `surgeEdited=false` and `surgeDraft=""`, which causes the textarea to show `generatedSurgeList`. But `generatedSurgeList` is a `useMemo` whose dependencies haven't changed, so the output is identical. The button works correctly as a "revert edits" toggle but has no visible feedback.

### Issue 2: google.com produces 500+ hosts
`extractCandidates()` uses 7 regex patterns including an aggressive bare-domain pattern. Google's ~200KB HTML/JS contains hundreds of domain-like strings. Each host is treated independently with no base-domain consolidation. `DOMAIN-SUFFIX,google.com` already covers all `*.google.com` subdomains, but the UI shows every individual host.

### Issue 3: No custom tag creation
The "Custom" tag is hardcoded. Users can type a name but can't create persistent tags with paths.

### Issue 4: Browser probe is proxy-dependent
`probeDirect()` uses `fetch()` with `mode: "no-cors"`. If Surge is running, the fetch succeeds even for blocked domains.

---

## Phase 1: Domain Consolidation & Rule Deduplication

**Goal**: Reduce 500+ hosts to grouped entries. Subdomains collapse under their base domain.

### Key Insight
`DOMAIN-SUFFIX,google.com` already covers all `*.google.com` subdomains. The current code generates this correctly — the problem is the UI shows every individual host, and there's no grouping.

### Changes

#### 1.1 `src/lib/surge.ts` — Add `consolidateDomains()` function
- Group classified domains by `(category, baseDomain(host))` — NOT just `baseDomain`
- Cross-category domains with the same baseDomain remain separate groups
- Return `DomainGroup[]` structure for UI display
- Each group: `{ baseDomain: string, category: RuleCategory, domains: ClassifiedDomain[], expanded: boolean }`

#### 1.2 `app/components/RuleWorkbench.tsx` — Grouped display
- Process `domains` through `consolidateDomains()` to get `DomainGroup[]`
- UI: show baseDomain with badge "N subdomains covered"
- Expandable: click baseDomain to show/hide children
- Parent checkbox toggles all children
- When parent is selected, children show "covered by parent" indicator

#### 1.3 `src/lib/surge.ts` — Improve bare-domain filter
- Add more entries to `BARE_DOMAIN_DENYLIST` for common false positives
- Add minimum label-length filter

### Acceptance Criteria
1. `google.com` analysis produces ≤100 grouped entries (not 500+)
2. Each group shows baseDomain + subdomain count
3. Selecting parent selects all children
4. Generated Surge list has no duplicate DOMAIN-SUFFIX rules
5. Cross-category domains with same baseDomain stay in separate groups
6. All existing tests pass

### Files
- `src/lib/surge.ts`
- `app/components/RuleWorkbench.tsx`
- `tests/surge.test.ts` (new tests for `consolidateDomains`)
- `tests/rule-workbench.test.tsx` (update for grouped UI)

---

## Phase 2: Custom Tags with [+] Button

**Goal**: Users can create, persist, and delete custom tags.

### Changes

#### 2.1 `app/components/RuleWorkbench.tsx` — Custom tag management
- Add `[+]` button at end of tag list (after last built-in tag)
- Click opens inline form: tag name input + path input + Save/Cancel
- New tags added to `purposeTags` state (convert from const)
- Custom tags stored in `localStorage` key `surge-studio-custom-tags`
- On mount, load custom tags from localStorage and merge with built-in
- Each custom tag shows `×` button to delete
- Path auto-suggests `rules/{tagName.replace(/\s+/g, '-').toLowerCase()}.list` on name change
- Don't overwrite path if user has manually edited it

#### 2.2 `app/components/RuleWorkbench.tsx` — Remove hardcoded "Custom" tag
- The [+] button replaces the need for a hardcoded "Custom" entry
- Simplify `customTag` state and related logic

#### 2.3 Tests
- Add `localStorage.clear()` to `afterEach` in `tests/rule-workbench.test.tsx`
- Test tag creation, persistence, deletion

### Acceptance Criteria
1. Click [+], create tag "MyService", verify it appears in tag list
2. Refresh page, verify custom tag persists
3. Delete custom tag, verify it's removed
4. Path auto-suggests correctly
5. All existing tests pass

### Files
- `app/components/RuleWorkbench.tsx`
- `tests/rule-workbench.test.tsx`

---

## Phase 3: DNS-Based Direct Connectivity Detection

**Goal**: Objective, proxy-independent determination of domain accessibility from China.

### Approach
DNS-over-HTTPS (DoH) + IP geolocation. Query public DoH resolvers for A/AAAA records, check if resolved IPs fall within Chinese IP ranges. Independent of browser proxy configuration.

### Changes

#### 3.1 New file `src/lib/connectivity.ts`
```typescript
export interface ConnectivityResult {
  host: string;
  status: "direct" | "likely-direct" | "likely-proxy" | "proxy" | "unknown";
  reason: string;
  resolvedIps: string[];
  isChinaIp: boolean;
}

export async function checkConnectivity(host: string, fetcher?: typeof fetch): Promise<ConnectivityResult>
export async function batchCheckConnectivity(hosts: string[], fetcher?: typeof fetch): Promise<ConnectivityResult[]>
```

- Query `https://cloudflare-dns.com/dns-query?name={host}&type=A` (and `AAAA`)
- Also query `https://dns.google/resolve?name={host}&type=A` as fallback
- Extract IP addresses from both response formats
- Check IPs against Chinese IP ranges from APNIC delegated stats

#### 3.2 `src/lib/connectivity.ts` — Chinese IP range checker
- Source: APNIC delegated stats (`https://ftp.apnic.net/stats/apnic/delegated-apnic-latest`)
- Parse CN IPv4 and IPv6 allocations
- Cache parsed ranges (module-level constant or build-time generation)
- `function isChinaIp(ip: string): boolean`
- `function ipToLong(ip: string): number` for IPv4 range checking
- `function ipv6ToBigInt(ip: string): bigint` for IPv6 range checking

#### 3.3 New file `app/api/connectivity/route.ts`
```typescript
POST /api/connectivity
Body: { hosts: string[] }
Response: { results: ConnectivityResult[] }
```
- Calls `batchCheckConnectivity(hosts)`
- Returns results for all requested hosts

#### 3.4 `app/components/RuleWorkbench.tsx` — Connectivity badges
- After analysis completes, call `/api/connectivity` with discovered hosts
- Show badge next to each domain:
  - 🟢 直连 (direct)
  - 🟡 可能直连 (likely-direct)
  - 🔴 需代理 (likely-proxy/proxy)
  - ⚪ 未知 (unknown)
- Badge is informational — doesn't change domain category
- Users can use badge info to manually reclassify

#### 3.5 Keep browser probe as reference
- Rename "当前访问路径" to "浏览器路径（参考）"
- Add tooltip: "此结果受代理软件影响，仅供参考。DNS 检测结果更客观。"
- Keep existing `probeDirect()` logic unchanged

### Acceptance Criteria
1. `baidu.com` → connectivity badge shows 🟢 直连
2. `google.com` → connectivity badge shows 🔴 需代理
3. `apple.com` → connectivity badge shows 🟡 or ⚪
4. DoH queries work from Cloudflare Workers
5. IP range checking covers major Chinese allocations
6. All existing tests pass
7. New connectivity module has ≥95% coverage

### Files
- `src/lib/connectivity.ts` (new)
- `app/api/connectivity/route.ts` (new)
- `app/components/RuleWorkbench.tsx`
- `tests/connectivity.test.ts` (new)

### Risk
DoH queries from Cloudflare Workers may be rate-limited. Mitigation: batch queries, cache results, fallback to single resolver.

---

## Phase 4: Refresh Button & UI Polish

**Goal**: Fix refresh button feedback and improve UX.

### Changes

#### 4.1 `app/components/RuleWorkbench.tsx` — Refresh button fix
- Toast only shows when `surgeEdited` was true before clicking (actual revert happened)
- If no edits exist, button shows brief pulse animation (no misleading toast)
- If no domains exist (no analysis run), disable button with tooltip "请先运行判断"

#### 4.2 `app/components/RuleWorkbench.tsx` — Edit indicator
- When `surgeEdited` is true, show "已编辑" badge near textarea header
- Badge disappears on regenerate

### Acceptance Criteria
1. Edit textarea → "已编辑" badge appears
2. Click regenerate → badge disappears, text reverts, toast shows "已还原"
3. No edits → click regenerate → pulse animation, no toast
4. No analysis → button disabled with tooltip

### Files
- `app/components/RuleWorkbench.tsx`

---

## Implementation Order

Phase 1 → Phase 2 → Phase 3 → Phase 4

Each phase is independently mergeable and shippable.

---

## Verification Commands

```bash
npm run test           # Unit + integration tests
npm run lint           # ESLint
npm run build          # Production build
npm run test:e2e       # Playwright E2E tests
```

## Coverage Thresholds

Current: 90% statements, 85% branches, 90% functions, 90% lines
Target: 95% all axes

---

## Out of Scope
- Changing Surge dump/log evidence parsing
- Modifying GitHub upload flow
- Adding new rule types (DOMAIN-KEYWORD, IP-CIDR)
- Changing D1 database schema
