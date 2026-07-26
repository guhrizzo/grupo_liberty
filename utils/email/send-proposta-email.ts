import { Resend } from 'resend'
import { renderPropostaStatusEmail } from './templates/proposta-status'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
const CC_EMAIL = 'libertycar7@gmail.com'

export interface PropostaEmailPayload {
  clienteNome: string
  clienteEmail: string
  veiculoMarca: string
  veiculoModelo: string
  valorOfertado: number | null
  status: 'aceito' | 'recusado'
}

/**
 * Envia um e-mail de notificação ao cliente quando o status de uma proposta muda.
 * Inclui CC para a equipe interna.
 * Retorna true se o e-mail foi enviado com sucesso, false caso contrário.
 * Erros de envio são registrados no console, mas não propagados para não bloquear o fluxo.
 */
export async function sendPropostaStatusEmail(payload: PropostaEmailPayload): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada. E-mail não enviado.')
    return false
  }

  const { clienteEmail, clienteNome, veiculoMarca, veiculoModelo, valorOfertado, status } = payload

  // Não tentar enviar se não há e-mail do cliente
  if (!clienteEmail || clienteEmail === 'Sem e-mail') {
    console.warn(`[Resend] Proposta sem e-mail de cliente. Notificação não enviada.`)
    return false
  }

  const resend = new Resend(RESEND_API_KEY)

  const statusLabel = status === 'aceito' ? 'Aceita ✓' : 'Recusada'
  const subject = `Sua proposta foi ${statusLabel} — ${veiculoMarca} ${veiculoModelo} | Liberty Car`

  const html = renderPropostaStatusEmail({
    clienteNome,
    veiculoMarca,
    veiculoModelo,
    valorOfertado,
    status,
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
      console.error('[Resend] Erro ao enviar e-mail de proposta:', error)
      return false
    }

    console.log(`[Resend] E-mail de proposta "${status}" enviado para ${clienteEmail}`)
    return true
  } catch (err) {
    console.error('[Resend] Exceção ao enviar e-mail de proposta:', err)
    return false
  }
}
