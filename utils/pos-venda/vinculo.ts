import { createHmac } from 'node:crypto'
import { documentoQuitacao } from '@/utils/quitacoes/vinculo'
import { normalizarDocumento } from '@/utils/portal/documento'

export function chaveComprador(documento: unknown) {
  const segredo = process.env.PORTAL_POS_VENDA_INDEX_KEY || process.env.PORTAL_QUITACAO_INDEX_KEY || process.env.FIREBASE_PRIVATE_KEY
  const normalizado = normalizarDocumento(documento)
  if (!segredo || !normalizado) return null
  return createHmac('sha256', segredo.replace(/\\n/g, '\n')).update(`pos-venda-comprador:${normalizado}`).digest('hex')
}

export function vendaPosVenda(dados?: FirebaseFirestore.DocumentData) {
  if (!dados || dados.terceiro === true || !dados.vendidoEm) return null
  const documento = documentoQuitacao(dados.cpfCliente)
  const chave = chaveComprador(documento)
  const referencia = typeof dados.vendidoRegistradoEm === 'string' && dados.vendidoRegistradoEm ? dados.vendidoRegistradoEm : dados.vendidoEm
  if (!chave || typeof referencia !== 'string' || !Number.isFinite(Date.parse(referencia))) return null
  return {
    documento,
    vinculo: `${chave}:${referencia}`,
    nome: ['marca', 'modelo', 'ano'].map((campo) => String(dados[campo] || '')).filter(Boolean).join(' ') || 'Veículo',
    placa: String(dados.placa || ''),
    data: String(dados.vendidoEm),
  }
}
