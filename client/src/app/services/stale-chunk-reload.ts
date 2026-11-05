import { NavigationError } from '@angular/router';

/**
 * Tras un despliegue, una pestaña que ya estaba abierta sigue con el JavaScript anterior y,
 * al navegar a una ruta con carga diferida, pide un chunk que ya no existe. En vez de dejar
 * la navegación rota, se recarga la página en la URL de destino para cargar la versión nueva.
 *
 * Mensajes según el navegador: Chrome y Edge ("Failed to fetch dynamically imported module"),
 * Firefox ("error loading dynamically imported module") y Safari ("Importing a module script failed").
 */
const STALE_CHUNK = /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed/i;

// Si la recarga no lo arregla (p. ej. sin conexión), no se vuelve a intentar enseguida
const RELOAD_KEY = 'premadegg:stale-chunk-reload';
const RETRY_AFTER_MS = 10_000;

export function reloadOnStaleChunk(event: NavigationError): void {
  const message = event.error instanceof Error ? event.error.message : String(event.error);
  if (!STALE_CHUNK.test(message)) return;

  const last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  if (Date.now() - last < RETRY_AFTER_MS) return;
  sessionStorage.setItem(RELOAD_KEY, String(Date.now()));

  window.location.assign(event.url);
}
