/**
 * EMAIL SERVICE - PremadeGG
 *
 * Envía emails transaccionales usando Nodemailer.
 * Soporta cualquier proveedor SMTP (Gmail, Outlook, Mailtrap, etc.).
 *
 * Variables de entorno requeridas:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
 */

const nodemailer = require('nodemailer');

// ── Transporter SMTP ─────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT, 10) || 587,
  secure: process.env.SMTP_SECURE === 'true', // true para 465, false para otros
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = process.env.SMTP_FROM || '"PremadeGG" <noreply@premadegg.com>';

/**
 * Envía un email de reset de contraseña.
 *
 * @param {string} to      - Email del destinatario
 * @param {string} resetUrl - URL completa con el token
 */
const sendPasswordResetEmail = async (to, resetUrl) => {
  const mailOptions = {
    from: FROM,
    to,
    subject: 'PremadeGG — Restablecer contraseña',
    html: `
      <div style="max-width:520px;margin:0 auto;font-family:'Segoe UI',Arial,sans-serif;color:#c9d1d9;background:#0b0f14;border:1px solid #1c2432;border-radius:16px;overflow:hidden">
        <!-- Header -->
        <div style="background:linear-gradient(135deg,#131920,#1a212c);padding:32px 24px;text-align:center">
          <h1 style="margin:0;font-size:1.6rem;color:#ecf0f4;letter-spacing:-0.02em">
            Premade<span style="color:#dc3545">GG</span>
          </h1>
        </div>

        <!-- Body -->
        <div style="padding:32px 24px">
          <h2 style="margin:0 0 8px;font-size:1.15rem;color:#ecf0f4">Restablecer contraseña</h2>
          <p style="margin:0 0 24px;font-size:0.9rem;line-height:1.6;color:#6b7785">
            Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
            Haz clic en el botón de abajo para elegir una nueva contraseña.
          </p>

          <div style="text-align:center;margin:24px 0">
            <a href="${resetUrl}"
               style="display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#dc3545,#b52c3b);color:#fff;font-size:0.95rem;font-weight:700;text-decoration:none;border-radius:10px">
              Restablecer contraseña
            </a>
          </div>

          <p style="margin:0 0 8px;font-size:0.8rem;color:#6b7785">
            Este enlace expira en <strong style="color:#c9d1d9">1 hora</strong>.
          </p>
          <p style="margin:0;font-size:0.8rem;color:#6b7785">
            Si no solicitaste este cambio, puedes ignorar este email. Tu contraseña no será modificada.
          </p>

          <!-- Fallback link -->
          <div style="margin-top:24px;padding:12px;background:#131920;border:1px solid #1c2432;border-radius:8px">
            <p style="margin:0 0 4px;font-size:0.75rem;color:#6b7785">Si el botón no funciona, copia y pega este enlace:</p>
            <p style="margin:0;font-size:0.75rem;word-break:break-all;color:#dc3545">${resetUrl}</p>
          </div>
        </div>

        <!-- Footer -->
        <div style="padding:16px 24px;text-align:center;border-top:1px solid #1c2432">
          <p style="margin:0;font-size:0.7rem;color:#4a5568">
            &copy; ${new Date().getFullYear()} PremadeGG — Valorant LFG Platform
          </p>
        </div>
      </div>
    `,
    text: `PremadeGG — Restablecer contraseña\n\nHemos recibido una solicitud para restablecer tu contraseña.\n\nVisita este enlace para elegir una nueva contraseña (expira en 1 hora):\n${resetUrl}\n\nSi no solicitaste este cambio, ignora este email.`,
  };

  await transporter.sendMail(mailOptions);
};

/**
 * Verifica la conexión SMTP al arrancar (opcional).
 */
const verifyConnection = async () => {
  try {
    await transporter.verify();
    console.log('✅ SMTP connection verified');
  } catch (err) {
    console.warn('⚠️  SMTP connection failed (password reset emails will not work):', err.message);
  }
};

module.exports = { sendPasswordResetEmail, verifyConnection };
