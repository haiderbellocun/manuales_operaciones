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

export async function sendNotificationEmail({ to, name, title, message, docNumber }) {
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

  const html = `
    <div style="font-family:Arial,sans-serif;color:#17211b;line-height:1.5">
      <p>Hola <strong>${safeName}</strong>,</p>
      <p>${message}</p>
      ${docNumber ? `<p><strong>Documento:</strong> ${docNumber}</p>` : ''}
      <p style="color:#6b756f;font-size:12px">Acervo Operaciones</p>
    </div>
  `;

  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, text, html });
}
