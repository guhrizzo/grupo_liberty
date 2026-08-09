import { Resend } from 'resend'
import { renderCobrancaAtrasoEmail } from './templates/cobranca-atraso'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
const CC_EMAIL = 'libertycar7@gmail.com'

export interface CobrancaAtrasoEmailPayload {
  clienteNome: string
  clienteEmail: string
  veiculoResumo: string
  numeroParcela: number
  numeroParcelas: number
  valorRestante: number
  dataVencimento: string
  diasAtraso: number
}

/**
 * Envia o e-mail de cobrança em atraso ao cliente ("avisar quando atrasar").
 * Erros de envio são registrados no console, mas não propagados — não deve
 * derrubar o job do cron.
 */
export async function sendCobrancaAtrasoEmail(
  payload: CobrancaAtrasoEmailPayload,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada. Aviso de atraso não enviado.')
    return false
  }

  const {
    clienteEmail,
    clienteNome,
    veiculoResumo,
    numeroParcela,
    numeroParcelas,
    valorRestante,
    dataVencimento,
    diasAtraso,
  } = payload

  if (!clienteEmail) {
    console.warn('[Resend] Cobrança sem e-mail de cliente. Aviso de atraso não enviado.')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)

  const subject = `Parcela em atraso há ${diasAtraso} dia${diasAtraso === 1 ? '' : 's'} — Liberty Car`

  const html = renderCobrancaAtrasoEmail({
    clienteNome,
    veiculoResumo,
    numeroParcela,
    numeroParcelas,
    valorRestante,
    dataVencimento,
    diasAtraso,
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
      console.error('[Resend] Erro ao enviar aviso de atraso:', error)
      return false
    }

    console.log(`[Resend] Aviso de atraso enviado para ${clienteEmail}`)
    return true
  } catch (err) {
    console.error('[Resend] Exceção ao enviar aviso de atraso:', err)
    return false
  }
}
