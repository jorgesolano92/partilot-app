import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';
import { Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false,
})
export class TabsPage implements OnInit, OnDestroy {

  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';
  private rolAnterior: string = '';
  private intervalId: any;
  private routerSubscription: Subscription | null = null;

  constructor(
    private router: Router,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) {}

  ngOnInit() {
    this.detectarRol();
    this.rolAnterior = this.rolActual;
    
    // Escuchar cambios en localStorage para detectar cambios de rol (solo funciona entre pestañas)
    window.addEventListener('storage', () => {
      this.detectarRol();
    });
    
    // Verificar cambios de rol periódicamente (para cambios en la misma pestaña)
    this.intervalId = setInterval(() => {
      this.detectarRol();
      // Si el rol cambió, forzar actualización
      if (this.rolAnterior !== this.rolActual) {
        this.rolAnterior = this.rolActual;
        // Forzar detección de cambios de Angular
        setTimeout(() => {
          // Esto fuerza a Angular a detectar el cambio
        }, 0);
      }
    }, 500); // Verificar cada 500ms
    
    // También escuchar cambios de ruta
    this.routerSubscription = this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.detectarRol();
    });
  }

  ngOnDestroy() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }
    if (this.routerSubscription) {
      this.routerSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    // Detectar rol cada vez que se entra a la vista
    this.detectarRol();
  }

  detectarRol() {
    const canSeller = this.authService.canSeller();
    const canManager = this.authService.canManager();
    const rolGuardado = localStorage.getItem('rolActual');

    if (rolGuardado) {
      this.rolActual = rolGuardado as 'usuario' | 'vendedor' | 'gestor';
      if (this.rolActual === 'vendedor' && !canSeller) {
        this.rolActual = 'usuario';
        localStorage.setItem('rolActual', 'usuario');
        localStorage.setItem('esVendedor', 'false');
      } else if (this.rolActual === 'gestor' && !canManager) {
        this.rolActual = canSeller ? 'vendedor' : 'usuario';
        localStorage.setItem('rolActual', this.rolActual);
        localStorage.setItem('esVendedor', canSeller ? 'true' : 'false');
      }
    } else {
      if (canManager) {
        this.rolActual = 'gestor';
        localStorage.setItem('rolActual', 'gestor');
        localStorage.setItem('esVendedor', 'false');
      } else if (canSeller) {
        this.rolActual = 'vendedor';
        localStorage.setItem('rolActual', 'vendedor');
        localStorage.setItem('esVendedor', 'true');
      } else {
        this.rolActual = 'usuario';
        localStorage.setItem('rolActual', 'usuario');
        localStorage.setItem('esVendedor', 'false');
      }
    }

    this.redirigirSiRutaNoCorrespondeAlPerfil();
  }

  /**
   * Si estás logueado como vendedor no puedes ver tabs de usuario y viceversa.
   */
  private redirigirSiRutaNoCorrespondeAlPerfil() {
    if (!this.authService.isLoggedIn()) return;

    const ruta = this.router.url;
    const enTabUsuario = /\/tabs\/(tab[1-5])(?:\/|$)/.test(ruta);
    const enTabVendedor = /\/tabs\/vendedor-tab/.test(ruta);
    const enTabGestor = /\/tabs\/gestor-tab/.test(ruta);

    if (this.rolActual === 'vendedor' && enTabUsuario) {
      this.router.navigate(['/tabs/vendedor-tab3'], { replaceUrl: true });
      return;
    }
    if (this.rolActual === 'usuario' && (enTabVendedor || enTabGestor)) {
      this.router.navigate(['/tabs/tab3'], { replaceUrl: true });
      return;
    }
    if (this.rolActual === 'gestor' && (enTabUsuario || enTabVendedor)) {
      this.router.navigate(['/tabs/gestor-tab3'], { replaceUrl: true });
      return;
    }
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
    void this.roleSwitchService.confirmRoleChange(rol, this.rolActual, () => {
      this.rolActual = rol;
      localStorage.setItem('rolActual', rol);

      if (rol === 'vendedor') {
        localStorage.setItem('esVendedor', 'true');
        this.router.navigate(['/tabs/vendedor-tab3']);
      } else if (rol === 'usuario') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/tab3']);
      } else if (rol === 'gestor') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/gestor-tab3']);
      }
    });
  }

  esVendedor(): boolean {
    return this.rolActual === 'vendedor';
  }

  esGestor(): boolean {
    return this.rolActual === 'gestor';
  }

  /** Solo mostrar opción Vendedor si está en tabla sellers. */
  puedeVerVendedor(): boolean {
    return this.authService.canSeller();
  }

  /** Solo mostrar opción Gestor si está en tabla managers. */
  puedeVerGestor(): boolean {
    return this.authService.canManager();
  }

}
