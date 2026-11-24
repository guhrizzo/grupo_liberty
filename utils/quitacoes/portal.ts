import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { clienteAutenticado } from '@/utils/portal/acesso'
import { TIPOS_ANEXO, type TipoAnexo } from '@/app/dashboard/quitacoes/types'
import { acompanhamentoQuitacao, anexoQuitacao, fichaQuitacao } from './acompanhamento'
import { etapaTemQuitacao } from './etapas'
import { chaveTitularQuitacao, compraQuitacao } from './vinculo'

export async function listarQuitacoesCliente() {
  const cliente = await clienteAutenticado()
  if (!cliente || !cliente.cadastro.modulos.includes('quitacao')) return null
  const chave = chaveTitularQuitacao(cliente.documento)
  if (!chave) return []

  const snapshot = await adminDb.collection('veiculos').where('portalQuitacaoChave', '==', chave)
    .select('sellerCpf', 'terceiro', 'dataAquisicao', 'marca', 'modelo', 'ano', 'placa', 'banco').get()
  const titular = snapshot.docs.flatMap((veiculo) => {
    const compra = compraQuitacao(veiculo.data())
    return compra?.documento === cliente.documento ? [{ veiculo, compra }] : []
  })

  return Promise.all(titular.map(async ({ veiculo, compra }) => {
    const ficha = await fichaQuitacao(veiculo.id).get()
    const { etapa, atualizadoEm, historico, publicados, previsao } = acompanhamentoQuitacao(compra, ficha.data())
    const anexos = TIPOS_ANEXO.filter(({ id }) => !!publicados[id])
    const documentos = await Promise.all(anexos.map(async ({ id, label }) => {
      const anexo = await anexoQuitacao(veiculo.id, id).get()
      if (anexo.get('storagePath') !== publicados[id] || anexo.get('veiculoId') !== veiculo.id || anexo.get('tipo') !== id) return null
      return { tipo: id, nome: label, data: String(anexo.get('uploadedAt') ?? '') }
    }))

    const titulo = ['marca', 'modelo', 'ano'].map((campo) => String(veiculo.get(campo) ?? '').trim()).filter(Boolean).join(' ')
    return {
      id: veiculo.id,
      titulo: titulo || 'Veículo vendido à Liberty',
      placa: String(veiculo.get('placa') ?? ''),
      banco: String(veiculo.get('banco') ?? '').trim(),
      dataOperacao: compra.data,
      // Previsão só aparece enquanto a quitação não terminou.
      previsao: previsao && !etapaTemQuitacao(etapa) ? previsao : null,
      etapa, atualizadoEm, historico,
      documentos: documentos.filter((item) => item !== null),
    }
  }))
}

export async function obterDocumentoQuitacaoCliente(veiculoId: string, tipo: TipoAnexo) {
  const cliente = await clienteAutenticado()
  if (!cliente?.cadastro.modulos.includes('quitacao')) return null

  // Leituras no mesmo snapshot para autorizar a versão exata do anexo.
  return adminDb.runTransaction(async (tx) => {
    const [veiculo, ficha, anexo] = await tx.getAll(
      adminDb.collection('veiculos').doc(veiculoId),
      fichaQuitacao(veiculoId),
      anexoQuitacao(veiculoId, tipo),
    )
    const compra = compraQuitacao(veiculo.data())
    if (compra?.documento !== cliente.documento) return null
    const path = anexo.get('storagePath')
    if (typeof path !== 'string' || !path.startsWith(`quitacoes/${veiculoId}/`) ||
      anexo.get('veiculoId') !== veiculoId || anexo.get('tipo') !== tipo ||
      acompanhamentoQuitacao(compra, ficha.data()).publicados[tipo] !== path) return null

    return { path, tamanho: Number(anexo.get('size')), contentType: String(anexo.get('contentType') ?? '') }
  }, { readOnly: true })
}
