import fs from 'node:fs'
import path from 'node:path'
import { spawn } from 'node:child_process'

// `next build` with `output: 'standalone'` (next.config.ts) produces a
// self-contained server at .next/standalone/server.js, but it does NOT
// bundle `public/` or `.next/static/` — those have to be copied alongside
// it manually (same as Dockerfile:36-38 does for the production image).
// `next start` doesn't work at all against a standalone build (it warns
// and serves a broken app), which is why local `pnpm test:e2e` needed a
// manual `pnpm build` + workaround before this script existed.
const root = process.cwd()
const standaloneDir = path.join(root, '.next/standalone')

fs.cpSync(path.join(root, 'public'), path.join(standaloneDir, 'public'), { recursive: true })
fs.cpSync(path.join(root, '.next/static'), path.join(standaloneDir, '.next/static'), { recursive: true })

const server = spawn('node', ['server.js'], {
  cwd: standaloneDir,
  stdio: 'inherit',
  env: process.env,
})

server.on('exit', (code) => process.exit(code ?? 0))
