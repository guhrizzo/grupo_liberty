/**
 * Converte as fotos já existentes dos veículos (coleção `veiculos`) para WebP.
 *
 * Uso (a partir da raiz do projeto, com .env.local preenchido):
 *   npm run fotos:webp                      -> simulação: converte em memória e mostra a economia
 *   npm run fotos:webp -- --apply           -> sobe os .webp e atualiza `fotos` em cada veículo
 *   npm run fotos:webp -- --apply --delete-old
 *                                           -> além disso, apaga os arquivos originais do Storage
 *   Opções: --limit=N (processa só N veículos)
 *
 * Seguro por padrão:
 *  - sem --apply nada é gravado;
 *  - os originais NÃO são apagados sem --delete-old (outros sistemas, como o de
 *    locação, podem ter copiado as URLs antigas — rode --delete-old só depois
 *    de confirmar que ninguém mais usa);
 *  - é idempotente: fotos que já são .webp são ignoradas, então pode rodar de novo.
 */
import { config } from 'dotenv'
import { getApps } from 'firebase-admin/app'
import { getStorage } from 'firebase-admin/storage'
import { converterFotoParaWebp, FOTO_CACHE_CONTROL } from '../utils/veiculos/foto-webp'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const DELETE_OLD = args.includes('--delete-old')
const LIMIT = Number(args.find((a) => a.startsWith('--limit='))?.split('=')[1]) || Infinity

if (DELETE_OLD && !APPLY) {
  console.error('--delete-old só funciona junto com --apply.')
  process.exit(1)
}

/** Caminho do objeto no bucket a partir da URL pública (decodifica o %2F). */
function caminhoNoBucket(url: string, bucketName: string): string | null {
  try {
    const u = new URL(url)
    let path: string
    if (u.hostname === 'storage.googleapis.com') {
      const [bucket, ...resto] = u.pathname.replace(/^\//, '').split('/')
      if (bucket !== bucketName) return null
      path = resto.join('/')
    } else if (u.hostname === bucketName) {
      path = u.pathname.replace(/^\//, '')
    } else {
      return null
    }
    return decodeURIComponent(path) || null
  } catch {
    return null
  }
}

const kb = (n: number) => `${(n / 1024).toFixed(0)} KB`

async function main() {
  const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
  if (!bucketName) throw new Error('NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ausente no .env.local')

  // Import dinâmico: o firebase-admin lê o .env.local no momento em que carrega.
  const { adminDb } = await import('./firebase-admin')
  const bucket = getStorage(getApps()[0]).bucket(bucketName)

  console.log(APPLY ? `MODO APLICAR${DELETE_OLD ? ' + APAGAR ORIGINAIS' : ''}` : 'SIMULAÇÃO (nada será gravado)')

  const snap = await adminDb.collection('veiculos').get()
  let veiculos = 0
  let convertidas = 0
  let ignoradas = 0
  let falhas = 0
  let bytesAntes = 0
  let bytesDepois = 0

  for (const doc of snap.docs) {
    if (veiculos >= LIMIT) break
    const fotos: string[] = Array.isArray(doc.data().fotos) ? doc.data().fotos : []
    const mapa = new Map<string, string>() // url antiga -> url nova
    const originaisParaApagar: string[] = []

    for (const url of fotos) {
      const path = caminhoNoBucket(url, bucketName)
      if (!path || /\.webp$/i.test(path)) {
        ignoradas++
        continue
      }
      try {
        const [original] = await bucket.file(path).download()
        const webp = await converterFotoParaWebp(original)
        if (webp.length >= original.length) {
          console.log(`  = ${path}: webp não ficou menor (${kb(original.length)} -> ${kb(webp.length)}), mantida`)
          ignoradas++
          continue
        }
        bytesAntes += original.length
        bytesDepois += webp.length

        const destino = path.replace(/\.[^./]+$/, '') + '.webp'
        if (APPLY) {
          const ref = bucket.file(destino)
          await ref.save(webp, { metadata: { contentType: 'image/webp', cacheControl: FOTO_CACHE_CONTROL } })
          await ref.makePublic()
          mapa.set(url, ref.publicUrl())
          originaisParaApagar.push(path)
        }
        convertidas++
        console.log(`  + ${path}: ${kb(original.length)} -> ${kb(webp.length)}`)
      } catch (err) {
        falhas++
        console.error(`  ! ${path}: falhou (${(err as Error).message}), mantida a original`)
      }
    }

    if (APPLY && mapa.size) {
      // Relê o doc pra não sobrescrever mudanças feitas enquanto convertíamos.
      const atual: string[] = (await doc.ref.get()).data()?.fotos ?? []
      await doc.ref.update({ fotos: atual.map((u) => mapa.get(u) ?? u) })
      if (DELETE_OLD) {
        for (const p of originaisParaApagar) {
          await bucket.file(p).delete().catch((e) => console.error(`  ! não apagou ${p}: ${e.message}`))
        }
      }
    }
    veiculos++
    console.log(`veículo ${doc.id}: ${mapa.size || (APPLY ? 0 : '—')} atualizada(s)`)
  }

  const pct = bytesAntes ? Math.round((1 - bytesDepois / bytesAntes) * 100) : 0
  console.log('\n=== Resumo ===')
  console.log(`veículos: ${veiculos} | convertidas: ${convertidas} | ignoradas: ${ignoradas} | falhas: ${falhas}`)
  console.log(`tamanho: ${(bytesAntes / 1048576).toFixed(1)} MB -> ${(bytesDepois / 1048576).toFixed(1)} MB (-${pct}%)`)
  if (!APPLY) console.log('Nada foi gravado. Rode com --apply para aplicar.')
}

main().catch((err) => {
  console.error('Erro:', err)
  process.exit(1)
})
