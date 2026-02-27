import { defineConfig } from 'astro/config'
import preact from '@astrojs/preact'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  integrations: [preact()],
  publicDir: './static',
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        // Allow serving files from the repo root so the worker can reach
        // crates/image-converter/pkg/ which sits outside the web/ project root.
        allow: ['..'],
      },
    },
  },
})
