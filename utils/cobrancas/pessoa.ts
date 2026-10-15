import { validarCPF } from '@/utils/validadorCpf'
import { onlyDigits } from '@/utils/masks'

// Dados pessoais de quem aparece numa cobrança (cliente, cônjuge e, depois,
// avalista). Compartilhado entre o formulário (client) e as server actions.

export const ESTADOS_CIVIS = [
  { value: 'solteiro', label: 'Solteiro(a)' },
  { value: 'casado', label: 'Casado(a)' },
  { value: 'divorciado', label: 'Divorciado(a)' },
  { value: 'viuvo', label: 'Viúvo(a)' },
] as const

export type EstadoCivil = (typeof ESTADOS_CIVIS)[number]['value']

export function labelEstadoCivil(valor: string | null | undefined): string {
  return ESTADOS_CIVIS.find((e) => e.value === valor)?.label ?? '—'
}

/** Pessoa como guardada no Firestore: cpf/telefone só com dígitos. */
export interface Pessoa {
  nome: string
  cpf: string
  telefone: string
  endereco: string
  estadoCivil: EstadoCivil | ''
  /** Onde trabalha (opcional). */
  trabalho: string
}

export interface ClienteCobranca extends Omit<Pessoa, 'nome'> {
  /** Obrigatório quando estadoCivil = casado. */
  conjuge: Pessoa | null
}

export function pessoaVazia(): Pessoa {
  return { nome: '', cpf: '', telefone: '', endereco: '', estadoCivil: '', trabalho: '' }
}

export function precisaConjuge(estadoCivil: string): boolean {
  return estadoCivil === 'casado'
}

function texto(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Normaliza o que veio do cliente (formulário/JSON): dígitos em cpf/telefone, textos aparados. */
export function normalizarPessoa(raw: unknown): Pessoa {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const estado = texto(r.estadoCivil)
  return {
    nome: texto(r.nome, 120),
    cpf: onlyDigits(texto(r.cpf, 20)).slice(0, 11),
    telefone: onlyDigits(texto(r.telefone, 20)).slice(0, 11),
    endereco: texto(r.endereco, 250),
    estadoCivil: ESTADOS_CIVIS.some((e) => e.value === estado) ? (estado as EstadoCivil) : '',
    trabalho: texto(r.trabalho, 120),
  }
}

export function normalizarCliente(raw: unknown): ClienteCobranca {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const { nome: _nome, ...base } = normalizarPessoa(r)
  void _nome
  const conjugeRaw = r.conjuge
  const conjuge = conjugeRaw ? normalizarPessoa(conjugeRaw) : null
  return {
    ...base,
    conjuge: precisaConjuge(base.estadoCivil) ? conjuge : null,
  }
}

interface OpcoesValidacao {
  rotulo: string
  /** nome obrigatório (false para o cliente: o nome vem em outro campo). */
  exigirNome?: boolean
  exigirEndereco?: boolean
  exigirEstadoCivil?: boolean
}

/** Retorna a mensagem do primeiro problema, ou null se a pessoa está ok. */
export function validarPessoa(p: Pessoa, o: OpcoesValidacao): string | null {
  const { rotulo } = o
  if (o.exigirNome !== false && !p.nome) return `Informe o nome ${rotulo}.`
  if (!p.cpf) return `Informe o CPF ${rotulo}.`
  if (!validarCPF(p.cpf)) return `CPF ${rotulo} inválido.`
  if (!p.telefone) return `Informe o telefone ${rotulo}.`
  if (p.telefone.length < 10) return `Telefone ${rotulo} inválido.`
  if (o.exigirEndereco !== false && !p.endereco) return `Informe o endereço ${rotulo}.`
  if (o.exigirEstadoCivil && !p.estadoCivil) return `Informe o estado civil ${rotulo}.`
  return null
}

/** Valida o cliente completo (todos os campos obrigatórios + cônjuge se casado). */
export function validarCliente(c: ClienteCobranca): string | null {
  const erroCliente = validarPessoa(
    { nome: '', ...c },
    { rotulo: 'do cliente', exigirNome: false, exigirEstadoCivil: true },
  )
  if (erroCliente) return erroCliente
  if (precisaConjuge(c.estadoCivil)) {
    if (!c.conjuge) return 'Informe os dados do cônjuge.'
    return validarPessoa(c.conjuge, { rotulo: 'do cônjuge', exigirEndereco: false })
  }
  return null
}

/** Chave de agrupamento de clientes: CPF quando existe, senão o nome. */
export function chaveCliente(nome: string, cpf: string | null | undefined): string {
  const d = onlyDigits(cpf ?? '')
  return d ? `cpf:${d}` : `nome:${nome.trim().toLowerCase()}`
}
