/**
 * Recalcula proposta prévia e comissão das propostas registradas com a regra
 * atual: prévia = 1/2 FIPE − quitação estimada − IPVA/licenciamento/multas −
 * peças de reparo (mínimo 0); comissão = 300 + 6% × (prévia − valor), 0..1.200.
 * Só mexe em `proposta_previa` e `comissao_vendedor`.
 *
 * Uso (raiz do projeto, .env.local preenchido):
 *   npm run propostas:recalcular                      -> simulação: lista antes/depois
 *   npm run propostas:recalcular -- --status=pendente -> filtra por status (pendente|aceito|recusado)
 *   npm run propostas:recalcular -- --apply           -> grava
 */

import { config } from 'dotenv'
import { getBancoByNome } from '../constants/bancos'
import { calcularComissaoVendedor } from '../utils/propostas/comissao'

config({ path: '.env.local' })

const args = process.argv.slice(2)
const APPLY = args.includes('--apply')
const status = args.find((a) => a.startsWith('--status='))?.split('=')[1]

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const brl = (v: number | null) =>
  v == null ? '—' : v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function previa(p: Record<string, unknown>): number | null {
  const banco = getBancoByNome(p.banco as string | null)
  if (!banco || banco.descontoPercent == null) return null
  const emAberto = Math.max(0, num(p.parcelas_totais) - num(p.parcelas_pagas))
  const quitacao = emAberto * num(p.valor_parcela) * (1 - banco.descontoPercent / 100)
  const debitos = num(p.valor_ipva) + num(p.valor_licenciamento) + num(p.valor_multas)
  const pecas = Array.isArray(p.pecas_conserto)
    ? p.pecas_conserto.reduce((acc: number, x: { valor?: unknown }) => acc + num(x?.valor), 0)
    : 0
  return Math.max(0, num(p.veiculo_valor_fipe) / 2 - quitacao - debitos - pecas)
}

async function main() {
  const { adminDb } = await import('./firebase-admin')
  const snap = await adminDb.collection('propostas_registradas').get()
  const docs = snap.docs.filter((d) => !status || d.data().status === status)

  const mudancas: { ref: FirebaseFirestore.DocumentReference; prev: number; com: number }[] = []
  let semBanco = 0
  let semValor = 0
  console.log(`${snap.size} propostas · ${docs.length} no filtro${status ? ` (status=${status})` : ''}\n`)

  for (const d of docs) {
    const p = d.data()
    const valor = typeof p.valor === 'number' ? p.valor : null
    if (valor == null) { semValor++; continue }
    const nova = previa(p)
    if (nova == null) { semBanco++; continue }
    const comNova = calcularComissaoVendedor(nova, valor)
    const prevAtual = typeof p.proposta_previa === 'number' ? p.proposta_previa : null
    const comAtual = typeof p.comissao_vendedor === 'number' ? p.comissao_vendedor : null
    if (prevAtual != null && comAtual != null && Math.abs(prevAtual - nova) < 0.01 && Math.abs(comAtual - comNova) < 0.01) continue
    mudancas.push({ ref: d.ref, prev: nova, com: comNova })
    console.log(
      `${String(p.status).padEnd(9)} ${String(p.nome ?? '').slice(0, 28).padEnd(28)} prévia ${brl(prevAtual)} -> ${brl(nova)} | comissão ${brl(comAtual)} -> ${brl(comNova)}`,
    )
  }

  console.log(`\n${mudancas.length} mudariam · ${semBanco} puladas (banco fora da lista) · ${semValor} puladas (sem valor da proposta)`)
  if (!APPLY) {
    console.log('Simulação — nada foi gravado. Rode com --apply para gravar.')
    return
  }
  const agora = new Date().toISOString()
  for (let i = 0; i < mudancas.length; i += 400) {
    const lote = adminDb.batch()
    for (const m of mudancas.slice(i, i + 400)) {
      lote.update(m.ref, { proposta_previa: m.prev, comissao_vendedor: m.com, updated_at: agora })
    }
    await lote.commit()
  }
  console.log(`${mudancas.length} propostas atualizadas.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
