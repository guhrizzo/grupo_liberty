interface PropostaEmailData {
  clienteNome: string
  veiculoMarca: string
  veiculoModelo: string
  valorOfertado: number | null
  status: 'aceito' | 'recusado'
}

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

/** Escapa caracteres especiais de HTML — evita injeção via nome/veículo digitados pelo cliente. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderPropostaStatusEmail(data: PropostaEmailData): string {
  const clienteNome = escapeHtml(data.clienteNome)
  const veiculoMarca = escapeHtml(data.veiculoMarca)
  const veiculoModelo = escapeHtml(data.veiculoModelo)
  const { valorOfertado, status } = data
  const isAceito = status === 'aceito'

  const accentColor = isAceito ? '#16a34a' : '#dc2626'
  const accentBg = isAceito ? '#f0fdf4' : '#fff1f2'
  const accentBorder = isAceito ? '#bbf7d0' : '#fecdd3'
  const statusLabel = isAceito ? 'ACEITA ✓' : 'RECUSADA ✗'
  const statusMessage = isAceito
    ? 'Ficamos felizes em informar que sua proposta foi <strong>aceita</strong>! Nossa equipe entrará em contato em breve para dar continuidade ao processo de compra.'
    : 'Informamos que sua proposta não pôde ser aceita no momento. Mas não desanime — temos outros ótimos veículos que podem ser a escolha certa para você!'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Atualização da sua proposta — Liberty Car</title>
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

        <!-- Card principal -->
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header com gradiente -->
          <tr>
            <td style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 60%,#2a2a2a 100%);padding:40px 40px 36px;text-align:center;">
              <!-- Logo / Nome da empresa -->
              <div style="display:inline-block;margin-bottom:20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="background-color:${accentColor};border-radius:10px;padding:10px 20px;text-align:center;">
                      <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">LIBERTY CAR</span>
                    </td>
                  </tr>
                </table>
              </div>
              <p style="margin:0;color:#a1a1aa;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">
                Grupo Liberty — Veículos & Negócios
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
                        <td style="background-color:${accentBg};border:2px solid ${accentBorder};border-radius:100px;padding:10px 28px;text-align:center;">
                          <span style="color:${accentColor};font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                            PROPOSTA ${statusLabel}
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
                Olá, ${clienteNome}!
              </h1>
              <p style="margin:0;font-size:15px;color:#52525b;line-height:1.7;">
                ${statusMessage}
              </p>
            </td>
          </tr>

          <!-- Divisor -->
          <tr>
            <td style="padding:0 40px;background-color:#ffffff;">
              <div style="border-top:1px solid #f0f0f0;margin:8px 0;"></div>
            </td>
          </tr>

          <!-- Detalhes da proposta -->
          <tr>
            <td style="padding:24px 40px;background-color:#ffffff;">
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;">
                Detalhes da sua proposta
              </p>

              <!-- Card do veículo -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="50%" style="vertical-align:top;padding-right:12px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Veículo</p>
                          <p style="margin:0;font-size:17px;font-weight:800;color:#09090b;">${veiculoMarca} ${veiculoModelo}</p>
                        </td>
                        <td width="50%" style="vertical-align:top;padding-left:12px;border-left:1px solid #e4e4e7;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Valor Ofertado</p>
                          <p style="margin:0;font-size:17px;font-weight:800;color:${accentColor};">
                            ${valorOfertado ? formatCurrencyBR(valorOfertado) : 'Não informado'}
                          </p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Chamada para ação -->
          ${isAceito ? `
          <tr>
            <td style="padding:0 40px 32px;background-color:#ffffff;text-align:center;">
              <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
                Aguarde o contato da nossa equipe. Se preferir, entre em contato conosco diretamente:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:${accentColor};border-radius:10px;padding:14px 32px;">
                    <a href="https://www.grupolibertycar.com.br" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      Visitar nosso site →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : `
          <tr>
            <td style="padding:0 40px 32px;background-color:#ffffff;text-align:center;">
              <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
                Confira nosso catálogo completo e encontre o veículo dos seus sonhos:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#09090b;border-radius:10px;padding:14px 32px;">
                    <a href="https://www.grupolibertycar.com.br/" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      Ver catálogo de veículos →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          `}

          <!-- Divisor -->
          <tr>
            <td style="padding:0;background-color:#ffffff;">
              <div style="border-top:1px solid #f0f0f0;"></div>
            </td>
          </tr>

          <!-- Rodapé -->
          <tr>
            <td style="background-color:#fafafa;padding:28px 40px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:700;color:#09090b;">Grupo Liberty Car</p>
              <p style="margin:0 0 4px;font-size:12px;color:#a1a1aa;">
                grupolibertycar.com.br
              </p>
              <p style="margin:12px 0 0;font-size:11px;color:#d4d4d8;line-height:1.5;">
                Este é um e-mail automático. Por favor, não responda a esta mensagem.<br/>
                Você recebeu este e-mail porque enviou uma proposta em nosso site.
              </p>
            </td>
          </tr>

        </table>
        <!-- /Card principal -->

      </td>
    </tr>
  </table>

</body>
</html>`
}
