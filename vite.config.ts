import { defineConfig } from 'vite';

export default defineConfig({
  // Relative asset URLs, so a build can be served from any subpath.
  base: './',
  build: { target: 'es2022' },
});
