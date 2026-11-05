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
  const res = await fetch(`${baseUrl()}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      access_token: key,
      'User-Agent': 'grupo-liberty',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
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
  /** Percentual da reserva sobre o valor líquido; 0 = sem split. */
  reservaPct: number
}): Promise<AsaasPayment> {
  const walletId = process.env.ASAAS_RESERVA_WALLET_ID
  const split =
    params.reservaPct > 0 && walletId
      ? [{ walletId, percentualValue: params.reservaPct }]
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
