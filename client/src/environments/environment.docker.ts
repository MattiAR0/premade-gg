/**
 * Docker environment
 *
 * Usa URLs relativas para que nginx haga de reverse-proxy
 * hacia el contenedor "api" (ver nginx.conf).
 */
export const environment = {
    production: true,
    apiUrl: '/api',
    socketUrl: '',
};
