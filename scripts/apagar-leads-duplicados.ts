/**
 * Apaga leads duplicados (coleção juridico_prospeccao, aba Leads/Prospecção).
 *
 * Usa a mesma regra da importação de planilha (chavesDuplicidade): dois leads
 * são o mesmo se compartilham CPF/CNPJ, placa, processo + nome (ou, sem nenhum
 * desses, nome + telefone). Em cada grupo fica 1 lead — o que tem mais visitas
 * registradas e, no empate, o mais antigo. As visitas dos apagados são
 * somadas ao que ficou. Antes de apagar, grava um backup JSON dos removidos.
 *
 * Leads ligados (campo `vinculados`: divergentes confirmados na importação —
 * mesmo cliente com outro veículo etc.) nunca são apagados: compartilham
 * chave de propósito.
 *
 * Uso (raiz do projeto, .env.local preenchido):
 *   npm run leads:duplicados             -> simulação: só lista
 *   npm run leads:duplicados -- --apply  -> apaga de verdade
 */

import { config } from 'dotenv'
import { writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { chavesDuplicidade } from '../app/dashboard/juridico/prospeccao-parse'
import { normalizarProspeccao } from '../app/dashboard/juridico/prospeccao-parse'
import { grupoVinculado } from '../app/dashboard/juridico/prospeccao-importacao'
import { decrypt } from '../utils/crypto'

config({ path: '.env.local' })

const COLLECTION = 'juridico_prospeccao'
const APPLY = process.argv.slice(2).includes('--apply')

function decryptOrRaw(value: string | null | undefined): string {
  if (!value) return ''
  if (!value.includes(':')) return value
  return decrypt(value) || value
}

async function main() {
  const { adminDb } = await import('./firebase-admin')
  const snap = await adminDb.collection(COLLECTION).get()
  const docs = snap.docs

  // Union-find: leads que compartilham qualquer chave caem no mesmo grupo.
  const pai = docs.map((_, i) => i)
  const raiz = (i: number): number => (pai[i] === i ? i : (pai[i] = raiz(pai[i])))
  const dono = new Map<string, number>()
  docs.forEach((d, i) => {
    const reg = normalizarProspeccao({ ...d.data(), cpfCnpj: decryptOrRaw(d.data().cpfCnpj) })
    for (const k of chavesDuplicidade(reg)) {
      const j = dono.get(k)
      if (j === undefined) dono.set(k, i)
      else pai[raiz(i)] = raiz(j)
    }
  })

  const grupos = new Map<number, number[]>()
  docs.forEach((_, i) => {
    const r = raiz(i)
    grupos.set(r, [...(grupos.get(r) ?? []), i])
  })
  const duplicados = [...grupos.values()].filter((g) => g.length > 1)

  // Leads com ligação (em qualquer sentido) ficam sempre.
  const itensVinc = docs.map((d) => ({
    id: d.id,
    vinculados: Array.isArray(d.data().vinculados)
      ? d.data().vinculados.filter((v: unknown): v is string => typeof v === 'string')
      : [],
  }))
  const comLigacao = new Set<number>()
  const idx = new Map(docs.map((d, i) => [d.id, i]))
  itensVinc.forEach((x, i) => {
    if (comLigacao.has(i)) return
    const grupo = grupoVinculado(x.id, itensVinc)
    if (grupo.size > 1) for (const id of grupo) comLigacao.add(idx.get(id)!)
  })

  const nVisitas = (i: number) => (Array.isArray(docs[i].data().visitas) ? docs[i].data().visitas.length : 0)
  const criado = (i: number) => String(docs[i].data().created_at ?? '')

  const apagar: number[] = []
  let gruposComApagados = 0
  const merges: { ref: FirebaseFirestore.DocumentReference; visitas: unknown[] }[] = []

  for (const g of duplicados) {
    const ordenado = [...g].sort((a, b) => nVisitas(b) - nVisitas(a) || criado(a).localeCompare(criado(b)))
    const [fica, ...candidatos] = ordenado
    const resto = candidatos.filter((r) => !comLigacao.has(r))
    if (resto.length === 0) continue
    gruposComApagados++
    apagar.push(...resto)
    const d = docs[fica].data()
    console.log(`\n${d.nomeExecutado ?? '(sem nome)'}  — fica ${fica} (${docs[fica].id}), apaga ${resto.length}`)
    for (const r of resto) console.log(`   x ${docs[r].id}  criado ${criado(r).slice(0, 10)}  visitas ${nVisitas(r)}`)

    const existentes = Array.isArray(d.visitas) ? d.visitas : []
    const ids = new Set(existentes.map((v: { id?: string }) => v.id))
    const extras = resto
      .flatMap((r) => (Array.isArray(docs[r].data().visitas) ? docs[r].data().visitas : []))
      .filter((v: { id?: string }) => !ids.has(v.id))
    if (extras.length) merges.push({ ref: docs[fica].ref, visitas: [...existentes, ...extras] })
  }

  console.log(
    `\n${docs.length} leads · ${gruposComApagados} grupo(s) com duplicidade (${comLigacao.size} lead(s) ligado(s) preservado(s)) · ${apagar.length} a apagar`,
  )
  if (!APPLY) {
    console.log('Simulação — nada foi apagado. Rode com --apply para apagar.')
    return
  }
  if (apagar.length === 0) return

  const arquivo = join(tmpdir(), `backup-leads-duplicados-${Date.now()}.json`)
  writeFileSync(arquivo, JSON.stringify(apagar.map((i) => ({ id: docs[i].id, ...docs[i].data() })), null, 2))
  console.log(`Backup dos apagados: ${arquivo}`)

  for (const m of merges) await m.ref.update({ visitas: m.visitas })
  for (let i = 0; i < apagar.length; i += 400) {
    const lote = adminDb.batch()
    for (const idx of apagar.slice(i, i + 400)) lote.delete(docs[idx].ref)
    await lote.commit()
  }
  console.log(`${apagar.length} lead(s) duplicado(s) apagado(s).`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
