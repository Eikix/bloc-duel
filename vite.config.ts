import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import mkcert from 'vite-plugin-mkcert'

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait(), mkcert()],
  envPrefix: ['VITE_', 'PUBLIC_'],
})
