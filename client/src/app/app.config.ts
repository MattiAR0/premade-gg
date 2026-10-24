import { ApplicationConfig, LOCALE_ID, provideBrowserGlobalErrorListeners, provideAppInitializer, inject } from '@angular/core';
import { registerLocaleData } from '@angular/common';
import localeEs from '@angular/common/locales/es';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';

import { routes } from './app.routes';
import { authInterceptor } from './interceptors/auth.interceptor';
import { AuthService } from './services/auth.service';

// Fechas, números y meses en español ("octubre 2026", "4,7")
registerLocaleData(localeEs);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: LOCALE_ID, useValue: 'es' },
    provideHttpClient(withInterceptors([authInterceptor])),
    // Bloquea el arranque de Angular hasta que la sesión se haya restaurado
    provideAppInitializer(() => inject(AuthService).whenSessionRestored),
  ],
};
