import { createHmac } from 'node:crypto'
import { decrypt } from '@/utils/crypto'
import { normalizarDocumento } from '@/utils/portal/documento'

export function chaveTitularQuitacao(documento: unknown) {
  const segredo = process.env.PORTAL_QUITACAO_INDEX_KEY || process.env.FIREBASE_PRIVATE_KEY
  const doc = normalizarDocumento(documento)
  if (!segredo || !doc) return null
  return createHmac('sha256', segredo.replace(/\\n/g, '\n')).update(`quitacao-titular:${doc}`).digest('hex')
}

export function documentoQuitacao(valor: unknown) {
  if (typeof valor !== 'string') return ''
  return normalizarDocumento(valor.includes(':') ? decrypt(valor) : valor)
}

export function compraQuitacao(veiculo?: FirebaseFirestore.DocumentData) {
  if (!veiculo || veiculo.terceiro === true || typeof veiculo.dataAquisicao !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(veiculo.dataAquisicao)) return null
  const documento = documentoQuitacao(veiculo.sellerCpf)
  const chave = chaveTitularQuitacao(documento)
  if (!chave) return null
  return { documento, chave, data: veiculo.dataAquisicao, vinculo: `${chave}:${veiculo.dataAquisicao}` }
}
