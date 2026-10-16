/** Minúsculas e sem acento: "Citroën" casa com "citroen". */
export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}

const soDigitos = (t: string) => t.replace(/\D/g, '')

/**
 * Busca padrão das tabelas: cada palavra do termo precisa aparecer em algum dos
 * campos (sem acento, sem diferenciar maiúsculas). Termo numérico (CPF, com ou
 * sem pontos) também casa pelos dígitos do campo; placa casa sem o hífen.
 */
export function casaBusca(termo: string, campos: Array<string | null | undefined>): boolean {
  const palavras = normalizar(termo).split(/\s+/).filter(Boolean)
  if (palavras.length === 0) return true
  const textos = campos.filter((c): c is string => !!c).map(normalizar)
  const digitos = textos.map(soDigitos)
  const semHifen = textos.map((t) => t.replace(/[-.\s]/g, ''))
  return palavras.every((p) => {
    const pd = soDigitos(p)
    const pLimpa = p.replace(/[-.]/g, '')
    return (
      textos.some((t) => t.includes(p)) ||
      semHifen.some((t) => t.includes(pLimpa)) ||
      (pd.length >= 3 && pd.length === pLimpa.length && digitos.some((d) => d.includes(pd)))
    )
  })
}
