import { Component, OnInit } from '@angular/core';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-movimientos',
  templateUrl: './movimientos.page.html',
  styleUrls: ['./movimientos.page.scss'],
  standalone: false,
})
export class MovimientosPage implements OnInit {

  movimientos: any[] = [];
  movimientosFiltrados: any[] = [];
  filtroTipo: string = 'todos';
  totalIngresos: number = 0;
  totalGastos: number = 0;
  balance: number = 0;

  constructor(public authService: AuthService) { }

  ngOnInit() {
    this.cargarMovimientos();
    this.filtrarMovimientos();
  }

  cargarMovimientos() {
    try {
      // Cargar movimientos del localStorage o servicio
      const movimientosGuardados = JSON.parse(localStorage.getItem('movimientos') || '[]');
      
      if (movimientosGuardados.length > 0) {
        this.movimientos = movimientosGuardados;
      } else {
        // Datos de ejemplo para desarrollo
        this.movimientos = [
          {
            id: 1,
            tipo: 'ingreso',
            concepto: 'Cobro de participación ganadora',
            monto: 150.00,
            fecha: new Date('2024-01-15T10:30:00'),
            detalle: 'Participación #12345 - 3 números acertados'
          },
          {
            id: 2,
            tipo: 'gasto',
            concepto: 'Compra de participación',
            monto: 5.00,
            fecha: new Date('2024-01-16T14:20:00'),
            detalle: 'Participación #12346'
          },
          {
            id: 3,
            tipo: 'ingreso',
            concepto: 'Reembolso',
            monto: 10.00,
            fecha: new Date('2024-01-17T09:15:00'),
            detalle: 'Reembolso de participación cancelada'
          }
        ];
        localStorage.setItem('movimientos', JSON.stringify(this.movimientos));
      }

      this.calcularResumen();
    } catch (error) {
      console.error('Error cargando movimientos:', error);
      this.movimientos = [];
    }
  }

  calcularResumen() {
    this.totalIngresos = this.movimientos
      .filter(m => m.tipo === 'ingreso')
      .reduce((sum, m) => sum + m.monto, 0);
    
    this.totalGastos = this.movimientos
      .filter(m => m.tipo === 'gasto')
      .reduce((sum, m) => sum + m.monto, 0);
    
    this.balance = this.totalIngresos - this.totalGastos;
  }

  filtrarMovimientos() {
    if (this.filtroTipo === 'todos') {
      this.movimientosFiltrados = this.movimientos;
    } else {
      const tipoFiltro = this.filtroTipo === 'ingresos' ? 'ingreso' : 'gasto';
      this.movimientosFiltrados = this.movimientos.filter(m => m.tipo === tipoFiltro);
    }
    
    // Ordenar por fecha (más recientes primero)
    this.movimientosFiltrados.sort((a, b) => {
      return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
    });
  }


}
