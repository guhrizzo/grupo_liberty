// Sobe os artefatos do electron-builder (latest.yml + instalador + blockmap) pro
// bucket público do Supabase Storage, que serve de feed pro electron-updater.
// Roda depois de `npm run build`. Lê credenciais de `desktop/.env` (não commitado).

import { createClient } from '@supabase/supabase-js'
import { readFile, readdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dir = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(dir, '..')
const buildDir = path.join(root, 'build')

// carregador de .env sem dependência
try {
  const raw = await readFile(path.join(root, '.env'), 'utf8')
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/)
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = (m[2] ?? '').replace(/^["']|["']$/g, '').trim()
    }
  }
} catch {
  /* sem .env: assume env do processo */
}

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY
const BUCKET = process.env.RELEASE_BUCKET || 'desktop-releases'

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    'Faltando SUPABASE_URL / SUPABASE_SERVICE_KEY. Crie desktop/.env a partir de desktop/.env.example.',
  )
  process.exit(1)
}

const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
})

// garante o bucket público
const { data: buckets, error: listErr } = await supa.storage.listBuckets()
if (listErr) {
  console.error('Erro ao listar buckets:', listErr.message)
  process.exit(1)
}
if (!buckets.some((b) => b.name === BUCKET)) {
  const { error } = await supa.storage.createBucket(BUCKET, { public: true })
  if (error) {
    console.error('Erro ao criar bucket:', error.message)
    process.exit(1)
  }
  console.log('bucket criado:', BUCKET)
}

const all = await readdir(buildDir).catch(() => {
  console.error('build/ não existe — rode `npm run build` antes.')
  process.exit(1)
})

const targets = all.filter(
  (f) => f === 'latest.yml' || f.endsWith('.exe') || f.endsWith('.exe.blockmap'),
)

if (targets.length === 0) {
  console.error('Nada pra publicar em build/.')
  process.exit(1)
}

function contentType(file) {
  if (file.endsWith('.yml')) return 'text/yaml'
  if (file.endsWith('.exe')) return 'application/vnd.microsoft.portable-executable'
  return 'application/octet-stream'
}

for (const file of targets) {
  const body = await readFile(path.join(buildDir, file))
  const { error } = await supa.storage
    .from(BUCKET)
    .upload(file, body, { upsert: true, contentType: contentType(file) })
  if (error) {
    console.error('falha no upload de', file, '—', error.message)
    process.exit(1)
  }
  console.log(
    'enviado:',
    `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${encodeURIComponent(file)}`,
  )
}

console.log('\npublish concluído.')
