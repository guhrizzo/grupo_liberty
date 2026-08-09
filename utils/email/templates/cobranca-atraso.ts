interface CobrancaAtrasoData {
  clienteNome: string
  veiculoResumo: string
  numeroParcela: number
  numeroParcelas: number
  valorRestante: number
  dataVencimento: string // YYYY-MM-DD
  diasAtraso: number
}

function formatCurrencyBR(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDateBR(value: string): string {
  const d = new Date(value + 'T00:00:00')
  return new Intl.DateTimeFormat('pt-BR').format(d)
}

/** Escapa caracteres especiais de HTML — evita injeção via nome/veículo digitados. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderCobrancaAtrasoEmail(data: CobrancaAtrasoData): string {
  const clienteNome = escapeHtml(data.clienteNome)
  const veiculoResumo = escapeHtml(data.veiculoResumo)
  const { numeroParcela, numeroParcelas, valorRestante, dataVencimento, diasAtraso } = data

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Parcela em atraso — Liberty Car</title>
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
              <div style="display:inline-block;margin-bottom:20px;">
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                  <tr>
                    <td style="background-color:#dc2626;border-radius:10px;padding:10px 20px;text-align:center;">
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
                        <td style="background-color:#fff1f2;border:2px solid #fecdd3;border-radius:100px;padding:10px 28px;text-align:center;">
                          <span style="color:#dc2626;font-size:13px;font-weight:800;letter-spacing:2px;text-transform:uppercase;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
                            PARCELA EM ATRASO
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
                Identificamos que sua parcela está em atraso há
                <strong>${diasAtraso} dia${diasAtraso === 1 ? '' : 's'}</strong>. Para evitar juros, multas ou
                outros transtornos, regularize o pagamento o quanto antes.
              </p>
            </td>
          </tr>

          <!-- Divisor -->
          <tr>
            <td style="padding:0 40px;background-color:#ffffff;">
              <div style="border-top:1px solid #f0f0f0;margin:8px 0;"></div>
            </td>
          </tr>

          <!-- Detalhes da parcela -->
          <tr>
            <td style="padding:24px 40px;background-color:#ffffff;">
              <p style="margin:0 0 16px;font-size:11px;font-weight:700;color:#a1a1aa;letter-spacing:1.5px;text-transform:uppercase;">
                Detalhes do débito
              </p>

              <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                <tr>
                  <td style="background-color:#fff1f2;border:1px solid #fecdd3;border-radius:12px;padding:20px 24px;">
                    <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                      <tr>
                        <td style="padding-bottom:14px;">
                          <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Veículo</p>
                          <p style="margin:0;font-size:16px;font-weight:800;color:#09090b;">${veiculoResumo}</p>
                        </td>
                      </tr>
                      <tr>
                        <td style="border-top:1px solid #fecdd3;padding-top:14px;">
                          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
                            <tr>
                              <td width="34%" style="vertical-align:top;">
                                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Parcela</p>
                                <p style="margin:0;font-size:17px;font-weight:800;color:#09090b;">${numeroParcela}/${numeroParcelas}</p>
                              </td>
                              <td width="33%" style="vertical-align:top;">
                                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Valor em aberto</p>
                                <p style="margin:0;font-size:17px;font-weight:800;color:#dc2626;">${formatCurrencyBR(valorRestante)}</p>
                              </td>
                              <td width="33%" style="vertical-align:top;">
                                <p style="margin:0 0 4px;font-size:10px;font-weight:700;color:#a1a1aa;letter-spacing:1px;text-transform:uppercase;">Vencimento</p>
                                <p style="margin:0;font-size:17px;font-weight:800;color:#09090b;">${formatDateBR(dataVencimento)}</p>
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Chamada para ação -->
          <tr>
            <td style="padding:0 40px 32px;background-color:#ffffff;text-align:center;">
              <p style="margin:0 0 20px;font-size:14px;color:#52525b;">
                Já efetuou o pagamento? Desconsidere este e-mail. Qualquer dúvida, fale com a nossa equipe:
              </p>
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;">
                <tr>
                  <td style="background-color:#dc2626;border-radius:10px;padding:14px 32px;">
                    <a href="https://www.grupolibertycar.com.br" style="color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;letter-spacing:0.5px;">
                      Falar com a Liberty Car →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

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
                Você recebeu este e-mail porque possui um contrato ativo com a Liberty Car.
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
