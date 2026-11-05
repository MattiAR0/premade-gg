import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideRouter, withNavigationErrorHandler } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './services/auth.service';
import { reloadOnStaleChunk } from './services/stale-chunk-reload';

// Fechas, números y meses en español ("octubre 2026", "4,7")
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Tras un despliegue, una pestaña abierta recarga si pide un chunk que ya no existe
    provideRouter(routes, withNavigationErrorHandler(reloadOnStaleChunk)),
    { provide: LOCALE_ID, useValue: 'es' },
    // Bloquea el arranque de Angular hasta que la sesión se haya restaurado
    provideAppInitializer(() => inject(AuthService).whenSessionRestored),
  ],
};
