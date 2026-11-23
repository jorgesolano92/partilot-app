import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { Capacitor } from '@capacitor/core';

export type SpainLocationState =
  | 'checking'
  | 'allowed'
  | 'blocked'
  | 'denied'
  | 'unavailable';

/**
 * Comprueba si el dispositivo está en territorio español (bounding box,
 * incluidas Canarias, Baleares, Ceuta y Melilla).
 *
 * Método: `navigator.geolocation.getCurrentPosition` (WebView / browser).
 * En Android hace falta ACCESS_COARSE/FINE_LOCATION en el Manifest.
 */
@Injectable({ providedIn: 'root' })
export class SpainLocationService {
  private readonly state$ = new BehaviorSubject<SpainLocationState>('checking');
  readonly locationState$ = this.state$.asObservable();

  /** Timeout duro para no quedarse eternamente en "Comprobando…". */
  private readonly hardTimeoutMs = 16000;

  get currentState(): SpainLocationState {
    return this.state$.value;
  }

  /** En desarrollo web local no bloqueamos para no frenar el trabajo. */
  private get skipOnLocalWeb(): boolean {
    return !Capacitor.isNativePlatform() && /localhost|127\.0\.0\.1/.test(window.location.hostname);
  }

  async ensureSpainAccess(): Promise<SpainLocationState> {
    if (this.skipOnLocalWeb) {
      this.state$.next('allowed');
      return 'allowed';
    }

    if (!('geolocation' in navigator)) {
      this.state$.next('unavailable');
      return 'unavailable';
    }

    this.state$.next('checking');

    try {
      const position = await Promise.race([
        this.getCurrentPosition(),
        this.rejectAfter(this.hardTimeoutMs, 'TIMEOUT'),
      ]);
      const allowed = this.isInSpain(position.coords.latitude, position.coords.longitude);
      const next: SpainLocationState = allowed ? 'allowed' : 'blocked';
      this.state$.next(next);
      return next;
    } catch (err: any) {
      const code = err?.code;
      const message = String(err?.message || err || '');
      // PERMISSION_DENIED = 1
      if (code === 1 || /denied|permission/i.test(message)) {
        this.state$.next('denied');
        return 'denied';
      }
      this.state$.next('unavailable');
      return 'unavailable';
    }
  }

  private getCurrentPosition(): Promise<GeolocationPosition> {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: false,
        timeout: 12000,
        maximumAge: 5 * 60 * 1000,
      });
    });
  }

  private rejectAfter(ms: number, reason: string): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => reject(Object.assign(new Error(reason), { code: 3 })), ms);
    });
  }

  isInSpain(lat: number, lon: number): boolean {
    // Península + Baleares + Ceuta/Melilla
    const peninsula =
      lat >= 35.9 && lat <= 43.85 && lon >= -9.6 && lon <= 4.4;
    // Canarias
    const canarias =
      lat >= 27.5 && lat <= 29.5 && lon >= -18.3 && lon <= -13.3;

    return peninsula || canarias;
  }
}
