import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';

@Component({
  selector: 'app-vendedor',
  templateUrl: './vendedor.page.html',
  styleUrls: ['./vendedor.page.scss'],
  standalone: false,
})
export class VendedorPage implements OnInit {

  constructor(
    private router: Router,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) { }

  ngOnInit() {
  }

  cambiarRol(rol: string) {
    void this.roleSwitchService.confirmRoleChange(rol as 'usuario' | 'vendedor' | 'gestor', 'vendedor', () => {
      if (rol === 'usuario') {
        localStorage.setItem('rolActual', 'usuario');
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/tab3']);
      } else if (rol === 'gestor') {
        localStorage.setItem('rolActual', 'gestor');
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/gestor-tab3']);
      }
    });
  }

  verTutoriales() {
    // TODO: Navegar a tutoriales
    console.log('Ver tutoriales');
  }

  irAParticipaciones() {
    this.router.navigate(['/tabs/vendedor-tab4']);
  }

  irAEscaner() {
    this.router.navigate(['/tabs/vendedor-tab5']);
  }

  irAVenta() {
    this.router.navigate(['/tabs/vendedor-tab1']);
  }

}
