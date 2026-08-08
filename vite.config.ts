import { defineConfig } from 'vite';
import yaml from '@rollup/plugin-yaml';

export default defineConfig({
  // Relative asset URLs, so a build can be served from any subpath. This is
  // what lets the same bundle work locally and under the project path on
  // GitHub Pages (/galactic-gourmet/) with no base rewriting.
  base: './',
  build: { target: 'es2022' },
  plugins: [
    // The menu is data, not code — see src/food.yaml. Parsed at build time, so
    // there is no loader and no parser in the bundle.
    yaml(),
    {
      // GitHub Pages runs Jekyll over the published branch unless told not to,
      // which would silently drop any path beginning with an underscore.
      name: 'emit-nojekyll',
      apply: 'build',
      generateBundle() {
        this.emitFile({ type: 'asset', fileName: '.nojekyll', source: '' });
      },
    },
  ],
});
