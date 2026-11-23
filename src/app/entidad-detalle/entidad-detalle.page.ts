import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';

/**
 * La adquisición de participaciones de Lotería Social ya no se hace en la app.
 * Cualquier deep link antiguo redirige a la pantalla informativa con «Juega aquí».
 */
@Component({
  selector: 'app-entidad-detalle',
  template: '',
  standalone: false,
})
export class EntidadDetallePage implements OnInit {
  constructor(private router: Router) {}

  ngOnInit() {
    this.router.navigate(['/loteria-social'], { replaceUrl: true });
  }
}
