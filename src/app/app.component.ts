import { Component, OnDestroy, OnInit } from '@angular/core';
import { MenuController } from '@ionic/angular';
import { Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { AuthService } from './core/services/auth.service';
import { BiometricService } from './core/services/biometric.service';
import { PushNotificationsService } from './core/services/push-notifications.service';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { environment } from '../environments/environment';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit, OnDestroy {
  currentRoute: string = '';
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';
  userName: string = '';
  userEmail: string = '';
  userImage: string | null = null;

  private appStateListener: PluginListenerHandle | null = null;

  constructor(
    private menuController: MenuController,
    private router: Router,
    public authService: AuthService,
    private biometricService: BiometricService,
    private pushNotificationsService: PushNotificationsService
  ) {
    // Detectar cambios de ruta
    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe((event: any) => {
      this.currentRoute = event.url;
      this.detectarRol();
      this.actualizarUsuario();
    });
  }

  async ngOnInit() {
    this.detectarRol();
    this.actualizarUsuario();
    await this.inicializarStatusBar();
    await this.registrarListenerEstadoApp();
    try {
      await this.pushNotificationsService.initialize();
      this.pushNotificationsService.syncTokenWithBackend();
    } catch (e) {
      console.warn('Push notifications init:', e);
    }
  }

  ngOnDestroy(): void {
    void this.appStateListener?.remove();
    this.appStateListener = null;
  }

  /** Al pasar a segundo plano se invalida el desbloqueo biométrico; al volver se exige de nuevo si aplica. */
  private async registrarListenerEstadoApp(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      this.appStateListener = await App.addListener('appStateChange', ({ isActive }) => {
        if (!isActive) {
          if (!this.biometricService.isNativeBarcodeScanInProgress()) {
            this.biometricService.invalidateBiometricUnlockSession();
          }
        } else {
          this.redirigirABiometricaSiCorresponde();
        }
      });
    } catch (e) {
      console.warn('App state listener no disponible:', e);
    }
  }

  private redirigirABiometricaSiCorresponde(): void {
    if (!this.biometricService.mustShowBiometricGate()) return;
    const path = (this.router.url || '').split('?')[0];
    if (this.rutaExentaBiometrica(path)) return;
    this.router.navigate(['/biometric-unlock'], {
      queryParams: { returnUrl: this.router.url },
      replaceUrl: true,
    });
  }

  private rutaExentaBiometrica(path: string): boolean {
    const p = path || '';
    if (p === '' || p === '/') return true;
    if (p.startsWith('/login')) return true;
    if (p.startsWith('/registro')) return true;
    return false;
  }

  /**
   * Configura la barra de estado del dispositivo para que no se monte sobre el header.
   * Solo se ejecuta en app nativa (Capacitor).
   */
  private async inicializarStatusBar(): Promise<void> {
    if (!Capacitor.isNativePlatform()) return;
    try {
      await StatusBar.setOverlaysWebView({ overlay: false });
      await StatusBar.setStyle({ style: Style.Light });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });
    } catch (e) {
      console.warn('StatusBar no disponible:', e);
    }
  }

  actualizarUsuario() {
    const user = this.authService.getUser();
    if (user) {
      this.userName = this.obtenerNombreCompleto(user);
      this.userEmail = user.email || '';
      this.userImage = this.getUserImageUrl(user.image);
    } else {
      this.userImage = null;
    }
  }

  /** Nombre para el menú: nombre + primer apellido (si existe). */
  private obtenerNombreCompleto(user: { name?: string; last_name?: string; last_name2?: string; nombre?: string; apellido?: string }): string {
    const nombre = (user.name || user.nombre || '').trim();
    const primerApellido = (user.last_name || user.apellido || '').trim();
    if (primerApellido) {
      return `${nombre} ${primerApellido}`.trim();
    }
    return nombre || 'Usuario';
  }

  /** URL de la imagen del usuario (desde API). Las imágenes de usuario se sirven desde storage. */
  getUserImageUrl(imagePath: string | null | undefined): string | null {
    if (!imagePath) return null;
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const path = imagePath.startsWith('/') ? imagePath.slice(1) : imagePath;
    return `${base}/storage/${path.replace(/^storage\/?/, '')}`;
  }

  onUserImageError() {
    this.userImage = null;
  }

  logout(event: Event) {
    event.preventDefault();
    event.stopPropagation();
    this.menuController.close('main-menu');
    this.authService.logout().subscribe(() => {});
  }

  detectarRol() {
    const rolGuardado = localStorage.getItem('rolActual');
    const esVendedorStr = localStorage.getItem('esVendedor');
    
    if (rolGuardado) {
      this.rolActual = rolGuardado as 'usuario' | 'vendedor' | 'gestor';
    } else if (esVendedorStr === 'true') {
      this.rolActual = 'vendedor';
    } else {
      // Detectar desde la ruta
      if (this.currentRoute.includes('/gestor-tab') || this.currentRoute.includes('/gestor-home') || this.currentRoute.includes('/gestor-vendedores') || this.currentRoute.includes('/gestor-asignacion') || this.currentRoute.includes('/gestor-devolucion') || this.currentRoute.includes('/gestor-pago')) {
        this.rolActual = 'gestor';
        localStorage.setItem('rolActual', 'gestor');
        localStorage.setItem('esVendedor', 'false');
      } else if (this.currentRoute.includes('/vendedor-tab') || this.currentRoute.includes('/venta') || this.currentRoute.includes('/venta-qr') || this.currentRoute.includes('/venta-manual')) {
        this.rolActual = 'vendedor';
        localStorage.setItem('rolActual', 'vendedor');
        localStorage.setItem('esVendedor', 'true');
      } else {
        this.rolActual = 'usuario';
      }
    }
  }

  esVendedor(): boolean {
    return this.rolActual === 'vendedor';
  }

  esGestor(): boolean {
    return this.rolActual === 'gestor';
  }

  cerrarMenu() {
    this.menuController.close('main-menu');
  }

  /** Contador para el badge del menú lateral (notificaciones no leídas). */
  get notificacionesNoLeidas(): number {
    const server = localStorage.getItem('notificaciones_unread_server');
    if (server !== null && server !== '') {
      const n = parseInt(server, 10);
      if (!Number.isNaN(n)) {
        return n;
      }
    }
    try {
      const arr = JSON.parse(localStorage.getItem('notificaciones') || '[]') as { leida?: boolean }[];
      return Array.isArray(arr) ? arr.filter((x) => !x.leida).length : 0;
    } catch {
      return 0;
    }
  }
}
