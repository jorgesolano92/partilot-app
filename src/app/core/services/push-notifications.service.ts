import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Capacitor } from '@capacitor/core';
import {
  FirebaseMessaging,
  Notification,
  NotificationActionPerformedEvent,
  NotificationReceivedEvent,
  TokenReceivedEvent,
} from '@capacitor-firebase/messaging';
import { BehaviorSubject, EMPTY, Observable, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

const STORAGE_KEY = 'fcm_device_token';

/**
 * Push nativo vía Firebase Cloud Messaging. El token es FCM en ambas plataformas:
 * en Android por google-services.json y en iOS por GoogleService-Info.plist, donde
 * el plugin registra el token APNs en FCM y devuelve el token FCM equivalente.
 * El backend envía por FCM HTTP v1, así que necesita este token y no el de APNs.
 */
@Injectable({ providedIn: 'root' })
export class PushNotificationsService {
  private listenersAttached = false;

  /** Último token FCM del dispositivo. */
  readonly deviceToken$ = new BehaviorSubject<string | null>(null);

  constructor(
    private http: HttpClient,
    private router: Router
  ) {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      this.deviceToken$.next(saved);
    }
  }

  /**
   * Solicita permisos, registra listeners y pide el token FCM.
   * Idempotente: los listeners solo se registran una vez.
   */
  async initialize(): Promise<void> {
    if (!Capacitor.isNativePlatform()) {
      return;
    }

    let perm = await FirebaseMessaging.checkPermissions();
    if (perm.receive === 'prompt') {
      perm = await FirebaseMessaging.requestPermissions();
    }
    if (perm.receive !== 'granted') {
      console.warn('[Push] Permiso de notificaciones no concedido:', perm.receive);
      return;
    }

    if (!this.listenersAttached) {
      this.listenersAttached = true;
      await FirebaseMessaging.addListener('tokenReceived', (e: TokenReceivedEvent) => {
        this.storeToken(e.token);
      });
      await FirebaseMessaging.addListener('notificationReceived', (e: NotificationReceivedEvent) => {
        this.onForegroundNotification(e.notification);
      });
      await FirebaseMessaging.addListener(
        'notificationActionPerformed',
        (e: NotificationActionPerformedEvent) => {
          this.onNotificationOpened(e.notification);
        }
      );
    }

    try {
      const { token } = await FirebaseMessaging.getToken();
      this.storeToken(token);
    } catch (err) {
      console.warn('[Push] No se pudo obtener el token FCM:', err);
    }
  }

  /** Borra token local (p. ej. al cerrar sesión). No llama a FCM unregister. */
  clearLocalDeviceToken(): void {
    localStorage.removeItem(STORAGE_KEY);
    this.deviceToken$.next(null);
  }

  /**
   * Envía el token al backend si hay sesión y `environment.fcmDeviceRegisterPath` está definido.
   * Cuerpo JSON: `{ fcm_token: string }` (ajusta el backend a este nombre o cambia aquí).
   */
  syncTokenWithBackend(): void {
    const path = environment.fcmDeviceRegisterPath;
    if (!path) {
      return;
    }
    const authToken = localStorage.getItem('token');
    const deviceToken = this.deviceToken$.value;
    if (!authToken || !deviceToken) {
      return;
    }
    const base = environment.apiUrl.replace(/\/$/, '');
    const rel = path.replace(/^\//, '');
    const url = `${base}/${rel}`;
    const platform = Capacitor.getPlatform();
    this.http
      .post(url, { fcm_token: deviceToken, platform })
      .pipe(
        catchError((err) => {
          console.warn('[Push] No se pudo registrar el token en el servidor:', err);
          return EMPTY;
        })
      )
      .subscribe();
  }

  /**
   * Elimina este dispositivo en el servidor (misma API Bearer que el resto).
   * Debe llamarse antes de invalidar la sesión en el logout.
   */
  unregisterFromBackend(): Observable<unknown> {
    const path = environment.fcmDeviceUnregisterPath;
    if (!path) {
      return of(null);
    }
    const authToken = localStorage.getItem('token');
    const deviceToken = this.deviceToken$.value || localStorage.getItem(STORAGE_KEY);
    if (!authToken || !deviceToken) {
      return of(null);
    }
    const base = environment.apiUrl.replace(/\/$/, '');
    const url = `${base}/${path.replace(/^\//, '')}`;
    return this.http.post(url, { fcm_token: deviceToken }).pipe(
      catchError((err) => {
        console.warn('[Push] No se pudo eliminar el token en el servidor:', err);
        return of(null);
      })
    );
  }

  /** Guarda el token y lo sincroniza con el backend si cambió. */
  private storeToken(token: string | null | undefined): void {
    if (!token || token === this.deviceToken$.value) {
      return;
    }
    localStorage.setItem(STORAGE_KEY, token);
    this.deviceToken$.next(token);
    this.syncTokenWithBackend();
  }

  private onForegroundNotification(n: Notification): void {
    // Aquí puedes mostrar un toast Ionic o actualizar estado global
    if (n.title || n.body) {
      console.info('[Push] Notificación (primer plano):', n.title, n.body, n.data);
    }
  }

  /** Al pulsar la notificación: prioriza `notification_id` → modal en bandeja; si no, `url`/`route`. */
  private onNotificationOpened(n: Notification): void {
    const data = n?.data as Record<string, unknown> | undefined;
    if (!data) return;
    const nid = data['notification_id'] ?? data['notificationId'];
    if (nid != null && String(nid).trim() !== '') {
      void this.router.navigate(['/tabs/notificaciones'], {
        queryParams: { modalId: String(nid) },
        replaceUrl: true,
      });
      return;
    }
    const raw = data['url'] ?? data['route'];
    if (typeof raw === 'string' && raw.startsWith('/') && !raw.startsWith('//')) {
      void this.router.navigateByUrl(raw);
    }
  }
}
