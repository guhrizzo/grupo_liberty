import { Resend } from 'resend'
import { renderAnuncioStatusEmail } from './templates/anuncio-status'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const FROM_EMAIL = 'Liberty Car <noreply@grupolibertycar.com.br>'
const CC_EMAIL = 'libertycar7@gmail.com'

export interface AnuncioEmailPayload {
  nome: string
  email: string
  marca: string
  modelo: string
  ano?: number | null
  precoDesejado?: number | null
  status: 'recusado' | 'publicado' | 'no_estoque'
  motivoRecusa?: string | null
  /** Link do veículo no site — só faz sentido em `publicado`. */
  veiculoUrl?: string | null
}

const ASSUNTO: Record<AnuncioEmailPayload['status'], (v: string) => string> = {
  recusado: (v) => `Sobre o seu anúncio — ${v} | Liberty Car`,
  publicado: (v) => `Seu veículo foi publicado — ${v} | Liberty Car`,
  no_estoque: (v) => `Recebemos o seu veículo — ${v} | Liberty Car`,
}

/**
 * Notifica o anunciante quando a equipe decide sobre o anúncio dele.
 * CC para a equipe interna. Nunca lança — loga e devolve `false` — para não
 * bloquear o fluxo de triagem.
 */
export async function sendAnuncioStatusEmail(
  payload: AnuncioEmailPayload,
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[Resend] RESEND_API_KEY não configurada. E-mail de anúncio não enviado.')
    return false
  }

  const { nome, email, marca, modelo, ano, precoDesejado, status, motivoRecusa, veiculoUrl } =
    payload

  if (!email || !email.includes('@')) {
    console.warn('[Resend] Anúncio sem e-mail válido do anunciante. Notificação não enviada.')
    return false
  }

  const resend = new Resend(RESEND_API_KEY)
  const veiculoLabel = `${marca} ${modelo}`.trim()
  const subject = ASSUNTO[status](veiculoLabel)

  const html = renderAnuncioStatusEmail({
    nome,
    marca,
    modelo,
    ano,
    precoDesejado,
    status,
    motivoRecusa,
    veiculoUrl,
  })

  try {
    const { error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: email,
      cc: CC_EMAIL,
      subject,
      html,
    })

    if (error) {
      console.error('[Resend] Erro ao enviar e-mail de anúncio:', error)
      return false
    }

    console.log(`[Resend] E-mail de anúncio "${status}" enviado para ${email}`)
    return true
  } catch (err) {
    console.error('[Resend] Exceção ao enviar e-mail de anúncio:', err)
    return false
  }
}
