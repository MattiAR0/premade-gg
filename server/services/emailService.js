/**
 * EMAIL SERVICE - PremadeGG
 *
 * Envía emails transaccionales usando Resend (API HTTP).
 * Resuelve los problemas de bloqueos de puertos SMTP en Render.
 *
 * Variables de entorno requeridas:
 *   RESEND_API_KEY
 *   RESEND_FROM_EMAIL (Ej: 'Acme <onboarding@resend.dev>' o tu dominio verificado)
 */

const { Resend } = require('resend');

// ── Instancia de Resend ──────────────────────────────
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = process.env.RESEND_FROM_EMAIL || 'PremadeGG <onboarding@resend.dev>';

/**
 * Envía un email de reset de contraseña.
 *
 * @param {string} to      - Email del destinatario
 * @param {string} resetUrl - URL completa con el token
 */
const sendPasswordResetEmail = async (to, resetUrl) => {
  try {
    const data = await resend.emails.send({
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
    });

    console.log('✅ Correo enviado via Resend:', data.id);
  } catch (error) {
    console.error('❌ Error al enviar email con Resend:', error.message);
    throw new Error('No se pudo enviar el correo de recuperación.');
  }
};

/**
 * Verifica la API Key de Resend (Simulación de "verifyConnection" para mantener retrocompatibilidad).
 */
const verifyConnection = async () => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('⚠️  Resend: API Key is missing. Emails will not work.');
  } else {
    console.log('✅ Resend configured (API Key present)');
  }
};

module.exports = { sendPasswordResetEmail, verifyConnection };
