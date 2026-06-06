# Surge Rule Studio

A self-hosted tool for analyzing website domains, classifying direct/proxy/blocked connectivity, and generating Surge proxy rules.

## Features

- **Domain Extraction** — Automatically extracts all domains from HTML/CSS/JS/JSON resources
- **Smart Classification** — Categorizes domains into: Direct CN, Proxy Global, Region-Sensitive, Blocked, Ad/Tracking
- **DNS Connectivity Detection** — Uses DNS-over-HTTPS (Cloudflare/Google) to determine if domains resolve to Chinese IPs
- **Ad/Tracker Filtering** — 263+ known ad/tracker domain suffixes + keyword-based subdomain matching
- **Domain Grouping** — Collapses subdomains under base domains; highlights the input domain
- **Connectivity Filter** — Filter domain list by direct/proxy/unknown status
- **Domain Search** — Quick search across discovered domains
- **Purpose Tags** — AI, Google, YouTube, Netflix, Game, Podcast, Ads, Privacy, and custom tags
- **Custom Tags** — Create, persist, and delete custom tags with localStorage
- **Surge Evidence** — Paste Surge dump/logs to identify DIRECT/PROXY/BLOCKED evidence
- **GitHub Upload** — Incremental save rules to GitHub repository

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router) |
| Runtime | Cloudflare Workers (via vinext) |
| Database | Cloudflare D1 |
| UI | React 19, Tailwind CSS 4, Lucide Icons |
| Testing | Vitest, @testing-library/react, Playwright |
| Deploy | Cloudflare Workers / Docker |

## Quick Start

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Docker

```bash
# Build
docker build -t surge-rule-studio .

# Run locally
docker run -p 3000:3000 surge-rule-studio

# Run with Docker Compose (see docker-compose.yml)
docker compose up -d
```

## Deployment

### Cloudflare Workers (recommended)

1. Set CI/CD variables in GitLab → Settings → CI/CD → Variables:
   - `CLOUDFLARE_API_TOKEN` — Your Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID` — Your Cloudflare account ID
2. Push to `main` branch
3. Go to CI/CD → Pipelines → Run the `deploy` job manually

### GitLab CI/CD

The `.gitlab-ci.yml` defines two stages:
- **test** — Runs on every push and merge request
- **deploy** — Manual trigger on `main` branch, deploys to Cloudflare Workers

### GitHub + Cloudflare Pages (mirror)

1. Add GitHub as a push mirror in GitLab → Settings → Repository → Mirrors
2. Connect the GitHub repo to Cloudflare Pages
3. Set build command: `npm run build`, output directory: `dist/client`

## Testing

```bash
npm run test            # Run tests with coverage
npm run test:watch      # Watch mode
npm run test:e2e        # Playwright E2E tests
```

Coverage thresholds (enforced): statements/branches/functions/lines ≥ 95%.

## Project Structure

```
├── app/                    # Next.js App Router
│   ├── api/                # API routes
│   │   ├── analyze/        # Domain analysis endpoint
│   │   ├── connectivity/   # DNS connectivity check
│   │   └── github/         # GitHub upload endpoint
│   └── components/
│       └── RuleWorkbench.tsx   # Main UI component
├── src/lib/
│   ├── surge.ts            # Domain extraction, classification, rule generation
│   ├── connectivity.ts     # DNS-over-HTTPS + Chinese IP detection
│   ├── probe.ts            # URL analysis orchestrator
│   └── github.ts           # GitHub Contents API client
├── worker/
│   └── index.ts            # Cloudflare Worker entry point
├── tests/                  # Test files
├── Dockerfile
├── .gitlab-ci.yml
└── vitest.config.ts
```

## License

[MIT](LICENSE)
