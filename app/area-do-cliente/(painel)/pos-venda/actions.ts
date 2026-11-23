'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { ativarPosVenda, cancelarPosVenda } from '@/utils/pos-venda/cobranca'
import { hojePosVenda, idPosVendaValido, servicoValido, servicosInclusos, type ContratoPosVenda } from '@/utils/pos-venda/modelo'
import { clienteComPosVenda, contratosPosVenda, registrarSolicitacao, veiculosPosVenda } from '@/utils/pos-venda/repositorio'
import { vendaPosVenda } from '@/utils/pos-venda/vinculo'

function atualizarPaginas() {
  revalidatePath('/area-do-cliente/pos-venda')
  revalidatePath('/dashboard/pos-venda')
}

export async function solicitarServicoPosVenda(veiculoId: string, servico: string) {
  const cliente = await clienteComPosVenda()
  if (!cliente || !idPosVendaValido(veiculoId) || !servicoValido(servico)) return { erro: 'Solicitação inválida.' }
  try {
    const resposta = await registrarSolicitacao(cliente, veiculoId, servico)
    atualizarPaginas()
    return resposta
  } catch {
    return { erro: 'Não foi possível registrar a solicitação.' }
  }
}

export async function aceitarServicoPosVenda(id: string, propostaId: string, aceitaTermos: boolean, autorizaRastreamento: boolean) {
  const cliente = await clienteComPosVenda()
  if (!cliente || !idPosVendaValido(id) || !idPosVendaValido(propostaId) || aceitaTermos !== true) return { erro: 'Proposta indisponível.' }

  try {
    const aceito = await adminDb.runTransaction(async (tx) => {
      const ref = contratosPosVenda().doc(id)
      const pedido = (await tx.get(ref)).data() as ContratoPosVenda | undefined
      if (pedido?.documento !== cliente.documento || pedido.situacao !== 'proposta' ||
        pedido.proposta?.id !== propostaId || pedido.proposta.vencimento < hojePosVenda()) return false
      const venda = vendaPosVenda((await tx.get(veiculosPosVenda().doc(pedido.veiculoId))).data())
      if (venda?.vinculo !== pedido.vinculo || venda.documento !== cliente.documento) return false
      const temRastreamento = servicosInclusos(pedido.servico).includes('rastreamento')
      if (temRastreamento && autorizaRastreamento !== true) return false
      tx.update(ref, { situacao: 'aceito', aceite: { propostaId, em: new Date().toISOString(), rastreamento: temRastreamento } })
      return true
    })
    if (!aceito) return { erro: 'Confira a proposta, a autorização e o vencimento.' }
    const ativacao = await ativarPosVenda(id)
    atualizarPaginas()
    return ativacao.sucesso
      ? { sucesso: true, mensagem: 'Serviço contratado. Consulte as mensalidades abaixo.' }
      : { sucesso: true, mensagem: 'Aceite registrado. A Liberty ainda precisa confirmar a ativação da cobrança.' }
  } catch {
    atualizarPaginas()
    return { erro: 'Não foi possível concluir agora. Confira a situação antes de tentar novamente.' }
  }
}

export async function cancelarServicoPosVenda(id: string) {
  const cliente = await clienteComPosVenda()
  if (!cliente || !idPosVendaValido(id)) return { erro: 'Contrato indisponível.' }
  const resultado = await cancelarPosVenda(id, cliente.documento)
  atualizarPaginas()
  return resultado
}
