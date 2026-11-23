'use server'

import { adminDb } from '@/utils/firebase/admin'
import { assertPageAccess } from '@/utils/permissions'
import { formatosDocumento, normalizarDocumento } from '@/utils/portal/documento'
import { chaveHash, chavesPortal, clientesPortal, tokenPortal, type CadastroPortal } from '@/utils/portal/acesso'
import { modulosPortal, normalizarEmail, type ModuloPortal } from '@/utils/portal/modelo'

export interface DadosCliente {
  documento: string
  nome: string
  email: string
  ativo: boolean
  modulos: ModuloPortal[]
}

export type EstadoCadastro = {
  erro?: string
  sucesso?: string
  cliente?: DadosCliente
}

export async function buscarClientePortal(_estado: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  await assertPageAccess('clientes_portal')
  const documento = normalizarDocumento(form.get('documento'))
  if (!documento) return { erro: 'Informe um CPF ou CNPJ válido.' }

  const formatos = formatosDocumento(documento)
  const [cliente, contratos, cobrancas] = await Promise.all([
    clientesPortal().doc(documento).get(),
    adminDb.collection('contratos').where('clienteCpfCnpj', 'in', formatos).limit(1).get(),
    adminDb.collection('cobrancas').where('cliente.cpf', 'in', formatos).limit(1).get(),
  ])
  const contrato = contratos.docs[0]
  const cobranca = cobrancas.docs[0]
  const portal = cliente.get('portal') as CadastroPortal | undefined
  return {
    cliente: {
      documento,
      nome: String(cliente.get('contratante.nome') || contrato?.get('clienteNome') || cobranca?.get('clienteNome') || ''),
      email: portal?.email || normalizarEmail(cliente.get('contratante.email')) ||
        normalizarEmail(contrato?.get('clienteEmail')) || normalizarEmail(cobranca?.get('clienteEmail')),
      ativo: portal?.ativo ?? false,
      modulos: portal?.modulos ?? [],
    },
  }
}

export async function salvarClientePortal(_estado: EstadoCadastro, form: FormData): Promise<EstadoCadastro> {
  const usuario = await assertPageAccess('clientes_portal')
  const documento = normalizarDocumento(form.get('documento'))
  const email = normalizarEmail(form.get('email'))
  const nome = String(form.get('nome') ?? '').trim()
  const ativo = form.get('ativo') === 'on'

  if (!documento || !email || !nome || nome.length > 120) return { erro: 'Informe documento, nome e e-mail válidos.' }
  if (form.get('confirmado') !== 'on') return { erro: 'Confirme o vínculo entre o e-mail e o titular.' }

  const modulos = modulosPortal.filter(({ id }) => form.get(id) === 'on').map(({ id }) => id)
  const clienteRef = clientesPortal().doc(documento)
  const acessoRef = chavesPortal().doc(chaveHash(email))

  try {
    const salvo = await adminDb.runTransaction(async (tx) => {
      const [clienteDoc, acessoDoc] = await tx.getAll(clienteRef, acessoRef)
      if (acessoDoc.exists && acessoDoc.get('documento') !== documento) return false

      const anterior = clienteDoc.get('portal') as CadastroPortal | undefined
      const mesmoAcesso = anterior?.email === email && anterior.ativo === ativo &&
        acessoDoc.exists && acessoDoc.get('versao') === anterior.versao
      const versao = mesmoAcesso ? anterior.versao : tokenPortal()

      if (anterior?.email && anterior.email !== email) {
        tx.delete(chavesPortal().doc(chaveHash(anterior.email)))
      }
      if (!mesmoAcesso) tx.set(acessoRef, { documento, versao })

      tx.set(clienteRef, {
        contratante: { nome, ...(clienteDoc.exists ? {} : { cpf: documento, email }) },
        portal: { email, ativo, versao, modulos, atualizadoPorUid: usuario.uid, atualizadoEm: new Date().toISOString() },
      }, { merge: true })
      return true
    })

    if (!salvo) return { erro: 'Já existe um cadastro do portal com este e-mail.' }
    return {
      sucesso: ativo ? 'Cadastro salvo e acesso liberado.' : 'Cadastro salvo com acesso desativado.',
      cliente: { documento, nome, email, ativo, modulos },
    }
  } catch {
    return { erro: 'Não foi possível salvar o cadastro. Tente novamente.' }
  }
}
