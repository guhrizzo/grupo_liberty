'use server'

import { revalidatePath } from 'next/cache'
import { adminDb } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { clientesPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { normalizarDocumento } from '@/utils/portal/documento'
import {
  centavosInvestimento, dataInvestimentoValida, hojeInvestimento, idInvestimentoValido,
  SITUACOES_OPCAO, TIPOS_MOVIMENTO, type OpcaoInvestimento,
} from '@/utils/investimentos/modelo'
import {
  abrirPosicaoInvestimento, alterarSituacaoPosicao, estornarMovimentoInvestimento,
  opcoesInvestimento, registrarMovimentoInvestimento,
} from '@/utils/investimentos/repositorio'

const texto = (form: FormData, chave: string) => {
  const valor = form.get(chave)
  return typeof valor === 'string' ? valor.trim() : ''
}

function atualizarPaginas(id?: string) {
  revalidatePath('/dashboard/investimentos')
  revalidatePath('/area-do-cliente/investimentos')
  if (id) {
    revalidatePath(`/dashboard/investimentos/${id}`)
    revalidatePath(`/area-do-cliente/investimentos/${id}`)
  }
}

export async function localizarTitularInvestimento(valor: string) {
  await assertPageAccess('investimentos')
  const documento = normalizarDocumento(valor)
  if (!documento) return { erro: 'Informe um CPF ou CNPJ válido.' }
  try {
    const cliente = await clientesPortal().doc(documento).get()
    const cadastro = cliente.get('portal') as CadastroPortal | undefined
    if (!cadastro?.ativo || !cadastro.modulos.includes('investimentos')) {
      return { erro: 'O cliente precisa ter acesso ativo ao módulo Investimentos.' }
    }
    return { titular: { documento, nome: String(cliente.get('contratante.nome') || 'Cliente') } }
  } catch {
    return { erro: 'Não foi possível localizar o cliente.' }
  }
}

export async function salvarOpcaoInvestimento(form: FormData) {
  const usuario = await assertPageAccess('investimentos')
  const id = texto(form, 'id')
  const registroId = texto(form, 'registroId')
  const versao = texto(form, 'versao')
  const situacao = SITUACOES_OPCAO.find((item) => item.value === texto(form, 'situacao'))?.value
  if (!idInvestimentoValido(id || registroId) || !situacao) return { erro: 'Opção inválida.' }
  const campos = {
    nome: texto(form, 'nome'), categoria: texto(form, 'categoria'), descricao: texto(form, 'descricao'),
    prazo: texto(form, 'prazo'), liquidez: texto(form, 'liquidez'), riscos: texto(form, 'riscos'),
    condicoes: texto(form, 'condicoes'),
  }
  if (campos.nome.length < 2 || campos.nome.length > 100 || !campos.categoria || campos.categoria.length > 80 ||
    campos.prazo.length > 120 || campos.liquidez.length > 180 ||
    [campos.riscos, campos.condicoes, campos.descricao].some((valor) => valor.length > 3000)) {
    return { erro: 'Revise o nome, a categoria e o limite de caracteres dos campos.' }
  }
  if (situacao === 'publicada' && [campos.descricao, campos.prazo, campos.liquidez, campos.riscos, campos.condicoes].some((valor) => !valor)) {
    return { erro: 'Preencha descrição, prazo, liquidez, riscos e condições para publicar.' }
  }

  try {
    const ref = opcoesInvestimento().doc(id || registroId)
    const evento = ref.collection('versoes').doc()
    const dados: OpcaoInvestimento = { ...campos, situacao, atualizadaEm: new Date().toISOString() }
    const retorno = await adminDb.runTransaction(async (tx) => {
      const atual = await tx.get(ref)
      if (id && (!atual.exists || atual.get('atualizadaEm') !== versao)) return { erro: 'A opção foi atualizada em outra sessão. Recarregue antes de salvar.' }
      if (!id && atual.exists) {
        const igual = atual.get('situacao') === situacao &&
          Object.entries(campos).every(([chave, valor]) => atual.get(chave) === valor)
        return igual ? { sucesso: true } : { erro: 'Este registro já foi utilizado. Atualize a tela antes de tentar novamente.' }
      }
      tx.set(ref, dados)
      tx.create(evento, { ...dados, porUid: usuario.uid })
      return { sucesso: true }
    })
    atualizarPaginas()
    return retorno
  } catch {
    return { erro: 'Não foi possível salvar a opção.' }
  }
}

export async function cadastrarPosicaoInvestimento(form: FormData) {
  const usuario = await assertPageAccess('investimentos')
  const id = texto(form, 'registroId')
  const documento = normalizarDocumento(texto(form, 'documento'))
  const opcaoId = texto(form, 'opcaoId')
  const referencia = texto(form, 'referencia')
  const data = texto(form, 'data')
  const valor = centavosInvestimento(texto(form, 'valor'))
  if (!idInvestimentoValido(id) || !documento || !idInvestimentoValido(opcaoId) || !referencia || referencia.length > 100 ||
    !dataInvestimentoValida(data) || valor === null || valor <= 0) {
    return { erro: 'Confira o cliente, a opção, a referência, a data e o aporte inicial.' }
  }
  try {
    const resultado = await abrirPosicaoInvestimento({ id, documento, opcaoId, referencia, data, valor, uid: usuario.uid })
    atualizarPaginas(id)
    return resultado
  } catch {
    return { erro: 'Não foi possível registrar a posição.' }
  }
}

export async function salvarMovimentoInvestimento(id: string, form: FormData) {
  const usuario = await assertPageAccess('investimentos')
  const movimentoId = texto(form, 'movimentoId')
  const tipo = TIPOS_MOVIMENTO.find((item) => item.value === texto(form, 'tipo'))?.value
  const valor = centavosInvestimento(texto(form, 'valor'))
  const data = texto(form, 'data')
  const descricao = texto(form, 'descricao')
  if (!idInvestimentoValido(id) || !idInvestimentoValido(movimentoId) || movimentoId === 'abertura' || !tipo || valor === null ||
    !dataInvestimentoValida(data) || descricao.length > 500 || (tipo === 'ajuste' && !descricao)) {
    return { erro: 'Confira o tipo, o valor e a data. Ajustes precisam de uma descrição.' }
  }
  try {
    const resultado = await registrarMovimentoInvestimento({ posicaoId: id, movimentoId, tipo, valor, data, descricao, uid: usuario.uid })
    atualizarPaginas(id)
    return resultado
  } catch {
    return { erro: 'Não foi possível registrar a movimentação.' }
  }
}

export async function corrigirMovimentoInvestimento(id: string, movimentoId: string, form: FormData) {
  const usuario = await assertPageAccess('investimentos')
  const motivo = texto(form, 'motivo')
  if (!idInvestimentoValido(id) || !idInvestimentoValido(movimentoId) || !motivo || motivo.length > 500) {
    return { erro: 'Informe o motivo do estorno.' }
  }
  try {
    const resultado = await estornarMovimentoInvestimento(id, movimentoId, motivo, usuario.uid, hojeInvestimento())
    atualizarPaginas(id)
    return resultado
  } catch {
    return { erro: 'Não foi possível estornar a movimentação.' }
  }
}

export async function atualizarSituacaoInvestimento(id: string, situacao: string) {
  const usuario = await assertPageAccess('investimentos')
  if (!idInvestimentoValido(id) || (situacao !== 'ativa' && situacao !== 'encerrada')) return { erro: 'Situação inválida.' }
  try {
    const resultado = await alterarSituacaoPosicao(id, situacao, usuario.uid)
    atualizarPaginas(id)
    return resultado
  } catch {
    return { erro: 'Não foi possível atualizar a situação.' }
  }
}
