import { Component, OnInit } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-cuenta-cobro',
  templateUrl: './cuenta-cobro.page.html',
  styleUrls: ['./cuenta-cobro.page.scss'],
  standalone: false,
})
export class CuentaCobroPage implements OnInit {

  cobros: any[] = [];
  cobrosFiltrados: any[] = [];
  filtroEstado: string = 'todos';
  totalVendido: number = 0;
  totalCobrado: number = 0;
  totalPendiente: number = 0;
  balanceDisponible: number = 0;

  constructor(
    private alertController: AlertController,
    public authService: AuthService
  ) { }

  ngOnInit() {
    this.cargarCobros();
  }

  ionViewWillEnter() {
    this.cargarCobros();
  }

  cargarCobros() {
    try {
      const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
      
      // Convertir ventas a cobros
      this.cobros = ventas.map((venta: any) => ({
        id: venta.id,
        ventaId: venta.id,
        fecha: venta.fecha,
        cliente: venta.cliente,
        monto: venta.monto,
        metodoPago: venta.metodoPago || 'Efectivo',
        estado: venta.estado === 'pagado' ? 'cobrado' : 'pendiente',
        fechaCobro: venta.estado === 'pagado' ? venta.fecha : null
      }));

      // Si no hay cobros, agregar datos de ejemplo
      if (this.cobros.length === 0) {
        this.cobros = [
          {
            id: 1,
            ventaId: 1,
            fecha: new Date('2024-01-17T10:30:00'),
            cliente: 'Juan Pérez',
            monto: 5.00,
            metodoPago: 'Efectivo',
            estado: 'cobrado',
            fechaCobro: new Date('2024-01-17T10:30:00')
          },
          {
            id: 2,
            ventaId: 2,
            fecha: new Date('2024-01-17T09:15:00'),
            cliente: 'María García',
            monto: 10.00,
            metodoPago: 'Tarjeta',
            estado: 'pendiente',
            fechaCobro: null
          }
        ];
      }

      this.calcularResumen();
      this.filtrarCobros();
    } catch (error) {
      console.error('Error cargando cobros:', error);
      this.cobros = [];
    }
  }

  calcularResumen() {
    this.totalVendido = this.cobros.reduce((sum, c) => sum + c.monto, 0);
    this.totalCobrado = this.cobros
      .filter(c => c.estado === 'cobrado')
      .reduce((sum, c) => sum + c.monto, 0);
    this.totalPendiente = this.cobros
      .filter(c => c.estado === 'pendiente')
      .reduce((sum, c) => sum + c.monto, 0);
    this.balanceDisponible = this.totalCobrado;
  }

  filtrarCobros() {
    if (this.filtroEstado === 'todos') {
      this.cobrosFiltrados = this.cobros;
    } else if (this.filtroEstado === 'cobrados') {
      this.cobrosFiltrados = this.cobros.filter(c => c.estado === 'cobrado');
    } else {
      this.cobrosFiltrados = this.cobros.filter(c => c.estado === 'pendiente');
    }

    // Ordenar por fecha (más recientes primero)
    this.cobrosFiltrados.sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }

  async marcarComoCobrado(cobro: any) {
    const alert = await this.alertController.create({
      header: 'Confirmar cobro',
      message: `¿Marcar como cobrado el pago de €${cobro.monto.toFixed(2)}?`,
      buttons: [
        {
          text: 'Cancelar',
          role: 'cancel'
        },
        {
          text: 'Confirmar',
          handler: () => {
            cobro.estado = 'cobrado';
            cobro.fechaCobro = new Date().toISOString();
            
            // Actualizar en localStorage
            const ventas = JSON.parse(localStorage.getItem('ventas') || '[]');
            const index = ventas.findIndex((v: any) => v.id === cobro.ventaId);
            if (index !== -1) {
              ventas[index].estado = 'pagado';
              localStorage.setItem('ventas', JSON.stringify(ventas));
            }

            this.calcularResumen();
            this.filtrarCobros();
          }
        }
      ]
    });
    await alert.present();
  }

}
