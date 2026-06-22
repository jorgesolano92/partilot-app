import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertModalService } from '../core/services/alert-modal.service';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { VentasService } from '../core/services/ventas.service';
import { CarteraService } from '../core/services/cartera.service';
import { BiometricService } from '../core/services/biometric.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-escaner',
  templateUrl: './escaner.page.html',
  styleUrls: ['./escaner.page.scss'],
  standalone: false,
})
export class EscanerPage implements OnInit {

  modoEscaneo: boolean = true;
  escaneando = false;
  ticketEscaneado: any = null;
  imagenTicket: string | null = null;
  
  // Modo vendedor: venta individual por QR (Tarea 2) o digitalización múltiple
  isVendedor: boolean = false;
  participacionesDigitalizadas: any[] = [];
  mostrarInfoDigitalizacion: boolean = false;

  /** Venta individual desde escáner (participación): escanear → consultar → detalle y set → modal pago → vender */
  ventaPendienteVendedor: {
    referencia: string;
    participacion: any;
    infoSet: { setName: string; lotteryName: string; participationNumber: number; importePorParticipacion: number };
  } | null = null;

  /** Venta por taco (QR portada): escanear taco_ref → taco-by-qr → rangos → modal pago → vender por rangos */
  ventaPendienteTaco: {
    tacoRef: string;
    set_name: string;
    lottery_name: string;
    lottery_date: string | null;
    book_number: number;
    rangos_disponibles: Array<{ desde: number; hasta: number }>;
    total_disponibles: number;
    importe_por_participacion: number;
    importe_total: number;
    primera_referencia: string | null;
  } | null = null;
  
  // Modal de resumen y pago
  mostrarModalResumen: boolean = false;
  formaPago: 'efectivo' | 'bizum' | 'transferencia' | 'omitir' | null = null;
  mostrarModalExito: boolean = false;

  // Modo usuario: datos de participación consultada
  participacion: any = null;
  status: 'can_link' | 'already_mine' | 'already_other' | 'not_found' | null = null;
  mensajeError = '';

  loading = false;
  loadingMessage = '';

  constructor(
    private router: Router,
    private alertModal: AlertModalService,
    public authService: AuthService,
    private ventasService: VentasService,
    private carteraService: CarteraService,
    private biometricService: BiometricService
  ) { }

  ngOnInit() {
    this.detectarModoDesdeRuta();
    this.modoEscaneo = true;
  }

  ionViewWillEnter() {
    this.detectarModoDesdeRuta();
  }

  ionViewDidEnter() {
    if (this.debeAutoEscanear()) {
      void this.scanQR();
    }
  }

  private debeAutoEscanear(): boolean {
    return this.modoEscaneo
      && !this.escaneando
      && !this.loading
      && !this.mostrarInfoDigitalizacion
      && !this.ventaPendienteVendedor
      && !this.ventaPendienteTaco
      && !this.ticketEscaneado;
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
    if (rol === 'usuario') {
      this.router.navigate(['/tabs/tab5'], { replaceUrl: true });
      return;
    }
    if (rol === 'vendedor') {
      this.router.navigate(['/tabs/vendedor-tab5'], { replaceUrl: true });
      return;
    }
    if (rol === 'gestor') {
      this.router.navigate(['/tabs/gestor-tab5'], { replaceUrl: true });
    }
  }

  isRolActivo(rol: 'usuario' | 'vendedor' | 'gestor'): boolean {
    const url = this.router.url || '';
    if (rol === 'usuario') return url.includes('/tabs/tab5');
    if (rol === 'vendedor') return url.includes('/tabs/vendedor-tab5');
    return url.includes('/tabs/gestor-tab5');
  }

  /** Modo según la pestaña actual: tab5 = usuario (digitalizar), vendedor-tab5 = vendedor (vender) */
  private detectarModoDesdeRuta() {
    const ruta = this.router.url;
    this.isVendedor = ruta.includes('vendedor-tab5');
  }

  async scanQR() {
    if (this.isVendedor) {
      // Modo vendedor: escáner para digitalización múltiple
      await this.iniciarScannerVendedor();
    } else {
      // Modo usuario: escáner normal
      await this.iniciarScannerUsuario();
    }
  }

  async iniciarScannerVendedor() {
    let mostrarVistaEscaneo = false;
    this.escaneando = true;
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el QR del taco o de la participación'
      });
      const qrText = result?.ScanResult?.trim() || null;
      if (!qrText) return;

      // Diferenciar: QR de taco (portada) vs QR de participación
      const tacoRef = this.extraerTacoRefDeQR(qrText);
      if (tacoRef) {
        this.modoEscaneo = false;
        this.consultarTacoPorQr(tacoRef);
        return;
      }
      const referencia = this.extraerReferenciaDeQR(qrText);
      if (referencia) {
        this.modoEscaneo = false;
        // Venta múltiple: acumular participaciones hasta pulsar "Vender"
        this.consultarYMostrarVentaIndividual(referencia);
      } else {
        mostrarVistaEscaneo = true;
        await this.mostrarAlerta('QR no reconocido', 'El código QR no corresponde a un taco ni a una participación válida.');
      }
    } catch (err: unknown) {
      console.error('Error escáner QR:', err);
      if (this.biometricService.isScanCancelled(err)) {
        mostrarVistaEscaneo = true;
        await this.mostrarAlerta('Información', this.biometricService.scanCancelMessage);
        return;
      }
      mostrarVistaEscaneo = true;
      await this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    } finally {
      this.escaneando = false;
      this.modoEscaneo = mostrarVistaEscaneo;
    }
  }

  /**
   * Detecta si el contenido del QR es un taco_ref (QR de la portada del taco).
   * Formato backend: TACO-{entity_id}-{set_id}-{set_number}-B{book_number}-{signature}
   */
  private extraerTacoRefDeQR(qrText: string | null): string | null {
    if (!qrText) return null;
    let value = qrText.trim();
    // Si viene en URL: ?taco_ref=TACO-... o similar
    if (value.includes('taco_ref=')) {
      const match = value.match(/taco_ref=([^&\s#]+)/);
      if (match) value = decodeURIComponent(match[1]).trim();
    }
    if (/^TACO-\d+-\d+-\d+-B\d+-[a-f0-9]{8}$/.test(value)) return value;
    return null;
  }

  /** Consultar taco por QR (portada): GET taco-by-qr → mostrar rangos e importe para venta por taco */
  private consultarTacoPorQr(tacoRef: string) {
    this.loading = true;
    this.loadingMessage = 'Consultando taco...';
    this.ventasService.getTacoByQr(tacoRef).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (!res?.success) {
          this.modoEscaneo = true;
          this.mostrarAlerta('Error', res?.message || 'No se pudo obtener la información del taco.');
          return;
        }
        if (res.total_disponibles === 0) {
          this.modoEscaneo = true;
          this.mostrarAlerta('Sin participaciones', res.message || 'No tienes participaciones disponibles en este taco.');
          return;
        }
        this.ventaPendienteTaco = {
          tacoRef,
          set_name: res.set_name || '',
          lottery_name: res.lottery_name || '',
          lottery_date: res.lottery_date ?? null,
          book_number: res.book_number ?? 0,
          rangos_disponibles: res.rangos_disponibles || [],
          total_disponibles: res.total_disponibles ?? 0,
          importe_por_participacion: res.importe_por_participacion ?? 0,
          importe_total: res.importe_total ?? 0,
          primera_referencia: res.primera_referencia ?? null
        };
      },
      error: async (err) => {
        this.loading = false;
        this.modoEscaneo = true;
        await this.mostrarAlerta('Error', err.error?.message || 'Error al consultar el taco.');
      }
    });
  }

  cancelarVentaTaco() {
    this.ventaPendienteTaco = null;
    this.modoEscaneo = true;
  }

  /**
   * Modo vendedor (tab5): consultar participación por referencia y AÑADIRLA a la lista para venta múltiple.
   * Permite escanear varias participaciones y venderlas juntas desde el resumen.
   */
  private consultarYMostrarVentaIndividual(referencia: string) {
    if (this.participacionesDigitalizadas.some(p => (p?.referencia || p?.reference) === referencia)) {
      this.mostrarInfoDigitalizacion = true;
      this.modoEscaneo = false;
      this.mostrarAlerta('Ya añadida', 'Esta participación ya está en la lista.');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Buscando participación...';
    this.carteraService.checkByReference(referencia).subscribe({
      next: (checkRes: any) => {
        this.loading = false;
        if (checkRes.status === 'not_found' || !checkRes.participation) {
          this.modoEscaneo = true;
          this.mostrarAlerta('Error', checkRes.message || 'No se encontró la participación con esa referencia.');
          return;
        }
        const participation = checkRes.participation;

        const item = {
          id: Date.now(),
          numero: participation?.participation_code || participation?.numero || referencia,
          referencia,
          entidad: participation?.entity_name || participation?.entidad || participation?.set?.reserve?.entity?.name || '',
          precio: participation?.amount ?? participation?.importeTotal ?? participation?.played_amount ?? 0,
          fechaSorteo: participation?.draw_date || participation?.fechaSorteo || '',
          imagen: participation?.image || participation?.snapshot_path || participation?.snapshotPath || null,
          scannedAt: new Date().toISOString(),
        };

        this.participacionesDigitalizadas.push(item);
        this.ventaPendienteVendedor = null;
        this.mostrarInfoDigitalizacion = true;
        this.modoEscaneo = false;
      },
      error: async (err) => {
        this.loading = false;
        this.modoEscaneo = true;
        await this.mostrarAlerta('Error', err.error?.message || 'Error al buscar la participación.');
      }
    });
  }

  /** Abre el modal de resumen para venta individual (1 participación) */
  mostrarResumenVentaIndividual() {
    this.formaPago = null;
    this.mostrarModalResumen = true;
  }

  /** Cancela la venta individual y vuelve al escáner */
  cancelarVentaIndividual() {
    this.ventaPendienteVendedor = null;
    this.modoEscaneo = true;
  }

  /** Getters para la vista de venta individual (mismo diseño que digitalizar-participacion) */
  getEntidadVentaIndividual(): string {
    if (!this.ventaPendienteVendedor?.participacion) return '—';
    const p = this.ventaPendienteVendedor.participacion;
    return p.entity_name || p.entidad || p.set?.reserve?.entity?.name || '—';
  }

  getImagenVentaIndividual(): string | null {
    if (!this.ventaPendienteVendedor?.participacion) return null;
    const p = this.ventaPendienteVendedor.participacion;
    const path = p.snapshot_path || p.snapshotPath || p.image;
    return path ? this.getImageUrl(path) : null;
  }

  getNumeroVentaIndividual(): string {
    if (!this.ventaPendienteVendedor) return '—';
    const p = this.ventaPendienteVendedor.participacion;
    return p?.numeroReservado || p?.participation_code || p?.numero || this.ventaPendienteVendedor.infoSet?.participationNumber?.toString() || '—';
  }

  getFechaSorteoVentaIndividual(): string {
    if (!this.ventaPendienteVendedor?.participacion) return '—';
    const d = this.ventaPendienteVendedor.participacion.draw_date || this.ventaPendienteVendedor.participacion.fechaSorteo;
    return d ? (typeof d === 'string' && d.includes('/') ? d : new Date(d).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })) : '—';
  }

  getImporteJugadoVentaIndividual(): number {
    if (!this.ventaPendienteVendedor?.participacion) return 0;
    const p = this.ventaPendienteVendedor.participacion;
    return p.played_amount ?? p.importeJugado ?? this.ventaPendienteVendedor.infoSet?.importePorParticipacion ?? 0;
  }

  getDonativoVentaIndividual(): number {
    if (!this.ventaPendienteVendedor?.participacion) return 0;
    const p = this.ventaPendienteVendedor.participacion;
    return p.donation_amount ?? p.donativo ?? 0;
  }

  getImporteTotalVentaIndividual(): number {
    if (!this.ventaPendienteVendedor) return 0;
    const p = this.ventaPendienteVendedor.participacion;
    return p?.amount ?? p?.importeTotal ?? this.ventaPendienteVendedor.infoSet?.importePorParticipacion ?? 0;
  }

  getNumeroParticipacionVentaIndividual(): string {
    if (!this.ventaPendienteVendedor) return '—';
    const p = this.ventaPendienteVendedor.participacion;
    const n = this.ventaPendienteVendedor.infoSet?.participationNumber;
    if (p?.numeroParticipacion) return p.numeroParticipacion;
    if (p?.participation_code) return p.participation_code;
    if (n != null) return `${n}/${String(n).padStart(4, '0')}`;
    return '—';
  }

  getReferenciaVentaIndividual(): string {
    return this.ventaPendienteVendedor?.referencia || this.ventaPendienteVendedor?.participacion?.reference || '0000000000000000000';
  }

  /** Cantidad e importe en el modal: venta individual (1), taco (N rangos) o múltiple (participacionesDigitalizadas) */
  getCantidadResumenVendedor(): number {
    if (this.ventaPendienteVendedor) return 1;
    if (this.ventaPendienteTaco) return this.ventaPendienteTaco.total_disponibles;
    return this.participacionesDigitalizadas.length;
  }

  getImporteTotalResumenVendedor(): number {
    if (this.ventaPendienteVendedor) {
      return this.ventaPendienteVendedor.infoSet.importePorParticipacion ?? 0;
    }
    if (this.ventaPendienteTaco) return this.ventaPendienteTaco.importe_total ?? 0;
    return this.calcularImporteTotal();
  }

  /** Registrar venta: desde modal, puede ser venta individual, taco (por rangos) o múltiple */
  async registrarVentaDesdeModal() {
    if (!this.formaPago) {
      await this.mostrarAlerta('Atención', 'Por favor selecciona una forma de pago.');
      return;
    }
    if (this.ventaPendienteTaco) {
      this.registrarVentaTaco();
    } else if (this.ventaPendienteVendedor) {
      this.registrarVentaIndividual();
    } else {
      await this.venderDigitalizaciones();
    }
  }

  /** Vender taco: una llamada sellByQr(primera_referencia, desde, hasta) por cada rango */
  private registrarVentaTaco() {
    if (!this.ventaPendienteTaco || !this.ventaPendienteTaco.primera_referencia) {
      this.mostrarAlerta('Error', 'Falta referencia para registrar la venta del taco.');
      return;
    }
    const paymentMethod = this.formaPago === 'omitir' ? null : this.formaPago;
    this.loading = true;
    this.loadingMessage = 'Registrando venta del taco...';
    const ref = this.ventaPendienteTaco.primera_referencia!;
    const rangos = this.ventaPendienteTaco.rangos_disponibles;
    let completed = 0;
    let totalCount = 0;
    const totalCalls = rangos.length;
    rangos.forEach((rango, index) => {
      this.ventasService.sellByQr(ref, rango.desde, rango.hasta, paymentMethod ?? undefined).subscribe({
        next: (res: any) => {
          if (res?.success && res?.count) totalCount += res.count;
          completed++;
          if (completed === totalCalls) {
            this.loading = false;
            this.finalizarVentaTaco(totalCount);
          }
        },
        error: async (err) => {
          completed++;
          if (completed === totalCalls) this.loading = false;
          await this.mostrarAlerta('Error', err.error?.message || 'Error al vender un rango del taco.');
          if (completed === totalCalls) this.cerrarModalResumen();
        }
      });
    });
    if (totalCalls === 0) {
      this.loading = false;
      this.cerrarModalResumen();
    }
  }

  private finalizarVentaTaco(count: number) {
    const formaPagoUsada = this.formaPago === 'omitir' ? null : this.formaPago;
    const taco = this.ventaPendienteTaco;
    this.ventaPendienteTaco = null;
    this.cerrarModalResumen();
    if (taco) this.guardarVentaTacoEnHistorial(taco, count, formaPagoUsada);
    this.ventasService.notifyVentasChanged();
    this.mostrarModalExito = true;
  }

  private guardarVentaTacoEnHistorial(t: NonNullable<typeof this.ventaPendienteTaco>, count: number, formaPagoUsada?: string | null): void {
    if (!t) return;
    const historial = JSON.parse(localStorage.getItem('historial') || '[]');
    historial.unshift({
      id: Date.now(),
      tipo: 'venta-taco',
      fecha: new Date().toISOString(),
      formaPago: formaPagoUsada ?? null,
      descripcion: `Taco ${t.set_name} (${t.lottery_name}) – ${count} participaciones`,
      taco: {
        set_name: t.set_name,
        lottery_name: t.lottery_name,
        book_number: t.book_number,
        cantidad: count,
        importe_total: t.importe_total
      }
    });
    localStorage.setItem('historial', JSON.stringify(historial));
  }

  /** Vender una sola participación (flujo escáner vendedor - Tarea 2) */
  private registrarVentaIndividual() {
    if (!this.ventaPendienteVendedor) return;
    const paymentMethod = this.formaPago === 'omitir' ? null : this.formaPago;
    this.loading = true;
    this.loadingMessage = 'Registrando venta...';
    this.ventasService.sellByQr(this.ventaPendienteVendedor.referencia, undefined, undefined, paymentMethod ?? undefined).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res?.success) {
          const formaPagoUsada = this.formaPago === 'omitir' ? null : this.formaPago;
          this.guardarVentaDigitalEnHistorial(res, this.ventaPendienteVendedor!.referencia, formaPagoUsada);
          this.ventaPendienteVendedor = null;
          this.cerrarModalResumen();
          this.ventasService.notifyVentasChanged();
          this.mostrarModalExito = true;
        } else {
          this.mostrarAlerta('Error', res.message || 'No se pudo registrar la venta.');
        }
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'Esta participación no está asignada a ti o ya está vendida.');
      }
    });
  }

  async iniciarScannerUsuario() {
    let mostrarVistaEscaneo = false;
    this.escaneando = true;
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el código QR de la participación'
      });
      const qrText = result?.ScanResult?.trim() || null;
      const referencia = this.extraerReferenciaDeQR(qrText);
      if (referencia) {
        this.modoEscaneo = false;
        this.consultarReferencia(referencia);
      } else if (qrText) {
        mostrarVistaEscaneo = true;
        await this.mostrarAlerta('QR no reconocido', 'El código QR no corresponde a una participación válida.');
      }
    } catch (err: unknown) {
      console.error('Error escáner QR:', err);
      if (this.biometricService.isScanCancelled(err)) {
        mostrarVistaEscaneo = true;
        await this.mostrarAlerta('Información', this.biometricService.scanCancelMessage);
        return;
      }
      mostrarVistaEscaneo = true;
      await this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    } finally {
      this.escaneando = false;
      this.modoEscaneo = mostrarVistaEscaneo;
    }
  }

  async consultarReferencia(referencia: string) {
    this.loading = true;
    this.loadingMessage = 'Buscando...';
    this.carteraService.checkByReference(referencia).subscribe({
      next: async (res: any) => {
        this.loading = false;
        this.participacion = res.participation || null;
        this.status = res.status || null;
        this.mensajeError = res.message || '';
        
        if (this.status === 'not_found' || this.status === 'already_other') {
          await this.mostrarAlerta(
            this.status === 'not_found' ? 'No encontrada' : 'No se puede vincular',
            this.mensajeError
          );
          this.participacion = null;
          this.status = null;
          this.modoEscaneo = true;
        } else {
          // Preparar datos para mostrar en la vista
          const p = this.participacion;
          this.ticketEscaneado = {
            numero: p?.participation_code || p?.numero || referencia,
            entidad: p?.entity_name || p?.entidad || p?.set?.reserve?.entity?.name || '—',
            fechaSorteo: p?.draw_date ? new Date(p.draw_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' }) : '—',
            importeJugado: p?.played_amount ?? p?.importeJugado ?? 0,
            donativo: p?.donation_amount ?? p?.donativo ?? 0,
            importeTotal: p?.amount ?? p?.importeTotal ?? 0,
            numeroParticipacion: p?.participation_code || referencia,
            numeroReferencia: referencia,
            premio: p?.prize_amount ?? p?.premio ?? 0,
            tipo: p?.type || 'social'
          };
          this.imagenTicket = p?.image || p?.snapshot_path ? this.getImageUrl(p.image || p.snapshot_path) : null;
        }
      },
      error: async (err) => {
        this.loading = false;
        const msg = err.error?.message || (err.status === 422
          ? 'La participación no se puede vincular porque ya se encuentra leída por otro usuario.'
          : 'No se encuentra la participación. Comprueba la referencia o el código QR.');
        await this.mostrarAlerta(err.status === 422 ? 'No se puede vincular' : 'No encontrada', msg);
        this.participacion = null;
        this.status = null;
        this.modoEscaneo = true;
      }
    });
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = path.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  private async procesarQRDigitalizacion(referencia: string) {
    this.loading = true;
    this.loadingMessage = 'Procesando...';
    this.ventasService.digitalizeParticipation(referencia).subscribe({
      next: async (res: any) => {
        this.loading = false;
        if (res.success) {
          const p = res.participation || res;
          const participacion = {
            id: Date.now(),
            numero: p.participation_code || p.numero || referencia,
            referencia,
            entidad: p.entity_name || p.entidad || p.set?.reserve?.entity?.name || '',
            precio: p.amount || p.importeTotal || p.played_amount || 0,
            fechaSorteo: p.draw_date || p.fechaSorteo || '',
            imagen: p.image || p.snapshot_path || null
          };
          this.participacionesDigitalizadas.push(participacion);
          this.mostrarInfoDigitalizacion = true;
          this.modoEscaneo = false;
        } else {
          await this.mostrarAlerta('Error', res.message || 'No se pudo digitalizar la participación.');
        }
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'Error al procesar el código QR.');
      }
    });
  }

  /**
   * Tarea 4: Digitalizar usando API (linkToWallet). Flujo: checkByReference → detalle → linkToWallet → notifyParticipacionesChanged → Cartera.
   * Sin localStorage para participaciones en este flujo.
   */
  digitalizar() {
    if (!this.ticketEscaneado) return;
    const referencia = this.ticketEscaneado.numeroReferencia;
    if (!referencia) {
      this.mostrarAlerta('Error', 'No hay referencia de participación.');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Vinculando a tu cartera...';
    this.carteraService.linkToWallet(referencia).subscribe({
      next: async () => {
        this.loading = false;
        this.carteraService.notifyParticipacionesChanged();
        await this.alertModal.show('Digitalización exitosa', 'La participación ha sido guardada en tu cartera.');
        this.router.navigate(['/tabs/tab1']);
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'No se pudo vincular la participación a tu cartera.');
      }
    });
  }

  nuevaDigitalizacion() {
    this.modoEscaneo = true;
    this.mostrarInfoDigitalizacion = false;
    void this.scanQR();
  }

  calcularImporteTotal(): number {
    return this.participacionesDigitalizadas.reduce((total, p) => total + (p.precio || 0), 0);
  }

  mostrarResumen() {
    this.formaPago = null;
    this.mostrarModalResumen = true;
  }

  cerrarModalResumen() {
    this.mostrarModalResumen = false;
    this.formaPago = null;
    if (this.ventaPendienteVendedor) {
      this.ventaPendienteVendedor = null;
      this.modoEscaneo = true;
    }
    if (this.ventaPendienteTaco) {
      this.ventaPendienteTaco = null;
      this.modoEscaneo = true;
    }
  }

  mostrarResumenVentaTaco() {
    this.formaPago = null;
    this.mostrarModalResumen = true;
  }

  seleccionarFormaPago(forma: 'efectivo' | 'bizum' | 'transferencia' | 'omitir') {
    this.formaPago = forma;
  }

  async venderDigitalizaciones() {
    if (!this.formaPago) {
      await this.mostrarAlerta('Atención', 'Por favor selecciona una forma de pago');
      return;
    }

    this.loading = true;
    this.loadingMessage = 'Registrando ventas...';

    const ventas = [];
    for (const participacion of this.participacionesDigitalizadas) {
      try {
        const paymentMethod = this.formaPago === 'omitir' ? null : this.formaPago;
        const res = await firstValueFrom(this.ventasService.sellByQr(participacion.referencia, undefined, undefined, paymentMethod));
        if (res?.success) {
          ventas.push(res);
        }
      } catch (err) {
        console.error('Error vendiendo participación:', err);
      }
    }

    this.loading = false;

    if (ventas.length > 0) {
      const formaPagoUsada = this.formaPago === 'omitir' ? null : this.formaPago;
      ventas.forEach((res, index) => {
        const participacion = this.participacionesDigitalizadas[index];
        this.guardarVentaDigitalEnHistorial(res, participacion.referencia, formaPagoUsada);
      });
      this.ventasService.notifyVentasChanged();
      this.cerrarModalResumen();
      this.mostrarModalExito = true;
    } else {
      await this.mostrarAlerta('Error', 'No se pudo registrar ninguna venta.');
    }
  }

  guardarVentaDigitalEnHistorial(res: any, referencia: string, formaPagoUsada?: string | null): void {
    const p = res.participation || res;
    const entidad = p.entity_name || p.entidad || '—';
    const drawDate = p.draw_date
      ? new Date(p.draw_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '—';
    const historial = JSON.parse(localStorage.getItem('historial') || '[]');
    historial.unshift({
      id: Date.now(),
      tipo: 'venta-digital',
      fecha: new Date().toISOString(),
      formaPago: formaPagoUsada ?? this.formaPago ?? null,
      descripcion: `Participación ${entidad}`,
      participacion: {
        entidad,
        numero: p.participation_code || p.numero || referencia,
        fechaSorteo: drawDate,
        importeJugado: p.played_amount ?? p.importeJugado ?? 0,
        donativo: p.donation_amount ?? p.donativo,
        importeTotal: p.amount ?? p.importeTotal ?? 0,
        numeroParticipacion: p.participation_code || referencia,
        numeroReferencia: p.reference || referencia.padEnd(19, '0').slice(0, 19),
        imagen: p.image || null
      }
    });
    localStorage.setItem('historial', JSON.stringify(historial));
  }

  cerrarModalExito() {
    this.mostrarModalExito = false;
    this.participacionesDigitalizadas = [];
    this.mostrarInfoDigitalizacion = false;
    this.ventaPendienteVendedor = null;
    this.ventaPendienteTaco = null;
    this.modoEscaneo = true;
    if (this.isVendedor) {
      this.router.navigate(['/tabs/vendedor-tab3']);
    }
  }

  async gestionarPremio() {
    if (!this.ticketEscaneado || !this.ticketEscaneado.premio || this.ticketEscaneado.premio === 0) return;

    // Navegar a gestión de premio
    this.router.navigate(['/tabs/cobrar-gestionar']);
  }

  volverAEscanear() {
    this.ticketEscaneado = null;
    this.imagenTicket = null;
    this.participacion = null;
    this.status = null;
    this.mensajeError = '';
    this.modoEscaneo = true;
    void this.scanQR();
  }

  async mostrarAlerta(header: string, message: string) {
    await this.alertModal.show(header, message);
  }

  /**
   * Extrae la referencia de una URL de QR o devuelve el texto si ya es una referencia
   * Formato esperado: https://panel.partilot.es/comprobar-participacion?ref=0000000000000
   */
  private extraerReferenciaDeQR(qrText: string | null): string | null {
    if (!qrText) return null;
    
    // Si contiene "ref=", extraer la referencia de la URL
    if (qrText.includes('ref=')) {
      const parts = qrText.split('ref=');
      if (parts.length > 1) {
        // Tomar la parte después de "ref=" y limpiar posibles parámetros adicionales
        const referencia = parts[1].split('&')[0].split('#')[0].trim();
        return referencia || null;
      }
    }
    
    // Si no contiene "ref=", asumir que es la referencia directamente
    return qrText.trim() || null;
  }

}
