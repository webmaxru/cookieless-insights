# Vanilla / any bundler

The library is framework-agnostic — it only needs a connection string and calls to
`trackEvent` / `trackPageView`.

```html
<script type="module">
  import { init, trackEvent } from 'https://esm.sh/@webmaxru/cookieless-insights';

  init({ connectionString: 'InstrumentationKey=…;IngestionEndpoint=https://…/' });

  document.querySelector('#buy')?.addEventListener('click', () => {
    trackEvent('Buy Clicked', { sku: 'ABC-123' });
  });
</script>
```

Or bundled (esbuild/webpack/Rollup/Parcel):

```ts
import { init, trackEvent, trackPageView } from '@webmaxru/cookieless-insights';

init({ connectionString: process.env.APPINSIGHTS_CONNECTION_STRING });

// Single-page apps: send a page view on client-side navigation.
router.afterEach((to) => trackPageView(to.name, location.origin + to.fullPath));
```

Notes:

- Inject the connection string with your bundler's public-env mechanism (`define`,
  `process.env.PUBLIC_…`, `import.meta.env.PUBLIC_…`). It is a public client key by design.
- Prefer the heavier official SDK? Use `@webmaxru/cookieless-insights/appinsights`
  (`initAppInsights`) and install the `@microsoft/applicationinsights-web` peer dependency.
- Disable everything with `init({ connectionString, enabled: false })`.
