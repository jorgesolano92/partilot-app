import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { VentasService } from '../core/services/ventas.service';
import { AuthService } from '../core/services/auth.service';
import { extractParticipationNumber } from '../core/utils/participation-input.util';

@Component({
  selector: 'app-venta-manual',
  templateUrl: './venta-manual.page.html',
  styleUrls: ['./venta-manual.page.scss'],
  standalone: false,
})
export class VentaManualPage implements OnInit {

  tipoParticipacion: 'fisicas' | 'digitales' = 'fisicas';
  numeroSorteo: string = '';
  
  // Reserva y Set (para API)
  reserves: any[] = [];
  sets: any[] = [];
  reserveSeleccionado: any = null;
  setSeleccionado: any = null;
  
  // Para participaciones físicas
  participacionUnidad: string = '';
  rangoDesde: string = '';
  rangoHasta: string = '';
  
  // Para participaciones digitales
  numeroParticipaciones: number = 1;
  disponibilidad: number = 120;
  
  // Modal de resumen
  mostrarModalResumen: boolean = false;
  totalParticipaciones: number = 0;
  importeTotal: number = 0;
  formaPago: 'efectivo' | 'bizum' | 'transferencia' | 'omitir' | null = null;
  
  // Modal de éxito
  mostrarModalExito: boolean = false;
  
  precioPorParticipacion: number = 0;
  loading = false;

  constructor(
    private router: Router,
    private alertController: AlertController,
    private ventasService: VentasService,
    public authService: AuthService
  ) { }

  ngOnInit() {
    this.cargarReserves();
  }

  cargarReserves() {
    this.ventasService.getReserves().subscribe({
      next: (res: any) => {
        if (res.success && res.reserves) {
          this.reserves = res.reserves;
          if (this.reserves.length === 1) {
            this.reserveSeleccionado = this.reserves[0];
            this.onReserveChange();
          }
        }
      },
      error: () => {
        this.reserves = [];
      }
    });
  }

  onReserveChange() {
    if (this.reserveSeleccionado?.sets) {
      const all = this.reserveSeleccionado.sets as any[];
      if (this.tipoParticipacion === 'digitales') {
        this.sets = all.filter((s) => {
          const dig = Number(s.digital_participations ?? 0);
          const phys = Number(s.physical_participations ?? 0);
          return dig > 0 && phys === 0;
        });
      } else {
        this.sets = all.filter((s) => {
          const phys = Number(s.physical_participations ?? 0);
          const dig = Number(s.digital_participations ?? 0);
          return phys > 0 && dig === 0;
        });
      }
      this.setSeleccionado = this.sets.length === 1 ? this.sets[0] : null;
      this.numeroSorteo = this.reserveSeleccionado?.lottery?.name || '';
      if (this.setSeleccionado) {
        this.precioPorParticipacion = parseFloat(this.setSeleccionado.played_amount) || 0;
        this.actualizarDisponibilidadDigital();
      }
    } else {
      this.sets = [];
      this.setSeleccionado = null;
    }
  }

  onSetChange() {
    if (this.setSeleccionado) {
      this.precioPorParticipacion = parseFloat(this.setSeleccionado.played_amount) || 0;
      this.actualizarDisponibilidadDigital();
    }
  }

  private actualizarDisponibilidadDigital() {
    if (this.tipoParticipacion === 'digitales' && this.setSeleccionado) {
      this.disponibilidad = Number(this.setSeleccionado.digital_available_to_seller ?? this.setSeleccionado.digital_participations ?? 0) || 0;
    }
  }

  cambiarRol(rol: string) {
    if (rol === 'usuario') {
      localStorage.setItem('rolActual', 'usuario');
      localStorage.setItem('esVendedor', 'false');
      // Siempre navegar a la home de usuario
      this.router.navigate(['/tabs/tab3']);
    } else if (rol === 'gestor') {
      localStorage.setItem('rolActual', 'gestor');
      localStorage.setItem('esVendedor', 'false');
      // Siempre navegar a la home de gestor dentro de tabs
      this.router.navigate(['/tabs/gestor-tab3']);
    }
  }

  cambiarTipoParticipacion() {
    this.participacionUnidad = '';
    this.rangoDesde = '';
    this.rangoHasta = '';
    this.numeroParticipaciones = 1;
    this.onReserveChange();
    this.actualizarDisponibilidadDigital();
  }

  escanearQR() {
    this.router.navigate(['/venta-qr']);
  }

  disminuirParticipaciones() {
    if (this.numeroParticipaciones > 1) {
      this.numeroParticipaciones--;
      this.validarVenta();
    }
  }

  aumentarParticipaciones() {
    if (this.numeroParticipaciones < this.disponibilidad) {
      this.numeroParticipaciones++;
      this.validarVenta();
    }
  }

  validarVenta() {
    // Validación se hace en puedeVender()
  }

  puedeVender(): boolean {
    if (this.tipoParticipacion === 'fisicas') {
      return !!(this.setSeleccionado && (this.participacionUnidad || (this.rangoDesde && this.rangoHasta)));
    }
    return this.numeroParticipaciones > 0 && this.numeroParticipaciones <= this.disponibilidad;
  }

  calcularTotalParticipaciones(): number {
    if (this.tipoParticipacion === 'fisicas') {
      if (this.participacionUnidad) {
        return 1;
      } else if (this.rangoDesde && this.rangoHasta) {
        // Extraer números del rango (ej: "1/0001" -> 1, "1/0005" -> 5)
        const desde = extractParticipationNumber(this.rangoDesde);
        const hasta = extractParticipationNumber(this.rangoHasta);
        return hasta - desde + 1;
      }
      return 0;
    } else {
      return this.numeroParticipaciones;
    }
  }

  mostrarResumen() {
    this.totalParticipaciones = this.calcularTotalParticipaciones();
    this.importeTotal = this.totalParticipaciones * this.precioPorParticipacion;
    this.formaPago = null;
    this.mostrarModalResumen = true;
  }

  cerrarModalResumen() {
    this.mostrarModalResumen = false;
  }

  seleccionarFormaPago(forma: 'efectivo' | 'bizum' | 'transferencia' | 'omitir') {
    this.formaPago = forma;
  }

  async registrarVenta() {
    if (!this.formaPago) {
      await this.mostrarAlerta('Atención', 'Por favor selecciona una forma de pago');
      return;
    }

    if (this.tipoParticipacion !== 'fisicas' || !this.setSeleccionado) {
      await this.mostrarAlerta('Error', 'Selecciona un sorteo y set válidos.');
      return;
    }

    let desde: number;
    let hasta: number;
    if (this.participacionUnidad) {
      desde = hasta = extractParticipationNumber(this.participacionUnidad);
    } else if (this.rangoDesde && this.rangoHasta) {
      desde = extractParticipationNumber(this.rangoDesde);
      hasta = extractParticipationNumber(this.rangoHasta);
      if (desde > hasta) {
        await this.mostrarAlerta('Error', 'El rango desde no puede ser mayor que hasta.');
        return;
      }
    } else {
      await this.mostrarAlerta('Error', 'Indica participación o rango.');
      return;
    }

    this.loading = true;
    const paymentMethod = this.formaPago === 'omitir' ? null : this.formaPago;
    this.ventasService.sellManual(this.setSeleccionado.id, desde, hasta, paymentMethod).subscribe({
      next: async (res: any) => {
        this.loading = false;
        if (res.success) {
          this.guardarVentaEnHistorial(res, desde, hasta);
          this.ventasService.notifyVentasChanged();
          this.cerrarModalResumen();
          this.mostrarModalExito = true;
        } else {
          await this.mostrarAlerta('Error', res.message || 'No se pudo registrar la venta.');
        }
      },
      error: async (err) => {
        this.loading = false;
        const msg = err.error?.message || 'Error de conexión. Intenta de nuevo.';
        await this.mostrarAlerta('Error', msg);
      }
    });
  }

  guardarVentaEnHistorial(res: any, desde: number, hasta: number): void {
    const lottery = this.reserveSeleccionado?.lottery;
    const entidad = this.reserveSeleccionado?.entity?.name || lottery?.name || '—';
    const drawDate = lottery?.draw_date
      ? new Date(lottery.draw_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '—';
    const donativo = parseFloat(this.setSeleccionado?.donation_amount) || 0;
    const numeroDisplay = this.participacionUnidad || `${this.rangoDesde} - ${this.rangoHasta}`;
    const participacion = res.participation || res.sale || {};
    const historial = JSON.parse(localStorage.getItem('historial') || '[]');
    historial.unshift({
      id: Date.now(),
      tipo: 'venta',
      fecha: new Date().toISOString(),
      formaPago: this.formaPago === 'omitir' ? null : this.formaPago,
      descripcion: `Participación ${entidad}`,
      participacion: {
        entidad,
        numero: participacion.participation_code || participacion.numero || numeroDisplay,
        fechaSorteo: drawDate,
        importeJugado: this.precioPorParticipacion,
        donativo: donativo > 0 ? donativo : undefined,
        importeTotal: this.importeTotal,
        numeroParticipacion: participacion.participation_code || this.participacionUnidad || `${desde}/${hasta}`,
        numeroReferencia: participacion.reference || participacion.numero_referencia || '0000000000000000000',
        imagen: participacion.image || null
      }
    });
    localStorage.setItem('historial', JSON.stringify(historial));
  }

  cerrarModalExito() {
    this.mostrarModalExito = false;
    // Limpiar formulario
    this.participacionUnidad = '';
    this.rangoDesde = '';
    this.rangoHasta = '';
    this.numeroParticipaciones = 1;
  }

  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

}
