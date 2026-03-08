import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import mkcert from 'vite-plugin-mkcert'

const useMkcert = process.env.BLOCDUEL_DISABLE_MKCERT !== '1'

export default defineConfig({
  plugins: [react(), tailwindcss(), wasm(), topLevelAwait(), useMkcert ? mkcert() : null].filter(Boolean),
  envPrefix: ['VITE_', 'PUBLIC_'],
})
