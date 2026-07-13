import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';

@Component({
  selector: 'app-gestor-home',
  templateUrl: './gestor-home.page.html',
  styleUrls: ['./gestor-home.page.scss'],
  standalone: false,
})
export class GestorHomePage implements OnInit {

  constructor(
    private router: Router,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) { }

  ngOnInit() {
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
    void this.roleSwitchService.confirmRoleChange(rol, 'gestor', () => {
      localStorage.setItem('rolActual', rol);

      if (rol === 'usuario') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/tab3']);
      } else if (rol === 'vendedor') {
        localStorage.setItem('esVendedor', 'true');
        this.router.navigate(['/tabs/vendedor-tab3']);
      }
    });
  }

  verTutoriales() {
    // TODO: Navegar a tutoriales
    console.log('Ver tutoriales');
  }

  irAParticipaciones() {
    this.router.navigate(['/tabs/gestor-tab1']);
  }

  irAVendedores() {
    this.router.navigate(['/tabs/gestor-tab2']);
  }

  irADevolucion() {
    this.router.navigate(['/tabs/gestor-tab4']);
  }

  irAPago() {
    this.router.navigate(['/tabs/gestor-tab5']);
  }

}

