/**
 * Migra o ponto que está no Firestore (coleções ponto_registros e ponto_config)
 * para a folha única, no liberty-sistema (Supabase).
 *
 * Casa os funcionários pelo E-MAIL (os uids dos dois sistemas são diferentes).
 * Nunca sobrescreve: um dia que já existe na folha única é mantido e contado
 * como conflito. Nada é apagado do Firestore.
 *
 * Variáveis (.env.local): credenciais do Firebase Admin, PONTO_API_URL e
 * PONTO_API_SECRET (iguais às do site; o liberty-sistema precisa estar no ar
 * com a mesma PONTO_API_SECRET).
 *
 * Uso (raiz do projeto):
 *   npm run ponto:migrar            -> simulação: só conta o que seria feito
 *   npm run ponto:migrar -- --apply -> grava de verdade
 */

import { config } from 'dotenv'

config({ path: '.env.local' })

const APPLY = process.argv.slice(2).includes('--apply')
const LOTE = 200

interface Resposta {
  ok: boolean
  erro?: string
  simulacao?: boolean
  resumo?: Record<string, number>
  detalhes?: string[]
}

async function enviar(corpo: Record<string, unknown>): Promise<Resposta> {
  const url = process.env.PONTO_API_URL
  const segredo = process.env.PONTO_API_SECRET
  if (!url || !segredo) throw new Error('Defina PONTO_API_URL e PONTO_API_SECRET no .env.local')
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${segredo}` },
    body: JSON.stringify({ acao: 'importar', simular: !APPLY, ...corpo }),
  })
  const json = (await resp.json().catch(() => null)) as Resposta | null
  if (!resp.ok || !json?.ok) throw new Error(`API respondeu ${resp.status}: ${json?.erro ?? 'sem detalhes'}`)
  return json
}

async function main() {
  const { adminAuth, adminDb } = await import('./firebase-admin')

  const [snap, cfgSnap] = await Promise.all([
    adminDb.collection('ponto_registros').get(),
    adminDb.collection('ponto_config').get(),
  ])
  console.log(`Firestore: ${snap.size} registros de dia, ${cfgSnap.size} jornadas.`)
  console.log(APPLY ? 'MODO: GRAVANDO na folha única.' : 'MODO: simulação (nada será gravado). Use --apply para gravar.')

  const registros = snap.docs.map((d) => {
    const x = d.data()
    return {
      email: x.email,
      nome: x.nome,
      data: x.data,
      batidas: x.batidas ?? {},
      origens: x.origens ?? {},
      distancias: x.distancias ?? {},
      jornadaMin: x.jornadaMin,
      edicoes: x.edicoes ?? [],
    }
  })

  const configs: { email: string; jornadaMin: number }[] = []
  for (const d of cfgSnap.docs) {
    const min = d.data().jornadaMin
    if (typeof min !== 'number') continue
    try {
      const u = await adminAuth.getUser(d.id)
      if (u.email) configs.push({ email: u.email, jornadaMin: min })
    } catch {
      console.warn(`Jornada de ${d.id} ignorada: usuário não encontrado no Firebase Auth.`)
    }
  }

  const total: Record<string, number> = {}
  const detalhes: string[] = []
  const somar = (r: Resposta) => {
    for (const [k, v] of Object.entries(r.resumo ?? {})) total[k] = (total[k] ?? 0) + v
    detalhes.push(...(r.detalhes ?? []))
  }

  for (let i = 0; i < registros.length; i += LOTE) {
    somar(await enviar({ registros: registros.slice(i, i + LOTE) }))
  }
  if (configs.length) somar(await enviar({ configs }))

  console.log('\nResumo:', total)
  if (detalhes.length) console.log('\nObservações:\n - ' + detalhes.join('\n - '))
  if (!APPLY) console.log('\nSimulação concluída. Confira o resumo e rode com --apply.')
}

main().catch((err) => {
  console.error('Falha na migração:', err instanceof Error ? err.message : err)
  process.exit(1)
})
