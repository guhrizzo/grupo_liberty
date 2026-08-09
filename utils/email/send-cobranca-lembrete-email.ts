import { Resend } from 'resend'
import { renderCobrancaLembreteEmail } from './templates/cobranca-lembrete'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
const CC_EMAIL = 'libertycar7@gmail.com'

export interface CobrancaLembreteEmailPayload {
  clienteNome: string
  clienteEmail: string
  veiculoResumo: string
  numeroParcela: number
  numeroParcelas: number
  valorParcela: number
  dataVencimento: string
  diasRestantes: number
}

/**
 * Envia o e-mail de lembrete de vencimento ("cobrar quando faltar X dias")
 * para o cliente de uma cobrança. Erros de envio são registrados no
 * console, mas não propagados — não deve derrubar o job do cron.
 */
export async function sendCobrancaLembreteEmail(
  payload: CobrancaLembreteEmailPayload,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada. Lembrete não enviado.')
    return false
  }

  const { clienteEmail, clienteNome, veiculoResumo, numeroParcela, numeroParcelas, valorParcela, dataVencimento, diasRestantes } =
    payload

  if (!clienteEmail) {
    console.warn('[Resend] Cobrança sem e-mail de cliente. Lembrete não enviado.')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)

  const subject =
    diasRestantes <= 0
      ? `Sua parcela vence hoje — Liberty Car`
      : `Faltam ${diasRestantes} dia${diasRestantes === 1 ? '' : 's'} para o vencimento — Liberty Car`

  const html = renderCobrancaLembreteEmail({
    clienteNome,
    veiculoResumo,
    numeroParcela,
    numeroParcelas,
    valorParcela,
    dataVencimento,
    diasRestantes,
  })

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: clienteEmail,
      cc: CC_EMAIL,
      subject,
      html,
    })

    if (error) {
      console.error('[Resend] Erro ao enviar lembrete de cobrança:', error)
      return false
    }

    console.log(`[Resend] Lembrete de cobrança enviado para ${clienteEmail}`)
    return true
  } catch (err) {
    console.error('[Resend] Exceção ao enviar lembrete de cobrança:', err)
    return false
  }
}
