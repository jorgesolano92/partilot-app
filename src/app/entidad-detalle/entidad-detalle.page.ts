import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';

@Component({
  selector: 'app-entidad-detalle',
  templateUrl: './entidad-detalle.page.html',
  styleUrls: ['./entidad-detalle.page.scss'],
  standalone: false,
})
export class EntidadDetallePage implements OnInit {

  entidad: any = null;
  numeroParticipaciones: number = 1;
  disponibilidad: number = 120;
  mostrarModalExito: boolean = false;
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alertController: AlertController,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) { }

  ngOnInit() {
    this.detectarRol();
    this.route.params.subscribe(params => {
      const entidadId = params['id'] ? parseInt(params['id']) : null;
      this.cargarEntidad(entidadId);
    });
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

  cargarEntidad(id: number | null) {
    if (!id) {
      this.router.navigate(['/loteria-social']);
      return;
    }

    // Datos de ejemplo - en producción vendría de un servicio
    const entidades = [
      { id: 1, codigo: 'AB125135', nombre: 'Peña Rondalosa', imagen: null, disponibilidad: 120 },
      { id: 2, codigo: 'CS001', nombre: 'CSIF-Rioja', imagen: null, disponibilidad: 80 },
    ];

    this.entidad = entidades.find(e => e.id === id);
    
    if (!this.entidad) {
      this.router.navigate(['/loteria-social']);
      return;
    }

    this.disponibilidad = this.entidad.disponibilidad || 120;
  }

  disminuirParticipaciones() {
    if (this.numeroParticipaciones > 1) {
      this.numeroParticipaciones--;
    }
  }

  aumentarParticipaciones() {
    if (this.numeroParticipaciones < this.disponibilidad) {
      this.numeroParticipaciones++;
    }
  }

  async comprar() {
    // Simular compra
    const participacion = {
      id: Date.now(),
      numero: '60089',
      entidad: this.entidad.nombre,
      fechaSorteo: '22/12/25',
      importeTotal: 5.00 * this.numeroParticipaciones,
      cantidad: this.numeroParticipaciones,
      estado: 'activa',
      fechaCompra: new Date().toISOString()
    };

    // Guardar en localStorage
    const participaciones = JSON.parse(localStorage.getItem('participaciones') || '[]');
    participaciones.push(participacion);
    localStorage.setItem('participaciones', JSON.stringify(participaciones));

    // Mostrar modal de éxito
    this.mostrarModalExito = true;
  }

  cerrarModalExito() {
    this.mostrarModalExito = false;
    this.router.navigate(['/loteria-social']);
  }

}

