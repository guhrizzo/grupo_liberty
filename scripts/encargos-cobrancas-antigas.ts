/**
 * Liga multa e juros nas cobranças criadas antes da regra de encargos, valendo
 * só para as parcelas que vencem a partir de uma data de corte.
 *
 * Grava, em cada cobrança SEM `multaPct`: `multaPct` e `jurosMensalPct` padrão
 * (constants/encargos.ts) + `encargosDesde` (data de corte). Parcelas que
 * venceram antes do corte continuam sem encargos (utils/cobrancas/encargos.ts).
 *
 * Uso (raiz do projeto, .env.local preenchido):
 *   npm run encargos:antigas                          -> simulação: só lista
 *   npm run encargos:antigas -- --apply               -> grava, corte = hoje (SP)
 *   npm run encargos:antigas -- --apply --desde=2026-10-03
 *
 * IMPORTANTE: só rodar com --apply DEPOIS que o código que entende
 * `encargosDesde` estiver em produção — senão o site antigo cobraria encargos
 * de todas as parcelas dessas cobranças.
 */

import { config } from 'dotenv'
import { ENCARGOS_PADRAO } from '../constants/encargos'
import { hojeSaoPaulo } from '../utils/cobrancas/encargos'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const desde = args.find((a) => a.startsWith('--desde='))?.split('=')[1] ?? hojeSaoPaulo()

if (!/^\d{4}-\d{2}-\d{2}$/.test(desde)) {
  console.error(`--desde inválido: ${desde} (use AAAA-MM-DD)`)
  process.exit(1)
}

async function main() {
  // Depois do dotenv: o módulo lê as credenciais ao ser importado.
  const { adminDb } = await import('./firebase-admin')
  const snap = await adminDb.collection('cobrancas').get()
  const alvo = snap.docs.filter((d) => typeof d.data().multaPct !== 'number')

  console.log(`${snap.size} cobranças · ${alvo.length} sem taxa de encargos · corte: ${desde}`)
  for (const d of alvo) {
    const c = d.data()
    console.log(`  - ${d.id}  ${c.clienteNome ?? '(sem nome)'}  criada em ${String(c.criadoEm ?? '').slice(0, 10)}`)
  }

  if (!APPLY) {
    console.log('\nSimulação — nada foi gravado. Rode com --apply para gravar.')
    return
  }

  const agora = new Date().toISOString()
  for (let i = 0; i < alvo.length; i += 400) {
    const lote = adminDb.batch()
    for (const d of alvo.slice(i, i + 400)) {
      lote.update(d.ref, {
        multaPct: ENCARGOS_PADRAO.multaPct,
        jurosMensalPct: ENCARGOS_PADRAO.jurosMensalPct,
        encargosDesde: desde,
        encargosLigadosEm: agora,
      })
    }
    await lote.commit()
  }
  console.log(`\nGravado em ${alvo.length} cobranças.`)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
