import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'
import tailwindcss from '@tailwindcss/vite'

import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://imagetoolz.app',
  integrations: [preact(), sitemap()],
  publicDir: './static',
  vite: {
    plugins: [tailwindcss()],
    optimizeDeps: {
      exclude: ['heic-to'],
    },
    server: {
      fs: {
        // Allow serving files from the repo root so the worker can reach
        // crates/image-converter/pkg/ which sits outside the web/ project root.
        allow: ['..'],
      },
    },
  },
})