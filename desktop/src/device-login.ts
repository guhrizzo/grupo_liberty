import * as http from 'node:http'
import { randomBytes } from 'node:crypto'
import { shell, net, session, BrowserWindow } from 'electron'
import { APP_ORIGIN, APP_URL } from './config'

// Login com Google (e qualquer provedor) no app: delega pro navegador do
// sistema. O app sobe um servidor loopback, abre /entrar-dispositivo no
// navegador, e recebe de volta um `code` de uso único que troca por um cookie
// de sessão em /api/desktop/exchange.

const TIMEOUT_MS = 3 * 60 * 1000
let emAndamento: http.Server | null = null

const PAGINA_OK = `<!doctype html><meta charset="utf-8">
<title>Liberty Car</title>
<body style="font-family:system-ui;background:#0b0d14;color:#e7e9ee;display:grid;place-items:center;height:100vh;margin:0">
<div style="text-align:center">
<h1 style="font-size:20px">Login concluído</h1>
<p style="color:#9aa0ad">Pode fechar esta aba e voltar para o app Liberty Car.</p>
</div>`

const PAGINA_ERRO = `<!doctype html><meta charset="utf-8">
<title>Liberty Car</title>
<body style="font-family:system-ui;background:#0b0d14;color:#e7e9ee;display:grid;place-items:center;height:100vh;margin:0">
<p style="color:#9aa0ad">Requisição inválida. Volte ao app e tente de novo.</p>`

function encerra(server: http.Server, timer: NodeJS.Timeout) {
  clearTimeout(timer)
  server.close()
  if (emAndamento === server) emAndamento = null
}

/** Grava o cookie `session` (valor vindo no corpo do /exchange) na sessão do app. */
async function gravaCookie(valor: string, maxAgeSec: number) {
  const https = APP_ORIGIN.startsWith('https')
  // domínio-base (sem `www.`) → cobre apex e www, seja qual for o host final.
  const dominio = https ? new URL(APP_ORIGIN).hostname.replace(/^www\./, '') : undefined
  await session.defaultSession.cookies.set({
    url: APP_ORIGIN,
    name: 'session',
    value: valor,
    domain: dominio,
    path: '/',
    httpOnly: true,
    secure: https,
    sameSite: 'lax',
    expirationDate: Math.floor(Date.now() / 1000) + (maxAgeSec || 5 * 24 * 3600),
  })
}

export function loginWithBrowser(getWindow: () => BrowserWindow | null): Promise<void> {
  return new Promise((resolve, reject) => {
    emAndamento?.close()

    const state = randomBytes(16).toString('hex')
    const server = http.createServer((req, res) => {
      void handle(req, res)
    })
    emAndamento = server

    const timer = setTimeout(() => {
      encerra(server, timer)
      reject(new Error('timeout'))
    }, TIMEOUT_MS)

    async function handle(req: http.IncomingMessage, res: http.ServerResponse) {
      let url: URL
      try {
        url = new URL(req.url ?? '', 'http://127.0.0.1')
      } catch {
        res.writeHead(400).end()
        return
      }
      if (req.method !== 'GET' || url.pathname !== '/callback') {
        res.writeHead(404).end()
        return
      }

      const code = url.searchParams.get('code') ?? ''
      if (url.searchParams.get('state') !== state || !code) {
        res.writeHead(400, { 'content-type': 'text/html; charset=utf-8' }).end(PAGINA_ERRO)
        return // não resolve/rejeita — pode ser ruído; deixa o timeout agir
      }

      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(PAGINA_OK)
      encerra(server, timer)

      try {
        const r = await net.fetch(`${APP_ORIGIN}/api/desktop/exchange`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const j = (await r.json().catch(() => ({}))) as {
          ok?: boolean
          session?: string
          maxAge?: number
          error?: string
        }
        if (!r.ok || !j.session) {
          throw new Error(j.error ?? `exchange ${r.status}`)
        }
        await gravaCookie(j.session, j.maxAge ?? 0)
        getWindow()?.loadURL(APP_URL)
        resolve()
      } catch (err) {
        reject(err instanceof Error ? err : new Error(String(err)))
      }
    }

    server.listen(0, '127.0.0.1', () => {
      const addr = server.address()
      const porta = typeof addr === 'object' && addr ? addr.port : 0
      if (!porta) {
        encerra(server, timer)
        reject(new Error('sem porta'))
        return
      }
      shell.openExternal(`${APP_ORIGIN}/entrar-dispositivo?porta=${porta}&state=${state}`)
    })
  })
}
