'use server'

import { redirect } from 'next/navigation'
import { enviarRedefinicaoPortal } from '@/utils/email/send-redefinicao-portal'
import { atalhosPortal, idsMenuPortal, modulosPortal, normalizarEmail } from '@/utils/portal/modelo'
import { rateLimit } from '@/utils/rate-limit'
import { adminDb } from '@/utils/firebase/admin'
import { converterPorLogin, registrarIndicado, type ResultadoRegistro } from '@/utils/indicacoes/servidor'
import { chaveHash, clienteAutenticado, clientesPortal, encerrarSessaoPortal, iniciarSessaoPortal, type CadastroPortal } from '@/utils/portal/acesso'

export async function entrarPortal(idToken: string) {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 8192) {
    return { erro: 'Não foi possível validar a autenticação. Entre novamente.' }
  }

  try {
    const resultado = await iniciarSessaoPortal(idToken)
    if (resultado === 'identidade-invalida') {
      return { erro: 'Confirme seu e-mail e entre novamente.' }
    }
    if (resultado === 'sem-cadastro') {
      return { erro: 'Este e-mail ainda não tem acesso liberado. Fale com a equipe Liberty para vincular sua conta ao cadastro.' }
    }
    // Primeiro acesso de uma pessoa indicada: converte a indicação (não bloqueia o login se falhar).
    await converterPorLogin(idToken)
    return { sucesso: true }
  } catch {
    return { erro: 'Não foi possível iniciar a sessão. Tente novamente.' }
  }
}

export async function registrarIndicadoPortal(
  idToken: string,
  codigo: string,
  dados: { nome: string; cpf: string; telefone: string },
): Promise<ResultadoRegistro> {
  if (typeof idToken !== 'string' || !idToken || idToken.length > 8192 || typeof codigo !== 'string' ||
    !dados || typeof dados.nome !== 'string' || typeof dados.cpf !== 'string' || typeof dados.telefone !== 'string') {
    return { erro: 'Confira os dados informados.' }
  }
  try {
    return await registrarIndicado({ idToken, codigo, nome: dados.nome, cpf: dados.cpf, telefone: dados.telefone })
  } catch {
    return { erro: 'Não foi possível concluir o cadastro. Tente novamente.' }
  }
}

export async function sairPortal() {
  await encerrarSessaoPortal()
  redirect('/area-do-cliente/entrar')
}

export async function solicitarRedefinicaoPortal(valor: string) {
  const email = normalizarEmail(valor)
  if (!email) return { erro: 'Informe um e-mail válido.' }

  const limite = rateLimit(`redefinicao-portal:${chaveHash(email)}`, 3, 15 * 60 * 1000)
  if (!limite.allowed) return { sucesso: true }

  try {
    await enviarRedefinicaoPortal(email)
    return { sucesso: true }
  } catch {
    console.error('[portal] Falha ao processar uma solicitação de redefinição.')
    return { erro: 'Não foi possível solicitar a redefinição. Tente novamente em instantes.' }
  }
}

export async function salvarOrdemMenuPortal(ordem: string[]) {
  const cliente = await clienteAutenticado()
  if (!cliente) return { erro: 'Entre novamente para atualizar o menu.' }
  if (!Array.isArray(ordem) || ordem.length > atalhosPortal.length + modulosPortal.length) return { erro: 'A ordem do menu é inválida.' }

  try {
    return await adminDb.runTransaction(async (tx) => {
      const ref = clientesPortal().doc(cliente.documento)
      const cadastro = (await tx.get(ref)).get('portal') as CadastroPortal | undefined
      if (!cadastro?.ativo || cadastro.versao !== cliente.cadastro.versao) {
        return { erro: 'Entre novamente para atualizar o menu.' }
      }

      const permitidos = idsMenuPortal(cadastro.modulos)
      if (new Set(ordem).size !== ordem.length || ordem.some((id) => !permitidos.includes(id))) {
        return { erro: 'A ordem do menu é inválida.' }
      }

      tx.update(ref, { 'portal.ordemMenu': ordem })
      return { sucesso: true }
    })
  } catch {
    return { erro: 'Não foi possível salvar a ordem do menu.' }
  }
}
