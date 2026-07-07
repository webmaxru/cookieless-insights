# React + Vite

Install:

```bash
npm i @webmaxru/cookieless-insights
```

`.env` (local) / repo variable (CI):

```
VITE_APPINSIGHTS_CONNECTION_STRING=InstrumentationKey=…;IngestionEndpoint=https://…/
```

`src/analytics.ts`:

```ts
import { init } from '@webmaxru/cookieless-insights';

export const analytics = init({
  connectionString: import.meta.env.VITE_APPINSIGHTS_CONNECTION_STRING,
  // enabled: false,           // one-line kill switch
  // cloudRole: 'marketing-site',
});
```

`src/main.tsx` — initialize once at startup:

```ts
import './analytics';
```

Wire events at your **state choke point** (e.g. a Zustand store) so every mutation is one call:

```ts
import { trackEvent, trackChangeDebounced } from '@webmaxru/cookieless-insights';

const useStore = create((set) => ({
  addItem: (item) => { trackEvent('Item Added'); set(/* … */); },
  setVolume: (v) => { trackChangeDebounced('Input Changed', 'volume'); set({ volume: v }); },
}));
```

Outbound links:

```tsx
<a href="https://example.com" onClick={() => trackEvent('Outbound Click', { href: 'example.com' })}>…</a>
```

TypeScript: if `import.meta.env` isn't typed, add `src/vite-env.d.ts`:

```ts
/// <reference types="vite/client" />
interface ImportMetaEnv { readonly VITE_APPINSIGHTS_CONNECTION_STRING?: string }
interface ImportMeta { readonly env: ImportMetaEnv }
```

GitHub Pages build step:

```yaml
- run: npm run build
  env:
    VITE_APPINSIGHTS_CONNECTION_STRING: ${{ vars.VITE_APPINSIGHTS_CONNECTION_STRING }}
```
