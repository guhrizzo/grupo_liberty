import 'server-only'
import { adminDb } from '@/utils/firebase/admin'
import { formatosDocumento } from './documento'
import { clienteAutenticado } from './acesso'

const texto = (valor: unknown) => typeof valor === 'string' ? valor.trim() : ''

export async function carregarPainelCliente({ incluirFotos = false } = {}) {
  const cliente = await clienteAutenticado()
  if (!cliente) return null

  const documentos = formatosDocumento(cliente.documento)
  const [contratos, gerados, cobrancas] = await Promise.all([
    adminDb.collection('contratos').where('clienteCpfCnpj', 'in', documentos).get(),
    adminDb.collection('veiculo_contratos').where('portalDocumento', 'in', documentos).get(),
    adminDb.collection('cobrancas').where('cliente.cpf', 'in', documentos).get(),
  ])

  const veiculos = new Map<string, string>()
  const registros = [
    ...contratos.docs.map((doc) => ({
      id: `contrato-${doc.id}`,
      titulo: texto(doc.get('categoriaNome')) || 'Contrato',
      detalhe: doc.get('status') === 'cancelado' ? 'Cancelado' : 'Contrato',
      veiculoId: texto(doc.get('veiculoId')),
      veiculo: texto(doc.get('veiculoResumo')),
    })),
    ...gerados.docs.map((doc) => ({
      id: `anexo-${doc.id}`,
      titulo: texto(doc.get('categoriaNome')) || 'Contrato',
      detalhe: 'Contrato',
      veiculoId: texto(doc.get('veiculoId')),
      veiculo: '',
    })),
    ...cobrancas.docs.filter((doc) => !doc.get('excluidaEm')).map((doc) => ({
      id: `cobranca-${doc.id}`,
      titulo: 'Operação financeira',
      detalhe: 'Cobrança vinculada',
      veiculoId: texto(doc.get('veiculoId')),
      veiculo: texto(doc.get('veiculoResumo')),
    })),
  ]

  for (const registro of registros) {
    if (!registro.veiculoId || registro.detalhe === 'Cancelado') continue
    if (registro.veiculo) veiculos.set(registro.veiculoId, registro.veiculo)
    else if (!veiculos.has(registro.veiculoId)) veiculos.set(registro.veiculoId, '')
  }

  const fotos = new Map<string, string>()
  const refs = [...veiculos].filter(([, resumo]) => incluirFotos || !resumo)
    .map(([id]) => adminDb.collection('veiculos').doc(id))
  if (refs.length) {
    const docs = await adminDb.getAll(...refs)
    for (const doc of docs) {
      const resumo = [texto(doc.get('marca')), texto(doc.get('modelo')), String(doc.get('ano') ?? '')].filter(Boolean).join(' ')
      if (!veiculos.get(doc.id)) veiculos.set(doc.id, resumo || 'Veículo vinculado')
      const imagens = doc.get('fotos')
      if (incluirFotos && Array.isArray(imagens)) {
        const foto = imagens.map(texto).find((url) => /^https:\/\//i.test(url) || /^\/(?![\\/])/.test(url))
        if (foto) fotos.set(doc.id, foto)
      }
    }
  }

  return {
    nome: cliente.nome,
    modulos: cliente.cadastro.modulos,
    veiculos: [...veiculos].map(([id, nome]) => ({ id, nome, foto: fotos.get(id) ?? null })),
    registros,
  }
}
