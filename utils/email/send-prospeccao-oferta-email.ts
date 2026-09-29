import { Resend } from 'resend'
import { renderProspeccaoOfertaEmail } from './templates/prospeccao-oferta'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
const CC_EMAIL = 'libertycar7@gmail.com'
const WHATSAPP_URL = 'https://wa.me/5514998659046'

export interface ProspeccaoOfertaEmailPayload {
  para: string
  assunto: string
  mensagem: string
  veiculo: string
  valorOferta: number
}

/**
 * Envia a oferta pelo veículo a um executado da prospecção (aba Jurídico).
 * Cópia para a equipe e resposta direcionada a ela (o remetente é noreply).
 * Diferente dos outros envios, devolve o motivo da falha: aqui o envio é
 * a ação principal que o usuário pediu, então o erro precisa aparecer na tela.
 */
export async function sendProspeccaoOfertaEmail(
  payload: ProspeccaoOfertaEmailPayload,
): Promise<{ ok: true } | { ok: false; erro: string }> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada. E-mail não enviado.')
    return { ok: false, erro: 'Envio de e-mail não configurado no servidor.' }
  }

  const resend = new Resend(RESEND_API_KEY)
  const html = renderProspeccaoOfertaEmail({
    mensagem: payload.mensagem,
    veiculo: payload.veiculo,
    valorOferta: payload.valorOferta,
    whatsappUrl: WHATSAPP_URL,
  })

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: payload.para,
      cc: CC_EMAIL,
      replyTo: CC_EMAIL,
      subject: payload.assunto,
      html,
      text: payload.mensagem,
    })
    if (error) {
      console.error('[Resend] Erro ao enviar oferta da prospecção:', error)
      return { ok: false, erro: error.message || 'O provedor de e-mail recusou o envio.' }
    }
    return { ok: true }
  } catch (err) {
    console.error('[Resend] Exceção ao enviar oferta da prospecção:', err)
    return { ok: false, erro: 'Falha ao contatar o provedor de e-mail.' }
  }
}
