import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';

@Component({
  selector: 'app-tab3',
  templateUrl: 'tab3.page.html',
  styleUrls: ['tab3.page.scss'],
  standalone: false,
})
export class Tab3Page {

  constructor(
    private router: Router,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) {}

  verTutoriales() {
    // TODO: Navegar a tutoriales
    console.log('Ver tutoriales');
  }

  irACartera() {
    this.router.navigate(['/tabs/tab1']);
  }

  irAEscaner() {
    this.router.navigate(['/tabs/tab5']);
  }

  irALoteriaSocial() {
    this.router.navigate(['/loteria-social']);
  }

  cambiarAVendedor() {
    void this.roleSwitchService.confirmRoleChange('vendedor', 'usuario', () => {
      localStorage.setItem('rolActual', 'vendedor');
      localStorage.setItem('esVendedor', 'true');
      this.router.navigate(['/tabs/vendedor-tab3']);
    });
  }

  cambiarAGestor() {
    void this.roleSwitchService.confirmRoleChange('gestor', 'usuario', () => {
      localStorage.setItem('rolActual', 'gestor');
      localStorage.setItem('esVendedor', 'false');
      this.router.navigate(['/tabs/gestor-tab3']);
    });
  }

}
