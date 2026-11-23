'use server'

import { revalidatePath } from 'next/cache'
import { FieldValue } from 'firebase-admin/firestore'
import { Resend } from 'resend'
import { adminDb } from '@/utils/firebase/admin'
import { assertPageAccess, hasPageAccess } from '@/utils/permissions'
import { parseMoney } from '@/utils/masks'
import { clientesPortal, tokenPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { ativarPosVenda, cancelarPosVenda, sincronizarMensalidadesPosVenda } from '@/utils/pos-venda/cobranca'
import { ANDAMENTOS_POS_VENDA, hojePosVenda, idPosVendaValido, servicosInclusos, type ContratoPosVenda, type PropostaPosVenda } from '@/utils/pos-venda/modelo'
import { contratosPosVenda, veiculosPosVenda } from '@/utils/pos-venda/repositorio'
import { vendaPosVenda } from '@/utils/pos-venda/vinculo'

const texto = (form: FormData, chave: string) => String(form.get(chave) ?? '').trim()

function atualizarPaginas() {
  revalidatePath('/dashboard/pos-venda')
  revalidatePath('/area-do-cliente/pos-venda')
  revalidatePath('/dashboard/financeiro')
}

function vencimentoValido(vencimento: string) {
  const data = new Date(`${vencimento}T12:00:00Z`)
  return /^\d{4}-\d{2}-\d{2}$/.test(vencimento) && Number.isFinite(data.getTime()) &&
    data.toISOString().slice(0, 10) === vencimento && vencimento >= hojePosVenda()
}

export async function prepararPropostaPosVenda(id: string, form: FormData) {
  const usuario = await assertPageAccess('pos_venda')
  if (!hasPageAccess(usuario, 'financeiro')) return { erro: 'A proposta precisa ser preparada por quem tem acesso ao Financeiro.' }
  if (!idPosVendaValido(id)) return { erro: 'Solicitação inválida.' }

  const valorCentavos = Math.round(parseMoney(texto(form, 'valor')) * 100)
  const vencimento = texto(form, 'vencimento')
  const termos = texto(form, 'termos')
  const rastreador = texto(form, 'rastreador')
  const honorarios20 = form.get('honorarios20') === 'on'
  if (!Number.isSafeInteger(valorCentavos) || valorCentavos <= 0 || !vencimentoValido(vencimento) || !termos || termos.length > 8000) {
    return { erro: 'Informe a mensalidade, o primeiro vencimento e as condições da contratação.' }
  }

  try {
    const resultado = await adminDb.runTransaction(async (tx) => {
      const ref = contratosPosVenda().doc(id)
      const pedido = (await tx.get(ref)).data() as ContratoPosVenda | undefined
      const aceiteVencido = pedido?.situacao === 'aceito' && !!pedido.proposta && pedido.proposta.vencimento < hojePosVenda()
      if (!pedido || (!['solicitado', 'proposta'].includes(pedido.situacao) && !aceiteVencido)) return { erro: 'Solicitação indisponível.' }
      const venda = vendaPosVenda((await tx.get(veiculosPosVenda().doc(pedido.veiculoId))).data())
      if (venda?.vinculo !== pedido.vinculo) return { erro: 'O vínculo da venda mudou.' }
      const inclui = servicosInclusos(pedido.servico)
      if (inclui.includes('rastreamento') && (!idPosVendaValido(rastreador) || !venda.placa)) {
        return { erro: 'Informe o identificador do rastreador e confira a placa cadastrada no veículo.' }
      }
      const proposta: PropostaPosVenda = {
        id: tokenPortal(), valorCentavos, vencimento, termos,
        honorarios20: inclui.includes('juridico') && honorarios20,
        rastreador: inclui.includes('rastreamento') ? rastreador : null,
      }
      tx.update(ref, { situacao: 'proposta', proposta, aceite: FieldValue.delete(), propostaPorUid: usuario.uid })
      return { sucesso: true }
    })
    atualizarPaginas()
    return resultado
  } catch {
    return { erro: 'Não foi possível salvar a proposta.' }
  }
}

export async function acaoFinanceiraPosVenda(id: string, acao: string) {
  const usuario = await assertPageAccess('pos_venda')
  if (!hasPageAccess(usuario, 'financeiro') || !idPosVendaValido(id)) return { erro: 'Ação indisponível.' }
  try {
    if (acao === 'ativar') return await ativarPosVenda(id)
    if (acao === 'cancelar') return await cancelarPosVenda(id)
    if (acao === 'sincronizar') {
      const contrato = (await contratosPosVenda().doc(id).get()).data() as ContratoPosVenda | undefined
      if (!contrato?.asaasId) return { erro: 'A assinatura ainda não foi confirmada.' }
      await sincronizarMensalidadesPosVenda(id, contrato)
      return { sucesso: true }
    }
    return { erro: 'Ação inválida.' }
  } catch {
    return { erro: 'Não foi possível concluir. Confira o estado da assinatura no Asaas.' }
  } finally {
    atualizarPaginas()
  }
}

export async function publicarAndamentoPosVenda(id: string, form: FormData) {
  const usuario = await assertPageAccess('pos_venda')
  const categoria = ANDAMENTOS_POS_VENDA.find((a) => a.id === texto(form, 'tipo'))
  const mensagem = texto(form, 'mensagem')
  const responsavel = texto(form, 'responsavel')
  if (!idPosVendaValido(id) || !categoria || !mensagem || mensagem.length > 600 || responsavel.length > 120) {
    return { erro: 'Informe um tipo e um resumo de até 600 caracteres.' }
  }
  if (!hasPageAccess(usuario, categoria.servico === 'juridico' ? 'juridico' : 'veiculos')) return { erro: 'Acesso negado a este serviço.' }

  try {
    const ref = contratosPosVenda().doc(id)
    const evento = ref.collection('andamentos').doc()
    const contrato = await adminDb.runTransaction(async (tx) => {
      const atual = (await tx.get(ref)).data() as ContratoPosVenda | undefined
      if (atual?.situacao !== 'ativo' || !servicosInclusos(atual.servico).includes(categoria.servico)) return null
      const venda = vendaPosVenda((await tx.get(veiculosPosVenda().doc(atual.veiculoId))).data())
      if (venda?.vinculo !== atual.vinculo) return null
      tx.create(evento, {
        tipo: categoria.id, texto: mensagem, responsavel,
        em: new Date().toISOString(), publicadoPorUid: usuario.uid,
      })
      return atual
    })
    if (!contrato) return { erro: 'O serviço ou o vínculo da venda não está ativo.' }
    atualizarPaginas()
    const apiKey = process.env.RESEND_API_KEY
    if (!['restricao', 'busca_apreensao'].includes(categoria.id)) return { sucesso: true }
    if (!apiKey) return { sucesso: true, aviso: 'Alerta publicado no portal. O envio por e-mail está indisponível.' }
    try {
      const cadastro = (await clientesPortal().doc(contrato.documento).get()).get('portal') as CadastroPortal | undefined
      if (cadastro?.ativo && cadastro.modulos.includes('posVenda')) {
        const { error } = await new Resend(apiKey).emails.send({
          from: 'Liberty Car <noreply@grupolibertycar.com.br>',
          to: cadastro.email,
          subject: 'Novo aviso na sua Área do Cliente | Liberty Car',
          text: 'A Liberty publicou uma atualização no seu serviço de acompanhamento. Acesse a Área do Cliente para consultar.',
        }, { idempotencyKey: `pos-venda-${evento.id}` })
        if (error) return { sucesso: true, aviso: 'Alerta publicado no portal. O e-mail não foi entregue pelo provedor.' }
      }
    } catch {
      return { sucesso: true, aviso: 'Alerta publicado no portal. O envio por e-mail não foi confirmado.' }
    }
    return { sucesso: true }
  } catch {
    return { erro: 'Não foi possível publicar a atualização.' }
  }
}
