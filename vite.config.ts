import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { resolve } from 'path'

// Get version and git info
const pkg = JSON.parse(readFileSync(resolve(__dirname, 'package.json'), 'utf-8'))
const gitHash = (() => {
  try { return execSync('git rev-parse --short HEAD').toString().trim() }
  catch { return 'dev' }
})()
const appVersion = `v${pkg.version}+${gitHash}`

// Auto-start Oracle backend when dev server starts
function oracleAutoStart() {
  return {
    name: 'oracle-auto-start',
    configureServer() {
      try {
        execSync('bun run server:ensure', {
          cwd: resolve(__dirname, '../oracle-v2'),
          timeout: 15000,
          stdio: 'pipe',
        })
        console.log('🔮 Oracle backend ready')
      } catch {
        console.warn('⚠️  Could not auto-start Oracle backend')
      }
    },
  }
}

export default defineConfig({
  plugins: [tailwindcss(), react(), oracleAutoStart()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion)
  },
  server: {
    port: 3000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.ORACLE_API_URL || 'http://localhost:47778'
      }
    }
  }
})
