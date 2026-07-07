import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    appinsights: 'src/appinsights.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  treeshake: true,
  sourcemap: true,
  target: 'es2020',
  // The App Insights SDK is an optional peer dependency — never bundle it.
  external: ['@microsoft/applicationinsights-web'],
});
