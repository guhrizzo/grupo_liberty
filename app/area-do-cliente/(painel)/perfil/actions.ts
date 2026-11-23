'use server'

import { revalidatePath } from 'next/cache'
import { encrypt } from '@/utils/crypto'
import { adminDb } from '@/utils/firebase/admin'
import { isEstadoValido } from '@/utils/estadosBrasil'
import { onlyDigits } from '@/utils/masks'
import { clienteAutenticado, clientesPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { normalizarDocumento } from '@/utils/portal/documento'

function campo(dados: FormData, chave: string) {
  const valor = dados.get(chave)
  return typeof valor === 'string' ? valor.trim() : ''
}

export async function salvarPerfilPortal(dados: FormData) {
  const cliente = await clienteAutenticado()
  if (!cliente) return { erro: 'Entre novamente para alterar seu perfil.' }

  const nome = campo(dados, 'nome')
  const telefoneInformado = campo(dados, 'telefone')
  const telefone = onlyDigits(telefoneInformado)
  const cidade = campo(dados, 'cidade')
  const uf = campo(dados, 'uf').toUpperCase()
  const cpfInformado = cliente.documento.length === 14 ? campo(dados, 'cpfResponsavel') : ''
  const cpfResponsavel = normalizarDocumento(cpfInformado)

  if (nome.length < 2 || nome.length > 120) return { erro: 'Informe um nome com 2 a 120 caracteres.' }
  if (telefoneInformado && (!/^[\d ()-]+$/.test(telefoneInformado) || !/^\d{10,11}$/.test(telefone))) {
    return { erro: 'Informe um telefone com DDD.' }
  }
  if (cidade.length > 120 || (uf && !isEstadoValido(uf))) return { erro: 'Revise a cidade e o estado.' }
  if (cpfInformado && cpfResponsavel.length !== 11) return { erro: 'Informe um CPF válido para o responsável.' }

  try {
    const cpfResponsavelCifrado = encrypt(cpfResponsavel)
    const salvo = await adminDb.runTransaction(async (tx) => {
      const ref = clientesPortal().doc(cliente.documento)
      const cadastro = (await tx.get(ref)).get('portal') as CadastroPortal | undefined
      if (!cadastro?.ativo || cadastro.versao !== cliente.cadastro.versao) return false

      tx.update(ref, { 'portal.perfil': { nome, telefone, cidade, uf, cpfResponsavelCifrado } })
      return true
    })
    if (!salvo) return { erro: 'Entre novamente para alterar seu perfil.' }
  } catch {
    return { erro: 'Não foi possível salvar seus dados. Tente novamente.' }
  }

  revalidatePath('/area-do-cliente', 'layout')
  return { sucesso: true }
}
