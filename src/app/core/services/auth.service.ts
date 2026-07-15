import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map, catchError, of } from 'rxjs';
import { concatMap } from 'rxjs/operators';
import { Router } from '@angular/router';
import { environment } from '../../../environments/environment';
import { BiometricService } from './biometric.service';
import { PushNotificationsService } from './push-notifications.service';
import { LegalService } from './legal.service';

export type AppRole = 'usuario' | 'vendedor' | 'gestor';

export interface LoginResponse {
  success: boolean;
  token?: string;
  user?: any;
  seller?: any;
  manager?: any;
  pending_role_invitations?: Array<{ key: string; type: string; screen_title: string }>;
  message?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private router: Router,
    private biometricService: BiometricService,
    private pushNotificationsService: PushNotificationsService,
    private legalService: LegalService
  ) {}

  /** Login perfil Vendedor (solo cuentas con rol seller). */
  login(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login`, { email, password }).pipe(
      tap(response => {
        if (response.success && response.token) {
          localStorage.setItem('token', response.token);
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }
          if (response.seller) {
            localStorage.setItem('seller', JSON.stringify(response.seller));
          }
          localStorage.setItem('rolActual', 'vendedor');
          localStorage.setItem('esVendedor', 'true');
          this.biometricService.markBiometricUnlockSessionOk();
          this.pushNotificationsService.syncTokenWithBackend();
        }
      })
    );
  }

  getSmsConfig(): Observable<{ enabled: boolean; code_length: number; resend_cooldown_seconds: number }> {
    return this.http.get<{ enabled: boolean; code_length: number; resend_cooldown_seconds: number }>(
      `${this.apiUrl}/auth/sms/config`
    );
  }

  sendRegisterSmsCode(phone: string): Observable<{ success: boolean; message?: string }> {
    return this.http.post<{ success: boolean; message?: string }>(`${this.apiUrl}/auth/sms/send-code`, { phone });
  }

  /** Registro de cliente (email, password; teléfono y SMS opcionales). */
  register(
    email: string,
    password: string,
    fechaNacimiento: string,
    phone?: string,
    smsCode?: string,
    linkCode?: string
  ): Observable<LoginResponse> {
    const body: Record<string, unknown> = {
      email,
      password,
      fecha_nacimiento: fechaNacimiento,
      aceptar_condiciones: true,
    };
    if (phone != null && phone !== '') {
      body['phone'] = phone;
    }
    if (smsCode != null && smsCode !== '') {
      body['sms_code'] = smsCode;
    }
    if (linkCode != null && linkCode.trim() !== '') {
      body['link_code'] = linkCode.trim();
    }
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/register`, body, {
      headers: this.legalService.channelHeaders(),
    }).pipe(
      tap(response => {
        if (response.success && response.token) {
          localStorage.setItem('token', response.token);
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }
          localStorage.removeItem('seller');
          localStorage.setItem('rolActual', 'usuario');
          localStorage.setItem('esVendedor', 'false');
          this.biometricService.markBiometricUnlockSessionOk();
          this.pushNotificationsService.syncTokenWithBackend();
        }
      })
    );
  }

  /** Login único que determina automáticamente el rol del usuario. 
   * Si el usuario es gestor, vendedor o usuario normal, se establece el rol correspondiente. */
  loginUsuario(email: string, password: string): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/login-usuario`, { email, password }).pipe(
      tap(response => {
        if (response.success && response.token) {
          localStorage.setItem('token', response.token);
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }
          if (response.seller) {
            localStorage.setItem('seller', JSON.stringify(response.seller));
          } else {
            localStorage.removeItem('seller');
          }
          if (response.manager) {
            localStorage.setItem('manager', JSON.stringify(response.manager));
          } else {
            localStorage.removeItem('manager');
          }
          // Rol inicial según tablas sellers/managers (no users.role): gestor > vendedor > usuario
          const canManager = !!response.manager;
          const canSeller = !!response.seller;
          if (canManager) {
            localStorage.setItem('rolActual', 'gestor');
            localStorage.setItem('esVendedor', 'false');
          } else if (canSeller) {
            localStorage.setItem('rolActual', 'vendedor');
            localStorage.setItem('esVendedor', 'true');
          } else {
            localStorage.setItem('rolActual', 'usuario');
            localStorage.setItem('esVendedor', 'false');
          }
          this.biometricService.markBiometricUnlockSessionOk();
          this.pushNotificationsService.syncTokenWithBackend();
        }
      })
    );
  }

  logout(): Observable<any> {
    const token = localStorage.getItem('token');
    if (token) {
      return this.pushNotificationsService.unregisterFromBackend().pipe(
        concatMap(() =>
          this.http.post(`${this.apiUrl}/auth/logout`, {}).pipe(
            tap(() => this.clearSession()),
            catchError(() => {
              this.clearSession();
              return of({});
            })
          )
        )
      );
    }
    this.clearSession();
    return of({});
  }

  clearSession(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('seller');
    localStorage.removeItem('manager');
    localStorage.removeItem('rolActual');
    this.biometricService.clearStoredLoginCredentials();
    this.biometricService.invalidateBiometricUnlockSession();
    this.pushNotificationsService.clearLocalDeviceToken();
    // Recarga completa para descargar de caché todas las vistas de Ionic y evitar datos viejos
    window.location.href = '/login';
  }

  /** Navega al inicio por rol (tabs). Opcionalmente usa returnUrl si es una ruta interna. */
  navigateToDefaultHome(returnUrl?: string | null): void {
    const safe =
      returnUrl &&
      returnUrl.startsWith('/') &&
      !returnUrl.startsWith('//') &&
      !returnUrl.includes('://')
        ? returnUrl
        : null;
    if (safe) {
      this.router.navigateByUrl(safe, { replaceUrl: true });
      return;
    }
    const rol = localStorage.getItem('rolActual') || 'usuario';
    if (rol === 'gestor') {
      this.router.navigate(['/tabs/gestor-tab3'], { replaceUrl: true });
    } else if (rol === 'vendedor') {
      this.router.navigate(['/tabs/vendedor-tab3'], { replaceUrl: true });
    } else {
      this.router.navigate(['/tabs/tab3'], { replaceUrl: true });
    }
  }

  isLoggedIn(): boolean {
    return !!localStorage.getItem('token');
  }

  isSeller(): boolean {
    return !!localStorage.getItem('seller');
  }

  /** Usuario puede actuar como gestor (está en tabla managers). */
  isManager(): boolean {
    return !!localStorage.getItem('manager');
  }

  /** Alias: mismo que isManager (gestor = manager en la app). */
  isGestor(): boolean {
    return this.isManager();
  }

  /** Puede actuar como cliente (cualquier usuario logueado). */
  canCliente(): boolean {
    return this.isLoggedIn();
  }

  /** Puede actuar como vendedor (está en tabla sellers con estado activo). */
  canSeller(): boolean {
    return this.isLoggedIn() && this.isSeller();
  }

  /** Puede actuar como gestor (está en tabla managers). */
  canManager(): boolean {
    return this.isLoggedIn() && this.isManager();
  }

  /** Puede ver pestaña Usuario/Cliente (todos los usuarios logueados). */
  canViewUsuario(): boolean {
    return this.canCliente();
  }

  /** Puede ver pestaña Vendedor (solo si está en sellers). */
  canViewVendedor(): boolean {
    return this.canSeller();
  }

  /** Puede ver pestaña Gestor (solo si está en managers). */
  canViewGestor(): boolean {
    return this.canManager();
  }

  /** Roles que el usuario puede usar en la app. */
  getAvailableRoles(): AppRole[] {
    const roles: AppRole[] = [];
    if (this.canCliente()) {
      roles.push('usuario');
    }
    if (this.canSeller()) {
      roles.push('vendedor');
    }
    if (this.canManager()) {
      roles.push('gestor');
    }
    return roles;
  }

  hasMultipleRoles(): boolean {
    return this.getAvailableRoles().length > 1;
  }

  /** Ocultar selector si solo puede actuar como usuario/cliente. */
  showRoleSelector(): boolean {
    return this.hasMultipleRoles();
  }

  getCurrentRol(): AppRole {
    const rol = localStorage.getItem('rolActual') as AppRole | null;
    if (rol === 'vendedor' && !this.canSeller()) {
      return 'usuario';
    }
    if (rol === 'gestor' && !this.canManager()) {
      return this.canSeller() ? 'vendedor' : 'usuario';
    }
    if (rol === 'usuario' || rol === 'vendedor' || rol === 'gestor') {
      return rol;
    }
    return 'usuario';
  }

  /** Home del rol activo (fallback de ion-back-button / goBack). */
  getHomeTabHref(): string {
    const rol = this.getCurrentRol();
    if (rol === 'vendedor') {
      return '/tabs/vendedor-tab3';
    }
    if (rol === 'gestor') {
      return '/tabs/gestor-tab3';
    }
    return '/tabs/tab3';
  }

  getRolDisplayName(rol: AppRole): string {
    const labels: Record<AppRole, string> = {
      usuario: 'Usuario',
      vendedor: 'Vendedor',
      gestor: 'Gestor',
    };
    return labels[rol];
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  getUser(): any {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
  }

  getSeller(): any {
    const seller = localStorage.getItem('seller');
    return seller ? JSON.parse(seller) : null;
  }

  getManager(): any {
    const manager = localStorage.getItem('manager');
    return manager ? JSON.parse(manager) : null;
  }

  refreshToken(): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.apiUrl}/auth/refresh`, {}).pipe(
      tap(response => {
        if (response.success && response.token) {
          localStorage.setItem('token', response.token);
          if (response.user) {
            localStorage.setItem('user', JSON.stringify(response.user));
          }
          if (response.seller) {
            localStorage.setItem('seller', JSON.stringify(response.seller));
          } else {
            localStorage.removeItem('seller');
          }
          if (response.manager) {
            localStorage.setItem('manager', JSON.stringify(response.manager));
          } else {
            localStorage.removeItem('manager');
          }
        }
      })
    );
  }
}
