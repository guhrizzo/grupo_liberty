import 'server-only'
import { createHash } from 'node:crypto'
import { adminDb } from '@/utils/firebase/admin'
import { posicaoDoVeiculo } from '@/utils/autocarsat/client'
import { documentoQuitacao } from '@/utils/quitacoes/vinculo'
import { servicosInclusos, type ContratoPosVenda } from './modelo'
import { contratosPosVenda, veiculosPosVenda } from './repositorio'
import { vendaPosVenda } from './vinculo'

export async function acompanharServicosAtivos(documento: string, veiculoId: string, vinculo: string, ids: { id: string; servico: ContratoPosVenda['servico'] }[]) {
  const servicos = new Set(ids.flatMap(({ servico }) => [...servicosInclusos(servico)]))
  const processos = servicos.has('juridico')
    ? await adminDb.collection('processos').where('veiculoId', '==', veiculoId).get()
    : null
  const eventos = await Promise.all(ids.map(async ({ id }) => {
    const snap = await contratosPosVenda().doc(id).collection('andamentos').orderBy('em', 'desc').limit(30).get()
    return snap.docs.map((doc) => ({
      id: doc.id, tipo: String(doc.get('tipo')), texto: String(doc.get('texto')),
      em: String(doc.get('em')), responsavel: String(doc.get('responsavel') || ''),
    }))
  }))
  const atual = vendaPosVenda((await veiculosPosVenda().doc(veiculoId).get()).data())
  if (atual?.documento !== documento || atual.vinculo !== vinculo) return { processos: [], andamentos: [] }
  return {
    processos: processos?.docs.filter((doc) => documentoQuitacao(doc.get('clienteCpf')) === documento).map((doc) => ({
      id: doc.id, numero: String(doc.get('numero') || ''), status: String(doc.get('status') || ''),
      responsavel: String(doc.get('responsavel') || ''), atualizadoEm: String(doc.get('updated_at') || ''),
    })) ?? [],
    andamentos: eventos.flat().sort((a, b) => b.em.localeCompare(a.em)),
  }
}

function placaNormalizada(placa: string) {
  return placa.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

export async function rastreamentoPosVenda(id: string, documento: string) {
  const ref = contratosPosVenda().doc(id)
  const contrato = (await ref.get()).data() as ContratoPosVenda | undefined
  if (contrato?.situacao !== 'ativo' || contrato.documento !== documento ||
    !servicosInclusos(contrato.servico).includes('rastreamento') ||
    !contrato.aceite?.rastreamento || contrato.aceite.propostaId !== contrato.proposta?.id) return null
  const rastreador = contrato.proposta?.rastreador
  if (!rastreador) return null

  const venda = vendaPosVenda((await veiculosPosVenda().doc(contrato.veiculoId).get()).data())
  if (venda?.vinculo !== contrato.vinculo || !venda.placa) return null

  const retorno = await posicaoDoVeiculo(rastreador)
  const pos = retorno.ok ? retorno.data : null
  const historico = ref.collection('posicoes')
  if (pos?.uuid === rastreador && placaNormalizada(pos.placa || '') === placaNormalizada(venda.placa) &&
    Number.isFinite(pos.latitude) && Math.abs(pos.latitude) <= 90 &&
    Number.isFinite(pos.longitude) && Math.abs(pos.longitude) <= 180 &&
    pos.gps_valido === true && typeof pos.date_time_event === 'string' && pos.date_time_event) {
    const chave = createHash('sha256').update(`${rastreador}:${pos.date_time_event}`).digest('hex')
    await historico.doc(chave).set({
      data: pos.date_time_event, latitude: pos.latitude, longitude: pos.longitude,
      local: String(pos.localization || '').slice(0, 400),
    })
  }
  const [dados, atual, veiculo] = await Promise.all([
    historico.orderBy('data', 'desc').limit(30).get(),
    ref.get(),
    veiculosPosVenda().doc(contrato.veiculoId).get(),
  ])
  if (atual.get('situacao') !== 'ativo' || vendaPosVenda(veiculo.data())?.vinculo !== contrato.vinculo) return null
  return {
    veiculo: venda.nome,
    posicoes: dados.docs.map((doc) => ({
      id: doc.id, data: String(doc.get('data')), local: String(doc.get('local')),
      latitude: Number(doc.get('latitude')), longitude: Number(doc.get('longitude')),
    })),
  }
}
