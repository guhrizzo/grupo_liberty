import { createElement } from 'react'
import { Resend } from 'resend'
import { renderToBuffer } from '@react-pdf/renderer'
import {
  renderComprovantePagamentoEmail,
  type ComprovantePagamentoData,
} from './templates/comprovante-pagamento'
import ReciboPagamentoDocument from '@/app/dashboard/cobrancas/pdf/ReciboPagamentoDocument'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
const CC_EMAIL = 'libertycar7@gmail.com'

export interface ComprovantePagamentoEmailPayload extends ComprovantePagamentoData {
  clienteNome: string
  clienteEmail: string
}

/**
 * Envia ao cliente o comprovante de um pagamento de parcela: e-mail HTML +
 * recibo em PDF anexo. Best-effort — erros são logados, nunca propagados, e a
 * função retorna `false` (o pagamento nunca deve ser desfeito por causa disso).
 */
export async function sendComprovantePagamentoEmail(
  payload: ComprovantePagamentoEmailPayload,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada. Comprovante não enviado.')
    return false
  }

  const { clienteEmail, quitada, referencia } = payload

  if (!clienteEmail) {
    console.warn('[Resend] Sem e-mail de cliente. Comprovante não enviado.')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)

  const subject = quitada
    ? 'Comprovante de quitação da parcela — Liberty Car'
    : 'Comprovante de pagamento parcial — Liberty Car'

  const html = renderComprovantePagamentoEmail(payload)

  try {
    const element = createElement(ReciboPagamentoDocument, {
      ...payload,
      emitidoEm: new Date().toISOString(),
    })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any)

    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: clienteEmail,
      cc: CC_EMAIL,
      subject,
      html,
      attachments: [
        {
          filename: `comprovante-${referencia}.pdf`,
          content: Buffer.from(pdfBuffer).toString('base64'),
        },
      ],
    })

    if (error) {
      console.error('[Resend] Erro ao enviar comprovante de pagamento:', error)
      return false
    }

    console.log(`[Resend] Comprovante de pagamento enviado para ${clienteEmail}`)
    return true
  } catch (err) {
    console.error('[Resend] Exceção ao enviar comprovante de pagamento:', err)
    return false
  }
}
