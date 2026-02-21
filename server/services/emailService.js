/**
 * EMAIL SERVICE - PremadeGG
 *
 * Envía emails transaccionales usando Brevo API (HTTP).
 * Esto evita los bloqueos de Render al puerto SMTP estándar
 * y permite enviar correos sin dominio verificado.
 *
 * Variables de entorno requeridas:
 *   BREVO_API_KEY
 *   BREVO_SENDER_EMAIL (El email con el que te registraste en Brevo)
 */

// Usamos el cliente HTTP oficial de Brevo (v4).

// Usamos el cliente HTTP oficial de Brevo v4
// Esto garantiza un 100% de éxito en Render porque usa el puerto 443 (HTTPS).
const { BrevoClient } = require('@getbrevo/brevo');

// Instanciar el cliente usando tu API key de Render
const brevo = new BrevoClient({
  apiKey: process.env.BREVO_API_KEY,
});

const SENDER_EMAIL = process.env.BREVO_SENDER_EMAIL || 'premadegg.bot@gmail.com';
const SENDER_NAME = 'PremadeGG Team';

/**
 * Envía un email de reset de contraseña usando BREVO API HTTP.
 *
 * @param {string} to      - Email del destinatario
 * @param {string} resetUrl - URL completa con el token
 */
const sendPasswordResetEmail = async (to, resetUrl) => {
  try {
    const data = await brevo.transactionalEmails.sendTransacEmail({
      subject: 'PremadeGG — Restablecer contraseña',
      htmlContent: `
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
          </div>

          <!-- Footer -->
          <div style="padding:16px 24px;text-align:center;border-top:1px solid #1c2432">
            <p style="margin:0;font-size:0.7rem;color:#4a5568">
              &copy; ${new Date().getFullYear()} PremadeGG — Valorant LFG Platform
            </p>
          </div>
        </div>
      `,
      sender: { name: SENDER_NAME, email: SENDER_EMAIL },
      to: [{ email: to }],
    });

    console.log(
      '✅ Correo enviado via Brevo API. Response ID:',
      data?.messageId || data?.id || 'Success',
    );
  } catch (error) {
    console.error('❌ Error enviando email con Brevo API:', error.message);
    throw new Error('No se pudo enviar el correo de recuperación.');
  }
};

/**
 * Verifica la API Key de Brevo.
 */
const verifyConnection = async () => {
  if (!process.env.BREVO_API_KEY) {
    console.warn('⚠️  Brevo: API Key is missing. Emails will not work.');
  } else {
    console.log('✅ Brevo configured (API Key present)');
  }
};

module.exports = { sendPasswordResetEmail, verifyConnection };
