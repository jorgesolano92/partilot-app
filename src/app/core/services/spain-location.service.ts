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
 */
@Injectable({ providedIn: 'root' })
export class SpainLocationService {
  private readonly state$ = new BehaviorSubject<SpainLocationState>('checking');
  readonly locationState$ = this.state$.asObservable();

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
      const position = await this.getCurrentPosition();
      const allowed = this.isInSpain(position.coords.latitude, position.coords.longitude);
      const next: SpainLocationState = allowed ? 'allowed' : 'blocked';
      this.state$.next(next);
      return next;
    } catch (err: any) {
      const code = err?.code;
      // PERMISSION_DENIED = 1
      if (code === 1) {
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
        timeout: 15000,
        maximumAge: 5 * 60 * 1000,
      });
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
