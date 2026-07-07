# @webmaxru/cookieless-insights

**Cookieless, consent-banner-free Real User Monitoring for static sites** — page views,
sessions, engagement time, geo, browser/OS, and your own custom events, sent to **your**
Azure Application Insights on the **free tier**.

- 🍪 **No cookie / GDPR banner.** No cookies, no local/session storage, no persistent
  identifier. Cookieless by construction.
- 🪶 **Tiny.** A dependency-free **beacon** (a couple of KB gzipped) by default — or opt into
  the official **Application Insights JS SDK** adapter when you want its full feature set
  (~78 KB gzipped).
- ☁️ **Your data, free tier.** Ships to workspace-based Application Insights with a 30-day
  retention + 0.16 GB/day cap recipe that stays inside Azure's 5 GB/month free grant.
- 🧩 **Framework-agnostic.** React, Vue, Svelte, Solid, or vanilla — anything that builds to
  static files (GitHub Pages, Azure Static Web Apps, Netlify, S3, …).
- 🛠️ **Batteries included.** A CLI to provision Azure, deploy an engagement **dashboard**, and
  pull a **terminal report**.

> **Not a Microsoft product.** A personal open-source project by
> [@webmaxru](https://github.com/webmaxru). "Azure" and "Application Insights" are trademarks
> of Microsoft.

## Why not the Azure Monitor OpenTelemetry Distro?

A static site is **browser-only**. Per Microsoft Learn, the OpenTelemetry Distro is
**server-side** (ASP.NET Core / Java / Node.js / Python), and the **Application Insights
JavaScript SDK is "the supported client-side browser instrumentation path… it doesn't use
OpenTelemetry."** This library implements that browser/RUM path — as a tiny beacon by default,
with the SDK available as an adapter.

## Quick start

### 1. Create Azure resources (free tier)

```bash
npm i -g @webmaxru/cookieless-insights   # or use npx below
npx cookieless-insights setup --name my-site --location westeurope --run
```

This creates a resource group, a workspace-based Application Insights (30-day retention), caps
ingestion at 0.16 GB/day, and prints the **connection string** (a public client key). Reuse an
existing resource group by passing `--resource-group <name>`.

### 2. Install and wire it up

```bash
npm i @webmaxru/cookieless-insights
```

```ts
import { init, trackEvent, trackChangeDebounced } from '@webmaxru/cookieless-insights';

// Once, at your app entry. Safe no-op if the connection string is absent.
init({ connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING });

// Anywhere a meaningful interaction happens:
trackEvent('Signup Clicked', { plan: 'pro' });
trackChangeDebounced('Slider Changed', 'volume'); // collapses drags into one event
```

An automatic page view is sent on init. `trackChangeDebounced` is ideal for sliders/typing.

### 3. Provide the connection string at build time

The connection string is a **public, write-only ingestion key** — it is expected to ship in the
browser bundle. Provide it via your bundler's env, **not** as a secret:

- **Local:** add `VITE_APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=…` to `.env`.
- **CI (e.g. GitHub Pages):** store it as a repo **variable** and pass it to the build step:

  ```yaml
  - run: npm run build
    env:
      VITE_APPINSIGHTS_CONNECTION_STRING: ${{ vars.VITE_APPINSIGHTS_CONNECTION_STRING }}
  ```

> Using a bundler other than Vite? Expose the value however that tool injects public env vars
> (`process.env.NEXT_PUBLIC_…`, `import.meta.env.PUBLIC_…`, a `define` replacement, etc.) and
> pass it to `init({ connectionString })`.

### 4. Deploy the dashboard & pull a report

```bash
# Deploy the Azure Portal engagement dashboard
npx cookieless-insights dashboard --app-insights-id <appInsightsResourceId>

# Print engagement to the terminal (and open the dashboard)
npx cookieless-insights report --resource-group my-site-rg --app-insights my-site-ai --days 30 --open
```

## Kill switch

One line disables **all** telemetry (no beacon, no SDK load):

```ts
init({ connectionString, enabled: false });
```

Or toggle at runtime: `getClient()?.setEnabled(false)`. With the SDK adapter, building without
a connection string also tree-shakes the SDK out entirely.

## Beacon vs. SDK

| | `@webmaxru/cookieless-insights` (beacon) | `@webmaxru/cookieless-insights/appinsights` (SDK) |
|---|---|---|
| Size | ~2 KB gzipped, zero deps | ~78 KB gzipped (`@microsoft/applicationinsights-web` peer dep) |
| Transport | `navigator.sendBeacon` / `fetch` keepalive | full SDK pipeline |
| Cookieless | by construction | `disableCookiesUsage` + no session storage |
| Page views, events, geo, browser/OS | ✅ | ✅ |
| Auto AJAX/dependency/perf, live metrics | ➖ | ✅ |

```ts
import { initAppInsights } from '@webmaxru/cookieless-insights/appinsights';
const analytics = await initAppInsights({ connectionString });
```

## API

`init(options)` → `Analytics` (default beacon singleton). `createBeaconClient(options)` for a
non-singleton instance. `initAppInsights(options)` (from `/appinsights`) for the SDK.

**`InitOptions`**: `connectionString` (required), `enabled` (default `true`), `samplingRate`
(0–1, default 1), `cloudRole`, `autoPageView` (default `true`), `flushIntervalMs` (default
5000), `maxBatchSize` (default 50).

**`Analytics`**: `trackEvent(name, properties?, measurements?)`,
`trackPageView(name?, uri?, properties?)`, `trackChangeDebounced(name, key, delayMs?)`,
`flush()`, `setEnabled(enabled)`, `enabled`.

Top-level helpers `trackEvent`, `trackPageView`, `trackChangeDebounced`, `flush`, `setEnabled`,
and `getClient()` operate on the singleton created by `init`.

## Privacy

Cookieless RUM sets **no cookies and no local/session storage** and creates **no persistent
identifier**, so it does not require a cookie/consent banner. A fresh in-memory session id is
generated per page load. The client IP is used transiently by Azure to derive coarse geo
(city/country) and is not stored on the telemetry. Do not pass PII into event properties.

## Free tier

`setup` provisions **workspace-based** Application Insights with **30-day retention** (free) and
a **0.16 GB/day** ingestion cap — Microsoft's documented "160 MB/day stays under the 5 GB/month
free grant". Real static-site traffic is a tiny fraction of that.

## CLI

| Command | Purpose |
|---|---|
| `cookieless-insights init` | Scaffold the dashboard template + PowerShell scripts and print wiring |
| `cookieless-insights setup --name … --location … [--run]` | Print/run the Azure free-tier setup |
| `cookieless-insights dashboard --app-insights-id <id>` | Deploy the Portal engagement dashboard |
| `cookieless-insights report [--days N] [--open]` | Print engagement to the terminal / open the dashboard |

All Azure commands shell out to the [Azure CLI](https://learn.microsoft.com/cli/azure/) (`az login` first).

## Examples

- [React + Vite](examples/react-vite.md)
- [Vanilla / any bundler](examples/vanilla.md)

## Use with an AI agent (skill)

This repo ships an agent **skill** ([`skills/cookieless-insights`](skills/cookieless-insights/SKILL.md))
so your coding agent (GitHub Copilot, Claude Code, Cursor, …) can perform the whole
instrumentation for you. Install it with [APM](https://github.com/microsoft/apm) or the
[`skills`](https://github.com/vercel-labs/skills) CLI:

```bash
# APM (Agent Package Manager)
apm install webmaxru/cookieless-insights/skills/cookieless-insights

# npx skills
npx skills add webmaxru/cookieless-insights --skill cookieless-insights
```

Then just ask your agent:

> Instrument this static site with cookieless-insights.

Or paste the fuller [**sample prompt**](skills/cookieless-insights/PROMPT.md):

> Instrument this static site with cookieless Azure Application Insights using
> `@webmaxru/cookieless-insights` — **no cookie/GDPR banner, Azure free tier only**. Reuse my
> project's resource group if it exists (else create one), wire page views + all key
> interactions (debounce sliders/typing), inject the connection string at **build time** via a
> CI variable, deploy the engagement dashboard, add the report command, then build, commit, and
> **redeploy**. Use the beacon transport; keep a one-line kill switch.

## Releasing (maintainers)

Versioning uses [changesets](https://github.com/changesets/changesets); publishing uses npm
**OIDC Trusted Publishing** (no `NPM_TOKEN`). The Release workflow is gated behind the
`ENABLE_NPM_PUBLISH` repo variable. To enable it (one-time): bootstrap the first publish
manually (`npm publish --access public` — Trusted Publishing can't create a brand-new name),
configure Trusted Publishing on npm for this repo, then `gh variable set ENABLE_NPM_PUBLISH --body true`.
Thereafter, add a changeset (`npx changeset`) and merge the auto-created "Version Packages" PR to publish.

## License

[MIT](LICENSE) © Maxim Salnikov
