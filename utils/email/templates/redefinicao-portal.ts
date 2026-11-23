const assunto = 'Redefina sua senha | Liberty Car'
const titulo = 'Redefina sua senha'
const intro = 'Recebemos um pedido para redefinir a senha da sua conta na Área do Cliente Liberty.'
const seguranca = 'Se você não solicitou essa alteração, pode ignorar este e-mail. Sua senha atual continua válida.'

export const idLogoRedefinicaoPortal = 'liberty-car-logo'

export function renderEmailRedefinicaoPortal(link: string, logoSrc = `cid:${idLogoRedefinicaoPortal}`) {
  const href = link.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')

  return {
    subject: assunto,
    text: `${titulo}\n\n${intro}\n\nRedefinir senha: ${link}\n\n${seguranca}\n\nLiberty Car · Área do Cliente`,
    html: `<!doctype html>
<html lang="pt-BR">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${assunto}</title></head>
<body style="margin:0;background:#f1f5f9;color:#14243c;font-family:Arial,sans-serif">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f1f5f9">
    <tr><td align="center" style="padding:32px 16px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#ffffff;border:1px solid #e0e8f0;border-radius:16px">
        <tr><td style="padding:24px 28px;background:#101a2c;border-radius:15px 15px 0 0;color:#ffffff;font-size:20px;font-weight:bold"><img src="${logoSrc}" alt="Liberty Car" width="132" height="58" style="display:block;border:0;width:132px;height:auto;color:#ffffff"></td></tr>
        <tr><td style="padding:32px 28px">
          <p style="margin:0 0 10px;color:#006fa3;font-size:13px;font-weight:bold">Área do Cliente</p>
          <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2">${titulo}</h1>
          <p style="margin:0 0 24px;color:#445874;font-size:16px;line-height:1.55">${intro}</p>
          <table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#006fa3" style="border-radius:10px">
            <a href="${href}" style="display:inline-block;padding:14px 22px;border-radius:10px;color:#ffffff;font-size:15px;font-weight:bold;text-decoration:none">Redefinir senha</a>
          </td></tr></table>
          <p style="margin:24px 0 0;color:#445874;font-size:14px;line-height:1.55">${seguranca}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}
