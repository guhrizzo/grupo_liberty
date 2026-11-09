import 'server-only'

// Cliente mínimo da API v3 do Asaas. Docs: https://docs.asaas.com
// Variáveis de ambiente:
//   ASAAS_API_KEY            chave da conta (sandbox ou produção)
//   ASAAS_ENV                'production' para produção; qualquer outro valor = sandbox
//   ASAAS_RESERVA_WALLET_ID  walletId da conta de reserva (destino do split)
//   ASAAS_WEBHOOK_TOKEN      token que o Asaas envia no header `asaas-access-token`
//   ASAAS_CARTAO_HABILITADO  'true' libera cobrança no cartão com split (pendente de
//                            confirmação do suporte do Asaas — ver docs/asaas-reserva.md)

export type AsaasBillingType = 'PIX' | 'BOLETO' | 'CREDIT_CARD'

export function asaasConfigurado(): boolean {
  return Boolean(process.env.ASAAS_API_KEY && process.env.ASAAS_RESERVA_WALLET_ID)
}

export function asaasCartaoHabilitado(): boolean {
  return process.env.ASAAS_CARTAO_HABILITADO === 'true'
}

function baseUrl(): string {
  return process.env.ASAAS_ENV === 'production'
    ? 'https://api.asaas.com/v3'
    : 'https://api-sandbox.asaas.com/v3'
}

export class AsaasError extends Error {
  constructor(
    message: string,
    public status: number,
    public codigo?: string,
  ) {
    super(message)
  }
}

async function chamar<T>(method: string, path: string, body?: unknown): Promise<T> {
  const key = process.env.ASAAS_API_KEY
  if (!key) throw new AsaasError('ASAAS_API_KEY não configurada.', 500)
  const multipart = body instanceof FormData
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      // Em multipart o fetch define o Content-Type (com o boundary) sozinho.
      ...(multipart ? {} : { 'Content-Type': 'application/json' }),
      access_token: key,
      'User-Agent': 'grupo-liberty',
    },
    body: body === undefined ? undefined : multipart ? body : JSON.stringify(body),
    cache: 'no-store',
  })
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>
  if (!res.ok) {
    const erro = (json.errors as { code?: string; description?: string }[] | undefined)?.[0]
    throw new AsaasError(erro?.description ?? `Asaas respondeu ${res.status}.`, res.status, erro?.code)
  }
  return json as T
}

export interface AsaasSplitItem {
  id?: string
  walletId: string
  percentualValue?: number
  fixedValue?: number
  totalValue?: number
  status?: string
}

export interface AsaasPayment {
  id: string
  customer: string
  value: number
  netValue?: number
  billingType: AsaasBillingType | 'UNDEFINED'
  status: string
  dueDate: string
  invoiceUrl?: string
  bankSlipUrl?: string
  externalReference?: string
  split?: AsaasSplitItem[]
}

export async function buscarOuCriarCliente(params: {
  nome: string
  cpfCnpj: string
  email?: string | null
  telefone?: string | null
}): Promise<string> {
  const achados = await chamar<{ data: { id: string }[] }>(
    'GET',
    `/customers?cpfCnpj=${encodeURIComponent(params.cpfCnpj)}&limit=1`,
  )
  if (achados.data[0]) return achados.data[0].id
  const criado = await chamar<{ id: string }>('POST', '/customers', {
    name: params.nome,
    cpfCnpj: params.cpfCnpj,
    email: params.email || undefined,
    mobilePhone: params.telefone || undefined,
    notificationDisabled: true,
  })
  return criado.id
}

export async function criarCobranca(params: {
  customer: string
  billingType: AsaasBillingType
  value: number
  dueDate: string
  description: string
  externalReference: string
  /** Percentual da reserva sobre o valor BRUTO da cobrança; 0 = sem split. */
  reservaPct: number
}): Promise<AsaasPayment> {
  const walletId = process.env.ASAAS_RESERVA_WALLET_ID
  // Valor fixo calculado sobre o bruto (o percentualValue do Asaas incide sobre o líquido).
  const reserva = Math.round(params.value * params.reservaPct) / 100
  const split =
    params.reservaPct > 0 && walletId && reserva > 0
      ? [{ walletId, fixedValue: reserva }]
      : undefined
  return chamar<AsaasPayment>('POST', '/payments', {
    customer: params.customer,
    billingType: params.billingType,
    value: params.value,
    dueDate: params.dueDate,
    description: params.description,
    externalReference: params.externalReference,
    split,
  })
}

export function buscarCobranca(id: string): Promise<AsaasPayment> {
  return chamar<AsaasPayment>('GET', `/payments/${encodeURIComponent(id)}`)
}

export function excluirCobranca(id: string): Promise<{ deleted: boolean }> {
  return chamar('DELETE', `/payments/${encodeURIComponent(id)}`)
}

// ───────────────────────── Negativação (Serasa) ─────────────────────────
// Docs: https://docs.asaas.com/reference/criar-uma-negativacao
// A conta precisa estar habilitada para negativações via API (solicitar ao gerente de contas).

export type AsaasDunningStatus =
  | 'PENDING'
  | 'AWAITING_APPROVAL'
  | 'AWAITING_CANCELLATION'
  | 'PROCESSED'
  | 'PAID'
  | 'PARTIALLY_PAID'
  | 'DENIED'
  | 'CANCELLED'

export interface AsaasDunning {
  id: string
  dunningNumber?: number
  status: AsaasDunningStatus
  type?: string
  requestDate?: string
  description?: string
  value?: number
  feeValue?: number
  netValue?: number
  denialReason?: string | null
  canBeCancelled?: boolean
  cannotBeCancelledReason?: string | null
  isNecessaryResendDocumentation?: boolean
  payment?: string
}

export interface AsaasDunningSimulacao {
  permitido: boolean
  motivo: string | null
  valor: number | null
  taxa: number | null
  liquido: number | null
}

/** Dados exigidos pelo Asaas para negativar (todos strings; ver docs). */
export interface AsaasDunningDados {
  payment: string
  description?: string
  customerName: string
  customerCpfCnpj: string
  customerPrimaryPhone: string
  customerSecondaryPhone?: string
  customerPostalCode: string
  customerAddress: string
  customerAddressNumber: string
  customerComplement?: string
  customerProvince: string
}

function acharComIsAllowed(node: unknown): Record<string, unknown> | null {
  if (!node || typeof node !== 'object') return null
  const obj = node as Record<string, unknown>
  if ('isAllowed' in obj) return obj
  for (const v of Object.values(obj)) {
    const r = acharComIsAllowed(v)
    if (r) return r
  }
  return null
}

const num = (v: unknown): number | null => (typeof v === 'number' ? v : null)

/** Valida se a cobrança pode ser negativada, sem criar nada. */
export async function simularNegativacao(paymentId: string): Promise<AsaasDunningSimulacao> {
  const json = await chamar<Record<string, unknown>>(
    'POST',
    `/paymentDunnings/simulate?payment=${encodeURIComponent(paymentId)}`,
    {},
  )
  const item = acharComIsAllowed(json) ?? {}
  return {
    permitido: item.isAllowed === true,
    motivo: typeof item.notAllowedReason === 'string' ? item.notAllowedReason : null,
    valor: num(item.value) ?? num(json.value),
    taxa: num(item.feeValue) ?? num(json.feeValue),
    liquido: num(item.netValue) ?? num(json.netValue),
  }
}

export async function criarNegativacao(dados: AsaasDunningDados, documento: File): Promise<AsaasDunning> {
  const form = new FormData()
  form.append('type', 'CREDIT_BUREAU')
  for (const [k, v] of Object.entries(dados)) {
    if (v) form.append(k, v)
  }
  form.append('documents', documento, documento.name)
  return chamar<AsaasDunning>('POST', '/paymentDunnings', form)
}

export async function listarNegativacoesDaCobranca(paymentId: string): Promise<AsaasDunning[]> {
  const r = await chamar<{ data: AsaasDunning[] }>(
    'GET',
    `/paymentDunnings?payment=${encodeURIComponent(paymentId)}&limit=10`,
  )
  return r.data ?? []
}

export function cancelarNegativacao(id: string): Promise<AsaasDunning> {
  return chamar<AsaasDunning>('POST', `/paymentDunnings/${encodeURIComponent(id)}/cancel`, {})
}

export function reenviarDocumentoNegativacao(id: string, documento: File): Promise<AsaasDunning> {
  const form = new FormData()
  form.append('documents', documento, documento.name)
  return chamar<AsaasDunning>('POST', `/paymentDunnings/${encodeURIComponent(id)}/documents`, form)
}
