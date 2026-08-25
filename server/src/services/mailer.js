import nodemailer from 'nodemailer';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`SMTP no esta configurado: falta ${name}.`);
  }
  return value;
}

function createTransporter() {
  return nodemailer.createTransport({
    host: required('SMTP_HOST'),
    port: Number(process.env.SMTP_PORT || 587),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: required('SMTP_USER'),
      pass: required('SMTP_PASS'),
    },
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function notificationTone(title = '') {
  const lower = title.toLowerCase();
  if (lower.includes('actualizacion') || lower.includes('actualización')) {
    return {
      label: 'Solicitud de actualizacion',
      color: '#8a5a00',
      bg: '#fff4d8',
      icon: '!',
    };
  }
  if (lower.includes('archivo')) {
    return {
      label: 'Archivo actualizado',
      color: '#075c3b',
      bg: '#e8f5ee',
      icon: '↑',
    };
  }
  return {
    label: 'Flujo documental',
    color: '#075c3b',
    bg: '#e8f5ee',
    icon: '✓',
  };
}

function buildDocumentUrl(docId) {
  const base = process.env.APP_URL || process.env.PUBLIC_APP_URL;
  if (!base || !docId) return null;
  return `${base.replace(/\/+$/, '')}/documentos/${docId}`;
}

function buildHtmlTemplate({ name, title, message, docNumber, docId }) {
  const safeName = escapeHtml(name || 'Usuario');
  const safeTitle = escapeHtml(title);
  const safeMessage = escapeHtml(message);
  const safeDocNumber = escapeHtml(docNumber);
  const tone = notificationTone(title);
  const documentUrl = buildDocumentUrl(docId);

  return `<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${safeTitle}</title>
  </head>
  <body style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#122019;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;margin:0;padding:32px 12px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe5df;border-radius:18px;overflow:hidden;box-shadow:0 14px 36px rgba(11,48,31,.08);">
            <tr>
              <td style="background:#075c3b;padding:24px 28px;">
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                  <tr>
                    <td>
                      <div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#bfe8d0;font-weight:700;">Acervo Operaciones</div>
                      <div style="font-size:24px;line-height:1.25;color:#ffffff;font-weight:800;margin-top:8px;">${safeTitle}</div>
                    </td>
                    <td align="right" style="width:64px;">
                      <div style="width:48px;height:48px;border-radius:14px;background:#ffffff;color:#075c3b;font-size:22px;font-weight:800;line-height:48px;text-align:center;">A</div>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td style="padding:28px;">
                <div style="display:inline-block;background:${tone.bg};color:${tone.color};border-radius:999px;padding:7px 12px;font-size:12px;font-weight:700;">
                  <span style="display:inline-block;margin-right:6px;">${tone.icon}</span>${escapeHtml(tone.label)}
                </div>
                <p style="font-size:16px;line-height:1.6;margin:22px 0 0;">Hola <strong>${safeName}</strong>,</p>
                <p style="font-size:15px;line-height:1.7;color:#33443b;margin:14px 0 0;">${safeMessage}</p>

                ${docNumber ? `
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:24px;background:#f6faf7;border:1px solid #dce8e1;border-radius:14px;">
                    <tr>
                      <td style="padding:18px 20px;">
                        <div style="font-size:12px;color:#66756d;text-transform:uppercase;letter-spacing:.08em;font-weight:700;">Documento</div>
                        <div style="font-size:22px;line-height:1.3;color:#075c3b;font-weight:800;margin-top:6px;">${safeDocNumber}</div>
                      </td>
                    </tr>
                  </table>
                ` : ''}

                ${documentUrl ? `
                  <div style="margin-top:28px;">
                    <a href="${escapeHtml(documentUrl)}" style="display:inline-block;background:#075c3b;color:#ffffff;text-decoration:none;border-radius:12px;padding:13px 18px;font-size:14px;font-weight:800;">Ver en Acervo</a>
                  </div>
                ` : ''}

                <div style="height:1px;background:#e5ece8;margin:30px 0 18px;"></div>
                <p style="font-size:12px;line-height:1.6;color:#718078;margin:0;">
                  Este mensaje fue generado automaticamente por Acervo Operaciones. Si no esperabas esta notificacion, puedes ignorarla o contactar al administrador de la plataforma.
                </p>
              </td>
            </tr>
          </table>
          <div style="max-width:640px;margin:14px auto 0;text-align:center;color:#8a968f;font-size:11px;line-height:1.5;">
            Centro de conocimiento operativo · Gestion documental institucional
          </div>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export async function sendNotificationEmail({ to, name, title, message, docNumber, docId }) {
  if (!to) throw new Error('El usuario no tiene correo configurado.');

  const from = required('SMTP_FROM');
  const subject = docNumber ? `${title} - ${docNumber}` : title;
  const safeName = name || 'Usuario';
  const text = [
    `Hola ${safeName},`,
    '',
    message,
    '',
    docNumber ? `Documento: ${docNumber}` : '',
    '',
    'Acervo Operaciones',
  ].filter(Boolean).join('\n');

  const html = buildHtmlTemplate({ name: safeName, title, message, docNumber, docId });

  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, text, html });
}
