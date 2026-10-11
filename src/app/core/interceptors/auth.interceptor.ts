import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

function tooManyRequestsMessage(err: HttpErrorResponse): string {
  const retryAfter = Number(err.headers?.get('Retry-After'));
  if (Number.isFinite(retryAfter) && retryAfter > 0) {
    const espera = retryAfter >= 60
      ? `${Math.ceil(retryAfter / 60)} minuto(s)`
      : `${Math.ceil(retryAfter)} segundos`;
    return `Se han hecho demasiadas peticiones en poco tiempo. Espera ${espera} y vuelve a intentarlo.`;
  }
  return 'Se han hecho demasiadas peticiones en poco tiempo. Espera un minuto y vuelve a intentarlo.';
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('token');
  const apiUrl = environment.apiUrl;
  const isApi = req.url.startsWith(apiUrl);

  const request = token && isApi
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (isApi && err instanceof HttpErrorResponse && err.status === 429) {
        const message = tooManyRequestsMessage(err);
        const body = err.error && typeof err.error === 'object' ? err.error : {};
        return throwError(() => new HttpErrorResponse({
          error: { ...body, message },
          headers: err.headers,
          status: err.status,
          statusText: err.statusText,
          url: err.url ?? undefined,
        }));
      }
      return throwError(() => err);
    })
  );
};
