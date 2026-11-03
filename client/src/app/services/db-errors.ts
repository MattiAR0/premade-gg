/**
 * Traduce al español los errores que Postgres, PostgREST y Storage devuelven en inglés.
 * Los mensajes de las RPC ya vienen en español y pasan tal cual.
 */

/** Restricciones check: nombre de la restricción → mensaje. */
const CHECK_MESSAGES: Record<string, string> = {
  profiles_bio_check: 'La biografía no puede pasar de 500 caracteres.',
  profiles_lft_details_check: 'Los detalles de búsqueda de equipo no pueden pasar de 300 caracteres.',
  profiles_coach_details_check: 'Los detalles de coach no pueden pasar de 500 caracteres.',
  profiles_favorite_agents_check: 'Elige como máximo 3 agentes favoritos de la lista.',
  profiles_roles_check: 'Elige como máximo 5 roles.',
};

/** Tipos enum: nombre del tipo → qué campo es. */
const ENUM_FIELDS: Record<string, string> = {
  valorant_role: 'El rol',
  valorant_rank: 'El rango',
  region: 'La región',
  profile_image_type: 'El tipo de foto de perfil',
};

const PATTERNS: [RegExp, string][] = [
  [/JWT expired|invalid JWT|JWSError/i, 'Tu sesión ha caducado. Vuelve a iniciar sesión.'],
  [/Failed to fetch|NetworkError|Load failed|fetch failed/i, 'No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.'],
  [/exceeded the maximum allowed size|Payload too large/i, 'La imagen no puede superar 2MB.'],
  [/mime type .* is not supported/i, 'Formato de imagen no admitido. Usa JPG, PNG, WebP o GIF.'],
  [/row-level security|permission denied/i, 'No tienes permiso para hacer esto.'],
  [/invalid input syntax for type boolean/i, 'Hay una opción de sí/no con un valor no válido.'],
  [/violates check constraint|invalid input (value|syntax)/i, 'Algún dato del formulario no es válido. Revísalo e inténtalo de nuevo.'],
];

export function translateDbError(message: string | undefined | null): string {
  if (!message) return 'Error inesperado';

  const check = /violates check constraint "([^"]+)"/.exec(message);
  if (check && CHECK_MESSAGES[check[1]]) return CHECK_MESSAGES[check[1]];

  const enumValue = /invalid input value for enum (?:\w+\.)?(\w+): "([^"]*)"/.exec(message);
  if (enumValue && ENUM_FIELDS[enumValue[1]]) {
    return `${ENUM_FIELDS[enumValue[1]]} "${enumValue[2]}" no es válido.`;
  }

  for (const [pattern, translated] of PATTERNS) {
    if (pattern.test(message)) return translated;
  }
  return message;
}
