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

/** Placa Mercosul (ABC1D23) ou antiga (ABC-1234). */
export function maskPlate(raw: string): string {
  const cleaned = raw
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 7)
  // Se os 4º caractere é dígito, presumimos formato antigo.
  if (cleaned.length >= 4 && /\d/.test(cleaned[3])) {
    return cleaned.replace(/^([A-Z]{3})(\d{1,4})(\d{0,2}).*/, (_, a, b, c) =>
      c ? `${a}-${b}${c}` : `${a}-${b}`
    )
  }
  // Mercosul: AAA9A99
  return cleaned.replace(
    /^([A-Z]{3})(\d)([A-Z])(\d{0,2}).*/,
    (_, a, b, c, d) => `${a}${b}${c}${d}`
  )
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

/** Tabela de máscaras. */
export const MASKS = {
  cpfCnpj: maskCPFCNPJ,
  phone: maskPhone,
  plate: maskPlate,
  renavam: maskRenavam,
  money: maskMoney,
} as const

export type MaskName = keyof typeof MASKS
