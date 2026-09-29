interface ProspeccaoOfertaEmailData {
  /** Texto escrito pela equipe no modal (texto puro; quebras de linha viram parágrafos). */
  mensagem: string
  veiculo: string
  valorOferta: number
  whatsappUrl: string
}

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

/** Escapa caracteres especiais de HTML — a mensagem é digitada livremente. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function paragrafos(texto: string): string {
  return texto
    .trim()
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p style="margin:0 0 14px;font-size:15px;color:#3f3f46;line-height:1.7;">${escapeHtml(p.trim()).replace(/\n/g, '<br />')}</p>`,
    )
    .join('\n')
}

export function renderProspeccaoOfertaEmail(data: ProspeccaoOfertaEmailData): string {
  const veiculo = escapeHtml(data.veiculo)
  const valor = formatCurrencyBR(data.valorOferta)

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Proposta para o seu veículo — Liberty Car</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:#f4f4f5;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <tr>
            <td style="background:linear-gradient(135deg,#0f0f0f 0%,#1a1a1a 60%,#2a2a2a 100%);padding:36px 40px 32px;text-align:center;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto 16px;">
                <tr>
                  <td style="background-color:#16a34a;border-radius:10px;padding:10px 20px;text-align:center;">
                    <span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:2px;text-transform:uppercase;">LIBERTY CAR</span>
                  </td>
                </tr>
              </table>
              <p style="margin:0;color:#a1a1aa;font-size:13px;letter-spacing:1px;text-transform:uppercase;font-weight:500;">
                Grupo Liberty — Veículos &amp; Negócios
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding:32px 40px 8px;background-color:#ffffff;">
              ${paragrafos(data.mensagem)}
            </td>
          </tr>

          <tr>
            <td style="padding:8px 40px 24px;background-color:#ffffff;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#fafafa;border:1px solid #e4e4e7;border-radius:12px;padding:20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td width="55%" style="vertical-align:top;padding-right:12px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Veículo</p>
                          <p style="margin:0;font-size:15px;font-weight:800;color:#09090b;">${veiculo}</p>
                        </td>
                        <td width="45%" style="vertical-align:top;padding-left:12px;border-left:1px solid #e4e4e7;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Nossa oferta</p>
                          <p style="margin:0;font-size:20px;font-weight:800;color:#16a34a;">${valor}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:0 40px 32px;background-color:#ffffff;text-align:center;">
              <p style="margin:0 0 16px;font-size:14px;color:#52525b;">
                Ficou com alguma dúvida? Responda este e-mail ou fale com a gente:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#16a34a;border-radius:10px;padding:14px 32px;">
                    <a href="${escapeHtml(data.whatsappUrl)}" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      Conversar no WhatsApp →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 40px;background-color:#fafafa;border-top:1px solid #f0f0f0;text-align:center;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;line-height:1.6;">
                Liberty Car · <a href="https://www.grupolibertycar.com.br" style="color:#71717a;">grupolibertycar.com.br</a><br />
                Valor sujeito a vistoria do veículo e análise da documentação.
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
