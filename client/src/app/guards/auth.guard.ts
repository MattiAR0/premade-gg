import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { AuthService } from '../services/auth.service';

/**
 * Guard funcional que espera a que la sesión se restaure
 * antes de decidir si el usuario está autenticado.
 * Si aún no ha vinculado su Riot ID, lo manda a /onboarding.
 */
export const authGuard: CanActivateFn = async (_route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Esperar a que se complete la restauración de sesión (si está en curso)
  await authService.whenSessionRestored;

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (!authService.isOnboarded()) {
    return router.createUrlTree(['/onboarding'], { queryParams: { returnUrl: state.url } });
  }

  return true;
};

/** Solo para /onboarding: requiere sesión y que falte el Riot ID. */
export const onboardingGuard: CanActivateFn = async () => {
  const authService = inject(AuthService);
  const router = inject(Router);

  await authService.whenSessionRestored;

  if (!authService.isAuthenticated()) {
    return router.createUrlTree(['/login']);
  }
  return authService.isOnboarded() ? router.createUrlTree(['/']) : true;
};
