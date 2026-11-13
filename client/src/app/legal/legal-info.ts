/**
 * Datos del titular y de los textos legales. Un único sitio para cambiarlos.
 * BORRADOR: los textos legales están pendientes de revisión por un abogado.
 */
export const LEGAL = {
  ownerName: 'Matti Johannes Ahola Rivas',
  // Sin actividad económica no se publican NIF ni domicilio (LSSI art. 10). Si llegan anuncios o
  // ingresos, hay que añadirlos al aviso legal. No los pongas aquí: el repositorio es público.
  contactEmail: 'premagegg.app@gmail.com',
  siteName: 'PremadeGG',
  siteUrl: 'https://premade-gg.vercel.app',
  /** Edad mínima para usar el servicio */
  minAge: 16,
  /** Versión vigente de términos y privacidad. Debe coincidir con supabase/functions/_shared/legal.ts */
  termsVersion: '2026-11-09',
  /** Fecha de la última actualización, tal como se muestra en las páginas */
  updatedAt: '9 de noviembre de 2026',
  /** Última actualización de la política de privacidad, si cambia sin cambiar los términos */
  privacyUpdatedAt: '13 de noviembre de 2026',
} as const;
