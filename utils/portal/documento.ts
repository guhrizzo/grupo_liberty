import { maskCPFCNPJ } from '@/utils/masks'
import { validarCPF } from '@/utils/validadorCpf'

export function normalizarDocumento(value: unknown) {
  if (typeof value !== 'string' || !/^[a-zA-Z\d./\s-]+$/.test(value)) return ''
  const documento = value.replace(/[./\s-]/g, '').toUpperCase()
  if (/^\d{11}$/.test(documento)) return validarCPF(documento) ? documento : ''
  if (!/^[A-Z0-9]{12}\d{2}$/.test(documento) || /^(\d)\1+$/.test(documento)) return ''

  // Receita Federal: os caracteres da base valem seu código ASCII menos 48.
  for (const pesos of [[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2], [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]]) {
    const resto = pesos.reduce((total, peso, i) => total + peso * (documento.charCodeAt(i) - 48), 0) % 11
    if (Number(documento[pesos.length]) !== (resto < 2 ? 0 : 11 - resto)) return ''
  }
  return documento
}

export function formatarDocumento(documento: string) {
  if (documento.length === 11) return maskCPFCNPJ(documento)
  return documento.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5')
}

export function formatosDocumento(documento: string) {
  const formatos = [documento, formatarDocumento(documento)]
  return [...new Set([...formatos, ...formatos.map((valor) => valor.toLowerCase())])]
}
