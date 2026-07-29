// Máscaras de input. Recebem o valor cru digitado e devolvem a versão formatada.
// Não validam; só formatam o que o usuário digitou. Validação fica por conta do form.

/** Remove tudo que não for dígito. */
export function onlyDigits(s: string): string {
  return s.replace(/\D/g, '')
}

/** Aplica a máscara progressivamente conforme o usuário digita. */
export function maskCPFCNPJ(raw: string): string {
  const d = onlyDigits(raw).slice(0, 14)
  if (d.length <= 11) {
    // CPF: 000.000.000-00
    return d
      .replace(/^(\d{3})(\d)/, '$1.$2')
      .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1-$2')
  }
  // CNPJ: 00.000.000/0001-00
  return d
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2')
}

/** Telefone BR: (00) 0000-0000 ou (00) 00000-0000. */
export function maskPhone(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  if (d.length <= 10) {
    return d
      .replace(/^(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{4})(\d)/, '$1-$2')
  }
  return d
    .replace(/^(\d{2})(\d)/, '($1) $2')
    .replace(/(\d{5})(\d)/, '$1-$2')
}

export function maskPlate(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7)

  // Se o 5º caractere (índice 4) for uma letra, tratamos como Mercosul (ex: ABC1D23)
  if (cleaned.length >= 5 && /[A-Z]/.test(cleaned[4])) {
    return cleaned
  }

  // Se o 4º caractere (índice 3) for dígito e o 5º não for letra, formatamos com hífen (ex: ABC-1234)
  if (cleaned.length >= 4 && /\d/.test(cleaned[3])) {
    return cleaned.replace(/^([A-Z]{3})(\d{1,4})/, '$1-$2')
  }

  return cleaned
}

/** Renavam: 11 dígitos, exibe como 000000000-00. */
export function maskRenavam(raw: string): string {
  const d = onlyDigits(raw).slice(0, 11)
  return d.replace(/^(\d{9})(\d)/, '$1-$2')
}

/** Moeda BR: 1.234.567,89 (entrada como string de dígitos). */
export function maskMoney(raw: string): string {
  const d = onlyDigits(raw).slice(0, 15)
  if (!d) return ''
  const cents = d.padStart(3, '0')
  const reais = cents.slice(0, -2).replace(/^0+(?=\d)/, '') || '0'
  const centsPart = cents.slice(-2)
  const reaisFmt = reais.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  return `${reaisFmt},${centsPart}`
}

/** Converte valor formatado por maskMoney em número (0 se vazio/inválido). */
export function parseMoney(formatted: string): number {
  const cleaned = formatted.replace(/\./g, '').replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

/**
 * Formata um número (ou string numérica) em string de moeda pronta para o input
 * monetário. Diferente de `maskMoney`, esta função recebe um VALOR e produz a
 * representação pt-BR — útil para popular inputs ao editar.
 *
 * @example moneyFromNumber(122)   // "R$ 122,00"
 * @example moneyFromNumber(1.5)   // "R$ 1,50"
 * @example moneyFromNumber(0)     // ""
 */
export function moneyFromNumber(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === '') return ''
  const n = typeof value === 'number' ? value : Number(String(value).replace(',', '.'))
  if (!Number.isFinite(n) || n <= 0) return ''
  return maskMoney(String(n).replace('.', ','))
}

/** Tabela de máscaras. */
export const MASKS = {
  cpfCnpj: maskCPFCNPJ,
  phone: maskPhone,
  plate: maskPlate,
  renavam: maskRenavam,
  money: maskMoney,
} as const

export type MaskName = keyof typeof MASKS
