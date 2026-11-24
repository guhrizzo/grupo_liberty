import 'server-only'
import { createHash, randomUUID } from 'node:crypto'
import { adminDb } from '@/utils/firebase/admin'
import { TIPOS_ANEXO, type TipoAnexo } from '@/app/dashboard/quitacoes/types'
import { etapaNotificavel, etapaTemQuitacao, type EtapaQuitacao, type EventoQuitacao } from './etapas'
import { compraQuitacao, documentoQuitacao } from './vinculo'

export const FILA_QUITACAO = 'quitacao_notificacoes'
const dataSaoPaulo = new Intl.DateTimeFormat('sv-SE', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
})
export type Acompanhamento = {
  vinculo: string
  etapa: EtapaQuitacao
  atualizadoEm: string
  historico: EventoQuitacao[]
  publicados: Partial<Record<TipoAnexo, string>>
  avisoId?: string | null
  /** Estimativa de conclusão (AAAA-MM-DD), só quando a equipe cadastra. */
  previsao?: string | null
}
export type PublicacaoQuitacao = { tipo: TipoAnexo; versao: string }
export const versaoAnexoQuitacao = (path: string) => createHash('sha256').update(path).digest('hex')
export type AvisoQuitacao = { veiculoId: string; vinculo: string; etapa: EtapaQuitacao; criadoEm: string }
export const fichaQuitacao = (id: string) => adminDb.collection('quitacao_fichas').doc(id)
export const anexoQuitacao = (id: string, tipo: TipoAnexo) => adminDb.collection('quitacao_anexos').doc(`${id}_${tipo}`)

export function acompanhamentoQuitacao(compra: NonNullable<ReturnType<typeof compraQuitacao>>, ficha?: FirebaseFirestore.DocumentData): Acompanhamento {
  const salvo = ficha?.portalAcompanhamento as Acompanhamento | undefined
  if (salvo?.vinculo === compra.vinculo) return salvo

  const recebido: EventoQuitacao = { etapa: 'recebido', em: compra.data }
  const quitadoLegado = !salvo && ficha?.quitado === true && documentoQuitacao(ficha.cpf) === compra.documento &&
    (!ficha.dataCompra || ficha.dataCompra === compra.data)
  const quitadoEm = quitadoLegado && (ficha.quitadoEm || ficha.atualizadoEm)
  return {
    vinculo: compra.vinculo,
    etapa: quitadoEm ? 'quitado' : 'recebido',
    atualizadoEm: quitadoEm || compra.data,
    historico: quitadoEm ? [recebido, { etapa: 'quitado', em: quitadoEm }] : [recebido],
    publicados: {},
  }
}

/** Atualiza a mesma ficha usada pela equipe e grava o evento de notificação na transação. */
export async function atualizarAcompanhamento(veiculoId: string, etapaSolicitada: EtapaQuitacao, uid: string, publicacao?: { vinculo: string; arquivos: PublicacaoQuitacao[]; previsao?: string | null }) {
  const veiculoRef = adminDb.collection('veiculos').doc(veiculoId)
  const fichaRef = fichaQuitacao(veiculoId)
  const avisoRef = adminDb.collection(FILA_QUITACAO).doc(randomUUID())
  return adminDb.runTransaction(async (tx) => {
    const [veiculo, ficha] = await tx.getAll(veiculoRef, fichaRef)
    const compra = compraQuitacao(veiculo.data())
    if (!compra) return { vinculado: false as const, aviso: null }
    if (publicacao && publicacao.vinculo !== compra.vinculo) throw new Error('A aquisição mudou.')
    const atual = acompanhamentoQuitacao(compra, ficha.data())
    const etapa = !publicacao && etapaSolicitada === 'quitado' && atual.etapa === 'finalizado'
      ? 'finalizado'
      : etapaSolicitada
    const publicados: Acompanhamento['publicados'] = publicacao ? {} : atual.publicados
    const arquivos = publicacao?.arquivos ?? []
    if (arquivos.length) {
      const anexos = await tx.getAll(...arquivos.map(({ tipo }) => anexoQuitacao(veiculoId, tipo)))
      for (const [i, anexo] of anexos.entries()) {
        const path = anexo.get('storagePath')
        const { tipo, versao } = arquivos[i]
        if (anexo.get('veiculoId') !== veiculoId || anexo.get('tipo') !== tipo ||
          typeof path !== 'string' || !path.startsWith(`quitacoes/${veiculoId}/`) || versaoAnexoQuitacao(path) !== versao) {
          throw new Error('O arquivo foi alterado.')
        }
        publicados[tipo] = path
      }
    }
    const mudouEtapa = atual.etapa !== etapa
    const agora = new Date()
    const em = agora.toISOString()
    const mudouAnexo = TIPOS_ANEXO.some(({ id }) => atual.publicados[id] !== publicados[id])
    const previsao = publicacao ? publicacao.previsao || null : atual.previsao ?? null
    const mudouPrevisao = previsao !== (atual.previsao ?? null)
    const quitado = etapaTemQuitacao(etapa)
    const anterior = ficha.data()
    const segueQuitado = !!anterior?.quitado && anterior.portalAcompanhamento?.vinculo === compra.vinculo
    const aviso = mudouEtapa && etapaNotificavel(etapa)
    const novo: Acompanhamento = {
      ...atual, etapa, publicados, previsao,
      avisoId: mudouEtapa ? (aviso ? avisoRef.id : null) : atual.avisoId ?? null,
      atualizadoEm: mudouEtapa || mudouAnexo || mudouPrevisao ? em : atual.atualizadoEm,
      historico: mudouEtapa ? [...atual.historico, { etapa, em }] : atual.historico,
    }
    tx.set(fichaRef, {
      atualizadoEm: em,
      atualizadoPorUid: uid,
      quitado,
      quitadoEm: quitado
        ? ((segueQuitado || etapaTemQuitacao(atual.etapa)) && anterior?.quitadoEm || dataSaoPaulo.format(agora))
        : null,
      portalAcompanhamento: novo,
    }, { mergeFields: ['atualizadoEm', 'atualizadoPorUid', 'quitado', 'quitadoEm', 'portalAcompanhamento'] })

    if (aviso) tx.create(avisoRef, { veiculoId, vinculo: compra.vinculo, etapa, criadoEm: em, situacao: 'pendente' })
    return { vinculado: true as const, aviso: aviso ? avisoRef.id : null }
  })
}
