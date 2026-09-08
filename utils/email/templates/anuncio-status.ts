interface AnuncioEmailData {
  nome: string
  marca: string
  modelo: string
  ano?: number | null
  precoDesejado?: number | null
  status: 'recusado' | 'publicado' | 'no_estoque'
  motivoRecusa?: string | null
  /** Link do veículo no site — só quando `status === 'publicado'`. */
  veiculoUrl?: string | null
}

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** Escapa caracteres especiais de HTML — evita injeção via texto digitado pelo anunciante. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const SITE_URL = 'https://www.grupolibertycar.com.br'

export function renderAnuncioStatusEmail(data: AnuncioEmailData): string {
  const nome = escapeHtml(data.nome)
  const veiculo = escapeHtml(`${data.marca} ${data.modelo}`.trim())
  const { status, precoDesejado } = data
  const motivoRecusa = data.motivoRecusa ? escapeHtml(data.motivoRecusa) : null
  const veiculoUrl =
    status === 'publicado' && data.veiculoUrl ? data.veiculoUrl : `${SITE_URL}/`

  const config = {
    recusado: {
      accentColor: '#dc2626',
      accentBg: '#fff1f2',
      accentBorder: '#fecdd3',
      statusLabel: 'ANÚNCIO NÃO APROVADO',
      message:
        'Agradecemos o seu interesse, mas não seguiremos com este anúncio no momento. Isso não impede um novo contato no futuro.',
      ctaText: 'Ver veículos à venda →',
      ctaBg: '#09090b',
      ctaHref: `${SITE_URL}/`,
    },
    publicado: {
      accentColor: '#16a34a',
      accentBg: '#f0fdf4',
      accentBorder: '#bbf7d0',
      statusLabel: 'VEÍCULO PUBLICADO ✓',
      message:
        'Boa notícia! O seu veículo já está publicado no nosso site. Nossa equipe entrará em contato para alinhar os próximos passos da venda.',
      ctaText: 'Ver anúncio no site →',
      ctaBg: '#16a34a',
      ctaHref: veiculoUrl,
    },
    no_estoque: {
      accentColor: '#0284c7',
      accentBg: '#f0f9ff',
      accentBorder: '#bae6fd',
      statusLabel: 'VEÍCULO ACEITO ✓',
      message:
        'Recebemos e aceitamos o seu veículo. Ele já está registrado no nosso sistema e nossa equipe entrará em contato em breve para combinar os próximos passos.',
      ctaText: 'Visitar nosso site →',
      ctaBg: '#0284c7',
      ctaHref: `${SITE_URL}/`,
    },
  }[status]

  const precoBloco =
    precoDesejado && precoDesejado > 0
      ? `<td width="50%" style="vertical-align:top;padding-left:12px;border-left:1px solid #e4e4e7;">
            <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Preço pretendido</p>
            <p style="margin:0;font-size:17px;font-weight:800;color:${config.accentColor};">${formatCurrencyBR(precoDesejado)}</p>
          </td>`
      : ''

  const motivoBloco = motivoRecusa
    ? `<tr>
        <td style="padding:0 40px 8px;background-color:#ffffff;">
          <p style="margin:0 0 6px;font-size:11px;font-weight:700;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;">Observação da equipe</p>
          <p style="margin:0;font-size:14px;color:#52525b;line-height:1.7;background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:16px 20px;white-space:pre-line;">${motivoRecusa}</p>
        </td>
      </tr>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atualização do seu anúncio — Liberty Car</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">

  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">

        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 60%,#2a2a2a 100%);padding:40px 40px 36px;text-align:center;">
              <div style="display:inline-block;margin-bottom:20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="background-color:${config.accentColor};border-radius:10px;padding:10px 20px;text-align:center;">
                      <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">LIBERTY CAR</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:0;color:#a1a1aa;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">
                Grupo Liberty — Veículos &amp; Negócios
              </p>
            </td>
          </tr>

          <!-- Badge de status -->
          <tr>
            <td style="padding:0 40px;background-color:#ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td align="center" style="padding:32px 0 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                      <tr>
                        <td style="background-color:${config.accentBg};border:2px solid ${config.accentBorder};border-radius:100px;padding:10px 28px;text-align:center;">
                          <span style="color:${config.accentColor};font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">
                            ${config.statusLabel}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Saudação -->
          <tr>
            <td style="padding:0 40px 24px;background-color:#ffffff;">
              <h1 style="margin:0 0 12px;font-size:26px;font-weight:800;color:#09090b;line-height:1.2;">
                Olá, ${nome}!
              </h1>
              <p style="margin:0;font-size:15px;color:#52525b;line-height:1.7;">
                ${config.message}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px;background-color:#ffffff;">
              <div style="border-top:1px solid #f0f0f0;margin:8px 0;"></div>
            </td>
          </tr>

          <!-- Detalhes do veículo -->
          <tr>
            <td style="padding:24px 40px;background-color:#ffffff;">
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;">
                Veículo anunciado
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="50%" style="vertical-align:top;padding-right:12px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Veículo</p>
                          <p style="margin:0;font-size:17px;font-weight:800;color:#09090b;">${veiculo}${
                            data.ano ? ` <span style="font-weight:600;color:#71717a;">${data.ano}</span>` : ''
                          }</p>
                        </td>
                        ${precoBloco}
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${motivoBloco}

          <!-- CTA -->
          <tr>
            <td style="padding:16px 40px 32px;background-color:#ffffff;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${config.ctaBg};border-radius:10px;padding:14px 32px;">
                    <a href="${config.ctaHref}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      ${config.ctaText}
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0;background-color:#ffffff;">
              <div style="border-top:1px solid #f0f0f0;"></div>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color:#fafafa;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#09090b;">Grupo Liberty Car</p>
              <p style="margin:0 0 4px;font-size:12px;color:#a1a1aa;">grupolibertycar.com.br</p>
              <p style="margin:12px 0 0;font-size:11px;color:#d4d4d8;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda a esta mensagem.<br/>
                Você recebeu este e-mail porque anunciou um veículo em nosso site.
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`
}
