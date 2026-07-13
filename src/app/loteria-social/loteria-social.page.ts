import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';

@Component({
  selector: 'app-loteria-social',
  templateUrl: './loteria-social.page.html',
  styleUrls: ['./loteria-social.page.scss'],
  standalone: false,
})
export class LoteriaSocialPage implements OnInit {

  codigoEntidad: string = '';
  busquedaEntidad: string = '';
  entidades: any[] = [];
  entidadesFiltradas: any[] = [];
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';

  constructor(
    private router: Router,
    private alertController: AlertController,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) { }

  ngOnInit() {
    this.detectarRol();
    this.cargarEntidades();
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

  cargarEntidades() {
    // Datos de ejemplo de entidades
    this.entidades = [
      { id: 1, codigo: 'AB125135', nombre: 'Peña Rondalosa', imagen: null },
      { id: 2, codigo: 'CS001', nombre: 'CSIF-Rioja', imagen: null },
      { id: 3, codigo: 'ENT003', nombre: 'Entidad 3', imagen: null },
      { id: 4, codigo: 'ENT004', nombre: 'Entidad 4', imagen: null },
      { id: 5, codigo: 'ENT005', nombre: 'Entidad 5', imagen: null },
      { id: 6, codigo: 'ENT006', nombre: 'Entidad 6', imagen: null },
      { id: 7, codigo: 'ENT007', nombre: 'Entidad 7', imagen: null },
      { id: 8, codigo: 'ENT008', nombre: 'Entidad 8', imagen: null },
      { id: 9, codigo: 'ENT009', nombre: 'Entidad 9', imagen: null },
      { id: 10, codigo: 'ENT010', nombre: 'Entidad 10', imagen: null },
      { id: 11, codigo: 'ENT011', nombre: 'Entidad 11', imagen: null },
      { id: 12, codigo: 'ENT012', nombre: 'Entidad 12', imagen: null }
    ];
    this.entidadesFiltradas = [...this.entidades];
  }

  buscarEntidades() {
    if (!this.busquedaEntidad || this.busquedaEntidad.trim() === '') {
      this.entidadesFiltradas = [...this.entidades];
    } else {
      const busqueda = this.busquedaEntidad.toLowerCase().trim();
      this.entidadesFiltradas = this.entidades.filter(entidad =>
        entidad.nombre.toLowerCase().includes(busqueda) ||
        entidad.codigo.toLowerCase().includes(busqueda)
      );
    }
  }

  getPlaceholders(): number[] {
    const entidadesVisibles = this.entidadesFiltradas.length;
    const totalSlots = 12;
    const placeholdersNecesarios = Math.max(0, totalSlots - entidadesVisibles);
    return Array(placeholdersNecesarios).fill(0).map((_, i) => i);
  }

  async entrarConCodigo() {
    if (!this.codigoEntidad || this.codigoEntidad.trim() === '') {
      return;
    }

    const codigo = this.codigoEntidad.trim().toUpperCase();
    const entidad = this.entidades.find(e => e.codigo.toUpperCase() === codigo);

    if (entidad) {
      this.router.navigate(['/entidad-detalle', entidad.id]);
    } else {
      const alert = await this.alertController.create({
        header: 'Código no encontrado',
        message: 'No se encontró ninguna entidad con ese código.',
        buttons: ['OK']
      });
      await alert.present();
    }
  }

  irAEntidad(entidad: any) {
    this.router.navigate(['/entidad-detalle', entidad.id]);
  }

}
