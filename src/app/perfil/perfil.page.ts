import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { environment } from '../../environments/environment';
import { BiometricService } from '../core/services/biometric.service';

@Component({
  selector: 'app-perfil',
  templateUrl: './perfil.page.html',
  styleUrls: ['./perfil.page.scss'],
  standalone: false,
})
export class PerfilPage implements OnInit {

  usuario: any = {};
  esVendedor: boolean = false;
  usuarioImagenUrl: string | null = null;
  biometricReady = false;
  biometricEnabled = false;
  biometricIcon = 'finger-print-outline';

  constructor(
    private router: Router,
    public authService: AuthService,
    private biometricService: BiometricService
  ) { }

  async ngOnInit() {
    const user = this.authService.getUser();
    if (user) {
      this.usuario = {
        nombre: user.name || user.nombre || 'Usuario',
        correo: user.email || user.correo || '',
        imagen: user.image || user.imagen || null
      };
      this.usuarioImagenUrl = this.buildUserImageUrl(this.usuario.imagen);
    } else {
      const usuarioStr = localStorage.getItem('usuario');
      if (usuarioStr) {
        this.usuario = JSON.parse(usuarioStr);
        this.usuarioImagenUrl = this.buildUserImageUrl(this.usuario?.imagen);
      }
    }
    
    this.esVendedor = this.authService.isSeller() || 
                      this.usuario?.tipo === 'vendedor' || 
                      this.usuario?.rol === 'vendedor';

    this.biometricReady = await this.biometricService.isBiometryAvailable();
    this.biometricEnabled = this.biometricService.isBiometricEnabled();
    this.biometricIcon = await this.biometricService.getBiometricIconName();
  }

  onBiometricToggle(ev: CustomEvent) {
    const enabled = !!ev.detail.checked;
    this.biometricEnabled = enabled;
    this.biometricService.setBiometricEnabled(enabled);
  }

  private buildUserImageUrl(path: string | null | undefined): string | null {
    if (!path) return null;
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const p = path.startsWith('/') ? path.slice(1) : path;
    return p ? `${base}/${p}` : null;
  }

  onUserImageError() {
    this.usuarioImagenUrl = null;
  }

  goToDigitalizarParticipacion() {
    this.router.navigate(['/tabs/digitalizar-participacion']);
  }

  goToRegalarParticipacion() {
    this.router.navigate(['/regalar-participacion']);
  }

  goToMovimientos() {
    this.router.navigate(['/movimientos']);
  }

  goToNotificaciones() {
    this.router.navigate(['/tabs/notificaciones']);
  }

  goToPreguntasFrecuentes() {
    this.router.navigate(['/preguntas-frecuentes']);
  }

  goToCondicionesLegales() {
    this.router.navigate(['/condiciones-legales']);
  }

  goToEliminarCuenta() {
    this.router.navigate(['/eliminar-cuenta']);
  }

  // Métodos para vendedor
  goToVendedor() {
    this.router.navigate(['/tabs/vendedor-tab3']);
  }

  goToVenta() {
    this.router.navigate(['/venta']);
  }

  goToGestorParticipaciones() {
    this.router.navigate(['/gestor-participaciones']);
  }

  goToCuentaCobro() {
    this.router.navigate(['/cuenta-cobro']);
  }

  goToConfigVenta() {
    this.router.navigate(['/config-venta']);
  }

}
