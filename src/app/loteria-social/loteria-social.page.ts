import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { ExternalLinkService } from '../core/services/external-link.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-loteria-social',
  templateUrl: './loteria-social.page.html',
  styleUrls: ['./loteria-social.page.scss'],
  standalone: false,
})
export class LoteriaSocialPage implements OnInit {
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';

  constructor(
    private router: Router,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService,
    private externalLinks: ExternalLinkService
  ) {}

  ngOnInit() {
    this.detectarRol();
  }

  ionViewWillEnter() {
    this.detectarRol();
  }

  detectarRol() {
    const rolGuardado = localStorage.getItem('rolActual');
    const esVendedorStr = localStorage.getItem('esVendedor');

    if (rolGuardado) {
      this.rolActual = rolGuardado as 'usuario' | 'vendedor' | 'gestor';
    } else if (esVendedorStr === 'true') {
      this.rolActual = 'vendedor';
    } else {
      this.rolActual = 'usuario';
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

  /** Abre la web de usuario en el navegador del móvil (fuera de la app). */
  jugarAqui(): void {
    const url = environment.loteriaSocialWebUrl || 'https://partilot.es';
    void this.externalLinks.open(url);
  }
}
