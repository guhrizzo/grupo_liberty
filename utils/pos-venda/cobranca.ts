import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import {
  AsaasError, assinaturasPorReferencia, buscarCobranca, buscarOuCriarCliente, criarAssinaturaServico,
  inativarAssinaturaServico, listarMensalidadesAssinatura, obterAssinaturaServico, type AsaasMensalidadeServico, type AsaasAssinaturaServico,
} from '@/utils/asaas/client'
import { clientesPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { contratosPosVenda, encerrarContratoPosVenda, veiculosPosVenda } from './repositorio'
import { hojePosVenda, idPosVendaValido, nomeServico, pagoPosVenda, type ContratoPosVenda } from './modelo'
import { vendaPosVenda } from './vinculo'

const referencia = (id: string) => `liberty-pos-venda:${id}`
export const cobrancaPosVendaHabilitada = () =>
  process.env.POS_VENDA_COBRANCA_HABILITADA === 'true' &&
  !!process.env.ASAAS_API_KEY && !!process.env.ASAAS_WEBHOOK_TOKEN

function urlFatura(url?: string) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && /(^|\.)asaas\.com$/i.test(parsed.hostname) ? parsed.href : null
  } catch {
    return null
  }
}

type Pagamento = AsaasMensalidadeServico & { paymentDate?: string; clientPaymentDate?: string }

async function gravarMensalidade(id: string, contrato: ContratoPosVenda, pagamento: Pagamento) {
  if (!idPosVendaValido(pagamento.id) || pagamento.subscription !== contrato.asaasId ||
    pagamento.customer !== contrato.asaasCliente || !Number.isFinite(pagamento.value) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(pagamento.dueDate)) return

  const mensalidade = contratosPosVenda().doc(id).collection('mensalidades').doc(pagamento.id)
  const transacao = adminDb.collection('transacoes').doc(`pos_venda_${pagamento.id}`)
  const status = pagamento.deleted ? 'DELETED' : pagamento.status
  const agora = new Date().toISOString()
  const batch = adminDb.batch()
  batch.set(mensalidade, {
    vencimento: pagamento.dueDate, valor: pagamento.value, status,
    url: urlFatura(pagamento.invoiceUrl), atualizadoEm: agora,
  })
  if (pagoPosVenda(status)) {
    const data = pagamento.clientPaymentDate || pagamento.paymentDate || hojePosVenda()
    batch.set(transacao, {
      tipo: 'receita', categoria: 'Serviços de Pós-venda', descricao: `Mensalidade · ${nomeServico(contrato.servico)}`,
      valor: pagamento.value, data, status: 'concluido', origemPosVendaId: id,
      created_by: null, created_at: agora, updated_at: agora,
    }, { merge: true })
  } else if (['DELETED', 'REFUNDED', 'CHARGEBACK_DISPUTE_LOST'].includes(status)) {
    batch.delete(transacao)
  }
  await batch.commit()
}

export async function sincronizarMensalidadesPosVenda(id: string, contrato: ContratoPosVenda) {
  if (!contrato.asaasId) return
  const retorno = await listarMensalidadesAssinatura(contrato.asaasId)
  for (const pagamento of retorno.data) await gravarMensalidade(id, contrato, pagamento)
}

export async function tratarPagamentoPosVenda(evento: string, recebido: Pagamento): Promise<boolean> {
  if (!recebido.subscription) return false
  const snap = await contratosPosVenda().where('asaasId', '==', recebido.subscription).limit(1).get()
  const doc = snap.docs[0]
  if (!doc) return false
  const contrato = doc.data() as ContratoPosVenda
  if (evento === 'PAYMENT_DELETED') {
    await gravarMensalidade(doc.id, contrato, { ...recebido, deleted: true })
  } else {
    const atual = await buscarCobranca(recebido.id) as Pagamento
    await gravarMensalidade(doc.id, contrato, atual)
  }
  return true
}

export async function ativarPosVenda(id: string) {
  if (!cobrancaPosVendaHabilitada()) return { erro: 'A cobrança automática ainda não está habilitada neste ambiente.' }
  const ref = contratosPosVenda().doc(id)
  const dados = await adminDb.runTransaction(async (tx) => {
    const contrato = (await tx.get(ref)).data() as ContratoPosVenda | undefined
    if (!contrato?.proposta || contrato.aceite?.propostaId !== contrato.proposta.id ||
      !['aceito', 'ativando'].includes(contrato.situacao)) return null
    const venda = vendaPosVenda((await tx.get(veiculosPosVenda().doc(contrato.veiculoId))).data())
    if (venda?.vinculo !== contrato.vinculo) return null
    const clienteDoc = await tx.get(clientesPortal().doc(contrato.documento))
    const cadastro = clienteDoc.get('portal') as CadastroPortal | undefined
    if (!cadastro?.ativo || !cadastro.modulos.includes('posVenda')) return null

    const podeCriar = contrato.situacao === 'aceito'
    if (podeCriar && contrato.proposta.vencimento < hojePosVenda()) return null
    if (podeCriar) tx.update(ref, { situacao: 'ativando' })
    return { contrato, cadastro, podeCriar, nome: String(clienteDoc.get('contratante.nome') || 'Cliente') }
  })
  if (!dados?.contrato.proposta) return { erro: 'Confira o aceite, o vencimento e o vínculo da venda.' }

  const { contrato, cadastro, podeCriar, nome } = dados
  const proposta = contrato.proposta!
  let solicitouCriacao = false
  try {
    const refExterna = referencia(id)
    const existentes = (await assinaturasPorReferencia(refExterna)).data.filter((a) => a.externalReference === refExterna)
    if (existentes.length > 1) throw new Error('Assinaturas duplicadas para conferência.')
    let assinatura = existentes[0]
    if (!assinatura && !podeCriar) return { erro: 'O Asaas ainda não confirmou a assinatura. Confira a operação antes de tentar novamente.' }
    const cliente = await buscarOuCriarCliente({
      nome, cpfCnpj: contrato.documento, email: cadastro.email, telefone: cadastro.perfil?.telefone,
    })
    if (!assinatura) {
      solicitouCriacao = true
      assinatura = await criarAssinaturaServico(cliente, refExterna, proposta.valorCentavos / 100, proposta.vencimento, nomeServico(contrato.servico))
    }
    if (!assinatura.id || assinatura.customer !== cliente || assinatura.status !== 'ACTIVE' ||
      Math.round(Number(assinatura.value) * 100) !== proposta.valorCentavos) {
      throw new Error('Assinatura diverge da proposta aceita.')
    }
    const estado = await adminDb.runTransaction(async (tx) => {
      const atual = (await tx.get(ref)).data() as ContratoPosVenda | undefined
      if (atual?.situacao === 'ativo' && atual.asaasId === assinatura.id) return 'ativo'
      if (atual?.situacao !== 'ativando' || atual.proposta?.id !== proposta.id) return 'indisponivel'
      const venda = vendaPosVenda((await tx.get(veiculosPosVenda().doc(atual.veiculoId))).data())
      const situacao = venda?.vinculo === atual.vinculo ? 'ativo' : 'cancelando'
      tx.update(ref, { situacao, asaasId: assinatura.id, asaasCliente: assinatura.customer, ativadoEm: new Date().toISOString() })
      return situacao
    })
    if (estado === 'cancelando') await cancelarPosVenda(id)
    if (estado !== 'ativo') return { erro: 'O vínculo da venda mudou durante a ativação. Confira o contrato no painel.' }
    await sincronizarMensalidadesPosVenda(id, { ...contrato, asaasId: assinatura.id, asaasCliente: assinatura.customer }).catch(() => {
      console.warn('[pos-venda] Conciliação inicial pendente.')
    })
    return { sucesso: true }
  } catch (erro) {
    const rejeicaoDefinitiva = erro instanceof AsaasError && [400, 401, 403, 422].includes(erro.status)
    if (podeCriar && (!solicitouCriacao || rejeicaoDefinitiva)) {
      await adminDb.runTransaction(async (tx) => {
        const atual = await tx.get(ref)
        if (atual.get('situacao') === 'ativando') tx.update(ref, { situacao: 'aceito' })
      })
    }
    return { erro: 'Não foi possível confirmar a ativação no Asaas. A equipe pode acompanhar pelo painel.' }
  }
}

export async function cancelarPosVenda(id: string, documento?: string) {
  const ref = contratosPosVenda().doc(id)
  const alvo = await adminDb.runTransaction(async (tx) => {
    const contrato = (await tx.get(ref)).data() as ContratoPosVenda | undefined
    if (!contrato || (documento && contrato.documento !== documento) || contrato.situacao === 'ativando') return null
    if (contrato.asaasId && contrato.situacao !== 'cancelado') tx.update(ref, { situacao: 'cancelando' })
    return contrato
  })
  if (!alvo) return { erro: 'O contrato está indisponível ou há uma ativação em conferência.' }

  try {
    if (alvo.asaasId && alvo.situacao !== 'cancelado') {
      const assinatura = await inativarAssinaturaServico(alvo.asaasId)
      if (assinatura.status !== 'INACTIVE') return { erro: 'O cancelamento ainda está em conferência.' }
    }
    return await encerrarContratoPosVenda(id, documento) ? { sucesso: true } : { erro: 'Não foi possível concluir o cancelamento.' }
  } catch {
    return { erro: 'O cancelamento está em conferência. Tente novamente ou fale com a Liberty.' }
  }
}

export async function tratarEncerramentoAssinaturaPosVenda(evento: string, assinatura: AsaasAssinaturaServico) {
  if (!['SUBSCRIPTION_DELETED', 'SUBSCRIPTION_INACTIVATED'].includes(evento) ||
    !assinatura.externalReference?.startsWith('liberty-pos-venda:')) return
  const id = assinatura.externalReference.slice('liberty-pos-venda:'.length)
  if (!idPosVendaValido(id) || !idPosVendaValido(assinatura.id)) return
  const ref = contratosPosVenda().doc(id)
  const contrato = (await ref.get()).data() as ContratoPosVenda | undefined
  if (!contrato || contrato.asaasId !== assinatura.id || contrato.asaasCliente !== assinatura.customer) return

  if (evento === 'SUBSCRIPTION_INACTIVATED') {
    const atual = await obterAssinaturaServico(assinatura.id)
    if (atual.status !== 'INACTIVE') return
  }
  await adminDb.runTransaction(async (tx) => {
    const atual = await tx.get(ref)
    if (atual.get('asaasId') === assinatura.id && atual.get('situacao') === 'ativo') tx.update(ref, { situacao: 'cancelando' })
  })
  await encerrarContratoPosVenda(id)
}
