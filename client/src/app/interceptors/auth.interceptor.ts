import { HttpInterceptorFn } from '@angular/common/http';

const TOKEN_KEY = 'premadegg_token';

/**
 * Interceptor funcional que adjunta el JWT a cada request saliente.
 *
 * Lee el token directamente de localStorage en lugar de inyectar AuthService
 * para evitar una dependencia circular: durante el APP_INITIALIZER,
 * AuthService se está construyendo (restoreSession → http.get → interceptor)
 * y un inject(AuthService) aquí lanzaría NG0200.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem(TOKEN_KEY);

  if (token) {
    const cloned = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`,
      },
    });
    return next(cloned);
  }

  return next(req);
};
