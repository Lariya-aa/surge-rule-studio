# Surge Rule Studio

Surge Rule Studio is a self-hostable Sites app for checking whether a URL is
directly reachable from the user's browser, classifying discovered domains, and
exporting selected results as Surge `.list` rules.

## What it does

- Runs a browser-side direct-connect probe for the current user network.
- Runs a server-side fetch to extract domains from readable HTML, CSS, JSON, JS,
  XML, SVG, and related text resources.
- Accepts pasted `surge-cli --raw dump recent` JSON or loose Surge logs, then
  classifies those hosts as blocked candidates.
- Classifies domains as domestic direct, global proxy, region-sensitive,
  blocked, or ad/promotion/tracking candidates.
- Lets users override labels and selection before generating Surge rules.
- Supports exact `DOMAIN` rules or collapsed `DOMAIN-SUFFIX` rules.
- Merges selected rules into a user's GitHub `.list` file through the GitHub
  Contents API.
- Keeps developer link icons in the UI. Fill
  `src/config/developerLinks.ts` before publishing a public fork.

## Privacy boundaries

- GitHub tokens are used only for the current upload request and are never saved
  to D1.
- D1 stores aggregate domain observation counts and export counts only. It does
  not persist the full URL submitted by the user.
- Ad/tracker detection is a candidate classification, not an automatic block
  decision. Users choose whether those rules are exported.

## Local development

```bash
npm install
npm run dev -- --hostname 127.0.0.1 --port 3000
```

Open `http://127.0.0.1:3000`.

## Verification

```bash
npm run db:generate
npm run test
npm run lint
npm run build
npm run test:e2e
```

Coverage thresholds are enforced in `vitest.config.ts`: statements, functions,
and lines must stay at or above 90%; branches must stay at or above 85%.

## Deployment

This project uses the bundled Sites vinext layout. `.openai/hosting.json`
declares:

- `project_id`: remote Sites project id
- `d1`: logical D1 binding name, `DB`
- `r2`: unused

After schema changes, run `npm run db:generate` and keep the generated
`drizzle/` migration files with the source.
