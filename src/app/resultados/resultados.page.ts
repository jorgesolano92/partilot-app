import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { LotteryService } from '../core/services/lottery.service';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import { refreshWithLoadingWatch } from '../core/utils/ion-refresher.util';

@Component({
  selector: 'app-resultados',
  templateUrl: './resultados.page.html',
  styleUrls: ['./resultados.page.scss'],
  standalone: false,
})
export class ResultadosPage implements OnInit {

  resultados: any[] = [];
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';
  loading = false;
  resultadoExpandidoId: number | null = null;
  mostrarModalPedreas = false;
  pedreasParaModal: string[] | null = null;
  nombreSorteoPedreas = '';

  constructor(
    private router: Router,
    private lotteryService: LotteryService,
    public authService: AuthService,
    private roleSwitchService: RoleSwitchService
  ) { }

  ngOnInit() {
    this.detectarRol();
    this.loadResultados();
  }

  ionViewWillEnter() {
    this.detectarRol();
    this.loadResultados();
  }

  handleRefresh(event: CustomEvent): void {
    refreshWithLoadingWatch(event, () => this.loading, () => this.loadResultados());
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

  async loadResultados() {
    this.loading = true;
    try {
      this.lotteryService.getResults().subscribe({
        next: (lotteries: any[]) => {
          this.resultados = lotteries.map((lottery: any) => {
            // Extraer información de los resultados
            const resultado = lottery.result || {};
            
            // Formatear fecha
            const fechaSorteo = lottery.draw_date 
              ? new Date(lottery.draw_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
              : '--/--/--';

            // Extraer números de premios (pueden venir como arrays JSON u objeto)
            let primerPremio = this.extraerPrimerValor(resultado?.primer_premio);
            let segundoPremio = this.extraerPrimerValor(resultado?.segundo_premio);
            let tercerPremio = null;
            
            if (resultado?.terceros_premios && Array.isArray(resultado.terceros_premios) && resultado.terceros_premios.length > 0) {
              tercerPremio = resultado.terceros_premios[0]?.decimo || resultado.terceros_premios[0]?.numero || resultado.terceros_premios[0];
            }
            
            // Extraer reintegros (pueden venir como array de objetos con 'decimo')
            let extracciones: string[] = [];
            if (resultado?.reintegros) {
              if (Array.isArray(resultado.reintegros)) {
                extracciones = resultado.reintegros
                  .map((r: any) => r?.decimo || r?.numero || r)
                  .filter((n: any) => n !== null && n !== undefined)
                  .map((n: any) => n.toString());
              } else if (typeof resultado.reintegros === 'string') {
                extracciones = resultado.reintegros.split('-').map((n: string) => n.trim()).filter((n: string) => n);
              }
            }

            // Extraer fracción y serie si existen (pueden estar en el primer premio)
            let fraccion = null;
            let serie = null;
            if (resultado?.primer_premio && Array.isArray(resultado.primer_premio) && resultado.primer_premio.length > 0) {
              fraccion = resultado.primer_premio[0]?.fraccion || null;
              serie = resultado.primer_premio[0]?.serie || null;
            }

            // Listas para el detalle: premios formateados (1º-5º); extracciones tal cual vienen del décimo en BD (sin quitar ceros)
            const tercerosPremiosLista = this.extraerNumeros(resultado?.terceros_premios).map(n => this.formatearNumero(n));
            const cuartosPremiosLista = this.extraerNumeros(resultado?.cuartos_premios).map(n => this.formatearNumero(n));
            const quintosPremiosLista = this.extraerNumeros(resultado?.quintos_premios).map(n => this.formatearNumero(n));
            const extracciones5Lista = this.extraerNumeros(resultado?.extracciones_cinco_cifras);
            const extracciones4Lista = this.extraerNumeros(resultado?.extracciones_cuatro_cifras);
            const extracciones3Lista = this.extraerNumeros(resultado?.extracciones_tres_cifras);
            const extracciones2Lista = this.extraerNumeros(resultado?.extracciones_dos_cifras);
            let premioEspecialStr: string | null = null;
            if (resultado?.premio_especial) {
              if (Array.isArray(resultado.premio_especial) && resultado.premio_especial.length > 0) {
                const p = resultado.premio_especial[0];
                const val = p?.decimo ?? p?.numero ?? p;
                premioEspecialStr = val != null ? this.formatearNumero(val) : null;
              } else if (typeof resultado.premio_especial === 'string') {
                premioEspecialStr = resultado.premio_especial;
              }
            }
            const pedreasLista = this.extraerNumeros(resultado?.pedreas);

            // Formatear nombre del sorteo (extraer número del name)
            const nombreCompleto = lottery.name || '';
            const numeroSorteo = nombreCompleto.split('/')[0] || lottery.id?.toString() || '';
            const anio = nombreCompleto.split('/')[1] || new Date(lottery.draw_date).getFullYear().toString().slice(-2) || '';

            return {
              id: lottery.id,
              numero: numeroSorteo,
              anio: anio,
              fecha: fechaSorteo,
              fechaCompleta: lottery.draw_date,
              primerPremio: primerPremio ? this.formatearNumero(primerPremio) : null,
              segundoPremio: segundoPremio ? this.formatearNumero(segundoPremio) : null,
              tercerPremio: tercerPremio ? this.formatearNumero(tercerPremio) : null,
              extracciones: extracciones,
              fraccion: fraccion,
              serie: serie,
              tipoSorteo: lottery.lottery_type?.name || lottery.lotteryType?.name || '',
              nombreCompleto: nombreCompleto,
              expandido: false,
              todosLosResultados: resultado,
              // Listas para el detalle (todos los premios)
              tercerosPremiosLista,
              cuartosPremiosLista,
              quintosPremiosLista,
              extracciones5Lista,
              extracciones4Lista,
              extracciones3Lista,
              extracciones2Lista,
              premioEspecialStr,
              pedreasLista
            };
          });
          this.loading = false;
        },
        error: (error) => {
          console.error('Error cargando resultados:', error);
          this.resultados = [];
          this.loading = false;
        }
      });
    } catch (error) {
      console.error('Error cargando resultados:', error);
      this.resultados = [];
      this.loading = false;
    }
  }

  formatearNumero(numero: string | number): string {
    if (numero === null || numero === undefined) return '--.--';
    const numStr = numero.toString().trim().padStart(5, '0');
    if (numStr.length >= 5) {
      return `${numStr.slice(0, 2)}.${numStr.slice(2)}`;
    }
    return numStr;
  }

  /** Convierte array del backend (ej. [{decimo:'12345'}] ) en string[] */
  private extraerNumeros(arr: any): string[] {
    if (!arr || !Array.isArray(arr)) return [];
    return arr
      .map((r: any) => r?.decimo ?? r?.numero ?? r)
      .filter((n: any) => n !== null && n !== undefined)
      .map((n: any) => n.toString().trim());
  }

  /** Extrae el primer número de primer_premio o segundo_premio (array u objeto) */
  private extraerPrimerValor(val: any): string | null {
    if (val == null) return null;
    if (typeof val === 'string') return val.trim() || null;
    if (Array.isArray(val) && val.length > 0) {
      const first = val[0];
      if (typeof first === 'string') return first.trim() || null;
      return (first?.decimo ?? first?.numero ?? first) != null ? String(first.decimo ?? first.numero ?? first).trim() : null;
    }
    if (typeof val === 'object' && (val.decimo != null || val.numero != null)) {
      return String(val.decimo ?? val.numero).trim();
    }
    return null;
  }

  toggleDetalle(resultado: any) {
    const id = resultado.id;
    if (this.resultadoExpandidoId === id) {
      this.resultadoExpandidoId = null;
      resultado.expandido = false;
    } else {
      this.resultadoExpandidoId = id;
      resultado.expandido = true;
    }
  }

  estaExpandido(resultado: any): boolean {
    return this.resultadoExpandidoId === resultado.id;
  }

  abrirModalPedreas(resultado: any): void {
    this.nombreSorteoPedreas = resultado.nombreCompleto || (resultado.numero + '/' + resultado.anio) || 'Sorteo';
    this.pedreasParaModal = resultado.pedreasLista?.length ? [...resultado.pedreasLista] : [];
    this.mostrarModalPedreas = true;
  }

  cerrarModalPedreas(): void {
    this.mostrarModalPedreas = false;
    this.pedreasParaModal = null;
    this.nombreSorteoPedreas = '';
  }

}
