/**
 * Validação matemática oficial de CPF.
 * Retorna true se for válido, false caso contrário.
 */
export function validarCPF(cpf: string): boolean {
  const cleanCpf = cpf.replace(/\D/g, '')

  if (cleanCpf.length !== 11) return false

  // Elimina CPFs conhecidos inválidos
  if (/^(\d)\1{10}$/.test(cleanCpf)) return false

  // Valida 1º dígito
  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cleanCpf.charAt(9))) return false

  // Valida 2º dígito
  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCpf.charAt(i)) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cleanCpf.charAt(10))) return false

  return true
}
