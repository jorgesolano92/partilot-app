import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { map, catchError, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { LegalService } from '../services/legal.service';

/**
 * Redirige a aceptacion-rol si hay invitaciones de rol pendientes (L3/L4/L5).
 */
export const roleAcceptanceGuard: CanActivateFn = () => {
  const authService = inject(AuthService);
  const legalService = inject(LegalService);
  const router = inject(Router);

  if (!authService.isLoggedIn()) {
    return true;
  }

  return legalService.getPendingAcceptances().pipe(
    map((pending) => {
      if (pending.length > 0) {
        void router.navigate(['/aceptacion-rol'], {
          queryParams: { key: pending[0].key },
          replaceUrl: true,
        });
        return false;
      }
      return true;
    }),
    catchError(() => of(true))
  );
};
