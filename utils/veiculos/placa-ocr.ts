// Acha uma placa brasileira num texto lido de foto (hoje, a resposta da IA em
// utils/veiculos/ler-placa-ia.ts — que às vezes vem com traço ou texto a mais).
//
// Formatos: antiga ABC1234 e Mercosul ABC1D23 — 3 letras, 1 dígito, letra ou
// dígito, 2 dígitos. O OCR confunde letra com número (O/0, I/1, S/5, B/8…),
// então cada posição é corrigida para o tipo que ela exige.

const PARA_LETRA: Record<string, string> = { '0': 'O', '1': 'I', '2': 'Z', '4': 'A', '5': 'S', '6': 'G', '7': 'T', '8': 'B' }
const PARA_DIGITO: Record<string, string> = { O: '0', Q: '0', D: '0', U: '0', I: '1', L: '1', T: '1', Z: '2', A: '4', S: '5', G: '6', B: '8' }

const PLACA_REGEX = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/
const MAX_TROCAS = 2

/** Tenta encaixar 7 caracteres no formato de placa, corrigindo confusões. */
function corrigir(trecho: string): string | null {
  const c = trecho.split('')
  for (const i of [0, 1, 2]) c[i] = PARA_LETRA[c[i]] ?? c[i]
  for (const i of [3, 5, 6]) c[i] = PARA_DIGITO[c[i]] ?? c[i]
  const placa = c.join('')
  return PLACA_REGEX.test(placa) ? placa : null
}

/**
 * Devolve a placa mais provável do texto, ou `null`. Dá preferência a linhas
 * com exatamente 7 caracteres (a placa costuma vir sozinha numa linha) e,
 * dentro de cada linha, ao trecho que precisou de menos correções.
 */
export function extrairPlaca(texto: string): string | null {
  const linhas = texto
    .toUpperCase()
    .split(/\n+/)
    .map((l) => l.replace(/[^A-Z0-9]/g, ''))
    .filter((l) => l.length >= 7)
    .sort((a, b) => Math.abs(a.length - 7) - Math.abs(b.length - 7))

  for (const linha of linhas) {
    let melhor: { placa: string; trocas: number } | null = null
    for (let i = 0; i + 7 <= linha.length; i++) {
      const trecho = linha.slice(i, i + 7)
      const placa = corrigir(trecho)
      if (!placa) continue
      const trocas = placa.split('').filter((ch, j) => ch !== trecho[j]).length
      // Muitas trocas = provavelmente não é placa (palavra qualquer na foto).
      if (trocas > MAX_TROCAS) continue
      if (!melhor || trocas < melhor.trocas) melhor = { placa, trocas }
    }
    if (melhor) return melhor.placa
  }
  return null
}
