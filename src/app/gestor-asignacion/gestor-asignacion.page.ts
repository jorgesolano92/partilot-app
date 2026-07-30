import { Component, OnInit, ViewChild, ElementRef, AfterViewInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VentasService } from '../core/services/ventas.service';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import { BiometricService } from '../core/services/biometric.service';
import { AlertController } from '@ionic/angular';
import { environment } from '../../environments/environment';
import { refreshWithLoadingWatch } from '../core/utils/ion-refresher.util';
import { finalize } from 'rxjs';

type Step = 'sorteos' | 'participaciones' | 'resumen' | 'firma';

export interface AsignacionParticipation {
  id: number;
  number: number;
  participation_code: string;
  set_id: number;
  set_name?: string;
}

@Component({
  selector: 'app-gestor-asignacion',
  templateUrl: './gestor-asignacion.page.html',
  styleUrls: ['./gestor-asignacion.page.scss'],
  standalone: false,
})
export class GestorAsignacionPage implements OnInit, AfterViewInit {
  private static readonly SESSION_CTX_KEY = 'gestorAsignacionSellerCtx';

  @ViewChild('signatureCanvas', { static: false }) signatureCanvas!: ElementRef<HTMLCanvasElement>;

  step: Step = 'sorteos';
  loading = false;
  /** Evita que dos peticiones solapadas dejen `loading` en false con la otra aún en curso (doble loader parpadeante). */
  private loadLotteriesSeq = 0;
  private loadSetsSeq = 0;
  errorMessage = '';
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'gestor';

  sellerId: number | null = null;
  entityId: number | null = null;
  sellerName = '';
  selectedEntity: any = null;

  lotteries: any[] = [];
  selectedLottery: any = null;
  sets: any[] = [];
  selectedSet: any = null;
  /** Para sets físicos: texto "Disponibles: de la X a la Y" (como en la web) */
  availableRangesText = '';
  rangoDesde = '';
  rangoHasta = '';
  unidadNumero = '';
  /** Solo para sets digitales: cantidad a asignar (valor numérico para el contador) y disponibles en el set */
  cantidadDigitalNum = 1;
  disponiblesDigitalSet = 0;
  participacionesToAssign: AsignacionParticipation[] = [];
  showQrScannerView = false;

  signatureDataUrl: string | null = null;
  isDrawing = false;
  hasSignature = false;
  procesando = false;
  showSuccessModal = false;
  successModalTitle = '¡Asignación registrada!';
  successModalText = '';

  /** Firma en canvas desactivada (no se persiste); conservar código para uso futuro. */
  readonly signatureStepEnabled = false;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ventasService: VentasService,
    public authService: AuthService,
    private alertController: AlertController,
    private biometricService: BiometricService,
    private roleSwitchService: RoleSwitchService
  ) {}

  ngOnInit() {
    this.detectarRol();
    const nav = this.router.getCurrentNavigation();
    const state = nav?.extras?.state as { seller_id?: number; entity_id?: number; seller_name?: string } | undefined;

    // Estado de navegación solo existe en la entrada desde el detalle; al volver de biometría (/biometric-unlock) se pierde.
    if (state?.seller_id != null && state?.entity_id != null) {
      this.applySellerContext(state.seller_id, state.entity_id, state.seller_name);
      this.persistSellerContext();
      this.loadLotteries();
      return;
    }

    const stored = this.readSellerContextFromSession();
    if (stored) {
      this.applySellerContext(stored.seller_id, stored.entity_id, stored.seller_name);
      this.errorMessage = '';
      this.loadLotteries();
      return;
    }

    this.errorMessage = 'Faltan datos del vendedor. Vuelve al detalle del vendedor.';
  }

  handleRefresh(event: CustomEvent): void {
    refreshWithLoadingWatch(event, () => this.loading, () => this.refreshCurrentStep());
  }

  private refreshCurrentStep(): void {
    if (this.step === 'sorteos') {
      this.loadLotteries();
      return;
    }
    if (this.step === 'participaciones' && this.selectedLottery) {
      this.loadSets();
    }
  }

  /** Llamar al salir al listado de vendedores para no reutilizar otro flujo con el mismo sessionStorage. */
  clearPersistedAsignacionContext(): void {
    try {
      sessionStorage.removeItem(GestorAsignacionPage.SESSION_CTX_KEY);
    } catch {
      /* ignore */
    }
  }

  private applySellerContext(seller_id: number, entity_id: number, seller_name?: string): void {
    this.sellerId = seller_id;
    this.entityId = entity_id;
    this.sellerName = seller_name || 'Vendedor';
    this.selectedEntity = { id: entity_id, name: '' };
  }

  private persistSellerContext(): void {
    if (this.sellerId == null || this.entityId == null) {
      return;
    }
    try {
      sessionStorage.setItem(
        GestorAsignacionPage.SESSION_CTX_KEY,
        JSON.stringify({
          seller_id: this.sellerId,
          entity_id: this.entityId,
          seller_name: this.sellerName,
        })
      );
    } catch {
      /* ignore */
    }
  }

  private readSellerContextFromSession(): { seller_id: number; entity_id: number; seller_name?: string } | null {
    try {
      const raw = sessionStorage.getItem(GestorAsignacionPage.SESSION_CTX_KEY);
      if (!raw) {
        return null;
      }
      const o = JSON.parse(raw) as { seller_id?: unknown; entity_id?: unknown; seller_name?: string };
      if (typeof o.seller_id === 'number' && typeof o.entity_id === 'number') {
        return { seller_id: o.seller_id, entity_id: o.entity_id, seller_name: o.seller_name };
      }
    } catch {
      /* ignore */
    }
    return null;
  }

  ngAfterViewInit() {
    // Canvas para firma se inicializa cuando step === 'firma'
  }

  detectarRol() {
    const guardado = localStorage.getItem('rolActual');
    if (guardado === 'usuario' || guardado === 'vendedor' || guardado === 'gestor') {
      this.rolActual = guardado;
    } else {
      this.rolActual = this.authService.isManager() ? 'gestor' : (this.authService.isSeller() ? 'vendedor' : 'usuario');
    }
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
    void this.roleSwitchService.confirmRoleChange(rol, this.rolActual, () => {
      this.rolActual = rol;
      localStorage.setItem('rolActual', rol);
      if (rol === 'vendedor') {
        localStorage.setItem('esVendedor', 'true');
        this.router.navigate(['/tabs/vendedor-tab1']);
      } else if (rol === 'usuario') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/tab3']);
      } else if (rol === 'gestor') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/gestor-tab3']);
      }
    });
  }

  /**
   * Paso sorteos: escanear QR del taco (portada) y rellenar sorteo/set + lista de participaciones a asignar (rangos libres del libro).
   */
  async escanearTacoParaAsignacion(): Promise<void> {
    if (!this.entityId || !this.sellerId) {
      await this.mostrarAlerta('Falta dato', 'No hay entidad o vendedor.');
      return;
    }
    if (this.lotteries.length === 0) {
      await this.mostrarAlerta('Sin sorteos', 'No hay sorteos para esta entidad.');
      return;
    }
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el QR de la portada del taco',
      });
      const qrText = result?.ScanResult?.trim() || null;
      const tacoRef = this.extraerTacoRefDeQR(qrText);
      if (!tacoRef) {
        await this.mostrarAlerta('QR no válido', 'No se reconoce un código de taco (TACO-…).');
        return;
      }
      this.loading = true;
      this.errorMessage = '';
      this.ventasService.getManagerTacoForAssign(this.entityId, this.sellerId, tacoRef).subscribe({
        next: async (tacoRes: any) => {
          this.loading = false;
          if (!tacoRes?.success) {
            await this.mostrarAlerta('Error', tacoRes?.message || 'No se pudo leer el taco.');
            return;
          }
          const lot = this.lotteries.find((l) => l.id === tacoRes.lottery_id);
          if (!lot) {
            await this.mostrarAlerta('Sorteo', 'El taco no corresponde a un sorteo de esta entidad en la lista.');
            return;
          }
          if (!tacoRes.rangos_disponibles?.length || (tacoRes.total_disponibles ?? 0) <= 0) {
            await this.mostrarAlerta('Sin disponibles', tacoRes.message || 'No hay participaciones libres para asignar en este taco.');
            return;
          }
          await this.aplicarTacoCompleto(lot, tacoRes);
        },
        error: async (err) => {
          this.loading = false;
          await this.mostrarAlerta('Error', err?.error?.message || 'Error al consultar el taco.');
        },
      });
    } catch (err) {
      this.loading = false;
      if (this.biometricService.isScanCancelled(err)) {
        return;
      }
      await this.mostrarAlerta('Error', 'No se pudo abrir el escáner.');
    }
  }

  private extraerTacoRefDeQR(qrText: string | null): string | null {
    if (!qrText) {
      return null;
    }
    let value = qrText.trim();
    if (value.includes('taco_ref=')) {
      const match = value.match(/taco_ref=([^&\s#]+)/);
      if (match) {
        value = decodeURIComponent(match[1]).trim();
      }
    }
    if (/^TACO-\d+-\d+-\d+-B\d+-[a-f0-9]{8}$/.test(value)) {
      return value;
    }
    return null;
  }

  private async aplicarTacoCompleto(lot: any, tacoRes: any): Promise<void> {
    this.selectedLottery = lot;
    this.loading = true;
    this.errorMessage = '';
    this.ventasService.getManagerAssignmentSets(this.entityId!, lot.id).subscribe({
      next: async (res) => {
        this.loading = false;
        if (!res.success || !res.sets) {
          await this.mostrarAlerta('Error', 'No se pudieron cargar los sets.');
          return;
        }
        this.sets = res.sets;
        const set = this.sets.find((s) => s.id === tacoRes.set_id);
        if (!set) {
          await this.mostrarAlerta('Set', 'No se encontró el set del taco en este sorteo (solo sets físicos).');
          return;
        }
        this.selectedSet = set;
        this.disponiblesDigitalSet = 0;
        this.rangoDesde = '';
        this.rangoHasta = '';
        this.unidadNumero = '';
        this.loadAvailableRangesForSet();
        const ok = await this.aplicarRangosDelTacoSecuencial(tacoRes.rangos_disponibles || []);
        if (ok) {
          this.showQrScannerView = false;
          this.step = 'participaciones';
          const n = tacoRes.total_disponibles ?? 0;
          const libro = tacoRes.book_number ?? '';
          await this.mostrarAlerta(
            'Taco registrado',
            `Se añadieron ${n} participación(es) del libro ${libro}. Pulsa «Terminar» para ir al resumen o «Asignar / Seguir» para añadir más.`
          );
        }
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err?.error?.message || 'Error al cargar sets.');
      },
    });
  }

  private aplicarRangosDelTacoSecuencial(rangos: Array<{ desde: number; hasta: number }>): Promise<boolean> {
    return new Promise((resolve) => {
      if (!this.sellerId || !this.selectedSet?.id) {
        resolve(false);
        return;
      }
      const run = (idx: number) => {
        if (idx >= rangos.length) {
          resolve(true);
          return;
        }
        const r = rangos[idx];
        this.loading = true;
        this.ventasService.validateAssignments(this.sellerId!, this.selectedSet.id, r.desde, r.hasta).subscribe({
          next: (resp) => {
            this.loading = false;
            if (resp.success && resp.participations && resp.participations.length > 0) {
              this.agregarParticipacionesSinDuplicar(resp.participations);
              run(idx + 1);
            } else {
              this.mostrarAlerta('Sin resultados', resp?.message || `Rango ${r.desde}-${r.hasta}`);
              resolve(false);
            }
          },
          error: (err) => {
            this.loading = false;
            this.mostrarAlerta('Error', err?.error?.message || 'Error al validar rango.');
            resolve(false);
          },
        });
      };
      run(0);
    });
  }

  loadLotteries() {
    if (!this.entityId) return;
    const seq = ++this.loadLotteriesSeq;
    this.loading = true;
    this.errorMessage = '';
    this.ventasService.getManagerAssignmentLotteries(this.entityId).pipe(
      finalize(() => {
        if (seq === this.loadLotteriesSeq) {
          this.loading = false;
        }
      })
    ).subscribe({
      next: (res) => {
        if (seq !== this.loadLotteriesSeq) return;
        if (res.success && res.lotteries) {
          this.lotteries = res.lotteries;
          if (this.lotteries.length === 0) {
            this.errorMessage = 'No hay sorteos para esta entidad.';
          }
        } else {
          this.errorMessage = 'Error al cargar sorteos.';
        }
      },
      error: (err) => {
        if (seq !== this.loadLotteriesSeq) return;
        this.errorMessage = err?.error?.message || 'Error al cargar sorteos.';
      }
    });
  }

  selectSorteo(lottery: any) {
    this.selectedLottery = lottery;
    this.loadSets();
    this.showQrScannerView = false;
    this.step = 'participaciones';
  }

  loadSets() {
    if (!this.entityId || !this.selectedLottery) return;
    const seq = ++this.loadSetsSeq;
    this.loading = true;
    this.errorMessage = '';
    this.ventasService.getManagerAssignmentSets(this.entityId, this.selectedLottery.id).pipe(
      finalize(() => {
        if (seq === this.loadSetsSeq) {
          this.loading = false;
        }
      })
    ).subscribe({
      next: (res) => {
        if (seq !== this.loadSetsSeq) return;
        if (res.success && res.sets) {
          this.sets = res.sets;
          this.selectedSet = this.sets.length === 1 ? this.sets[0] : null;
          if (this.sets.length === 1 && this.selectedSet && this.isDigitalSet && this.sellerId) {
            this.cargarDisponiblesDigital();
          }
          if (this.selectedSet && !this.isDigitalSet) {
            this.loadAvailableRangesForSet();
          } else {
            this.availableRangesText = '';
          }
          if (this.sets.length === 0) {
            this.errorMessage = 'No hay sets con participaciones para este sorteo.';
          }
        } else {
          this.errorMessage = 'Error al cargar sets.';
        }
      },
      error: (err) => {
        if (seq !== this.loadSetsSeq) return;
        this.errorMessage = err?.error?.message || 'Error al cargar sets.';
      }
    });
  }

  compareSet(a: any, b: any): boolean {
    return a && b && a.id === b.id;
  }

  /** Etiqueta de la reserva: número(s) reservado(s) y sorteo (ej. "37428 - 076/25" o "37428 - 37429 - 076/25") */
  getReserveLabel(set: any): string {
    if (!set?.reserve) return '';
    const nums = set.reserve.reservation_numbers;
    const numStr = Array.isArray(nums) ? (nums as string[]).join(' - ') : (nums != null ? String(nums) : '');
    const lotteryName = set.reserve.lottery?.name ?? '';
    if (numStr && lotteryName) return `${numStr} - ${lotteryName}`;
    if (numStr) return numStr;
    if (lotteryName) return lotteryName;
    return '';
  }

  /** True si el set seleccionado es solo digital (sin físicas) */
  get isDigitalSet(): boolean {
    const s = this.selectedSet;
    if (!s) return false;
    const dig = s.digital_participations ?? 0;
    const fis = s.physical_participations ?? 0;
    return dig > 0 && fis === 0;
  }

  onSetChange(ev: any) {
    const v = ev?.detail?.value;
    if (v != null) {
      this.selectedSet = v;
      if (this.isDigitalSet && this.sellerId && this.selectedSet) {
        this.cargarDisponiblesDigital();
        this.availableRangesText = '';
      } else {
        this.disponiblesDigitalSet = 0;
        if (this.selectedSet) {
          this.loadAvailableRangesForSet();
        } else {
          this.availableRangesText = '';
        }
      }
    }
  }

  /** Cargar texto "Disponibles: de la X a la Y" para set físico (como en la web) */
  loadAvailableRangesForSet() {
    if (!this.selectedSet?.id || this.isDigitalSet) {
      this.availableRangesText = '';
      return;
    }
    this.ventasService.getAvailableRangesForSet(this.selectedSet.id).subscribe({
      next: (res) => {
        if (res.success && res.available_ranges && res.available_ranges.length > 0) {
          const parts = res.available_ranges.map((r: number[]) =>
            r[0] === r[1] ? `de la ${r[0]}` : `de la ${r[0]} a la ${r[1]}`
          );
          this.availableRangesText = 'Disponibles: ' + parts.join(', ') + '.';
        } else {
          this.availableRangesText = 'No hay participaciones disponibles en este set.';
        }
      },
      error: () => {
        this.availableRangesText = '';
      }
    });
  }

  /** Cargar cantidad disponible para set digital (cantidad=0) */
  cargarDisponiblesDigital() {
    if (!this.sellerId || !this.selectedSet?.id) return;
    this.ventasService.validateAssignmentsByCantidad(this.sellerId, this.selectedSet.id, 0).subscribe({
      next: (res) => {
        if (res.success && res.disponibles_restantes !== undefined) {
          this.disponiblesDigitalSet = res.disponibles_restantes;
        }
      },
      error: () => { this.disponiblesDigitalSet = 0; }
    });
  }

  disminuirParticipacionesDigital() {
    if (this.cantidadDigitalNum > 1) this.cantidadDigitalNum--;
  }

  aumentarParticipacionesDigital() {
    if (this.cantidadDigitalNum < this.disponiblesDigitalSet) this.cantidadDigitalNum++;
  }

  validarYAsignar() {
    if (!this.sellerId || !this.selectedSet) {
      this.mostrarAlerta('Falta selección', 'Selecciona set.');
      return;
    }
    if (this.isDigitalSet) {
      const cantidad = this.cantidadDigitalNum;
      if (cantidad < 1) {
        this.mostrarAlerta('Cantidad requerida', 'Indica cuántas participaciones asignar (mínimo 1).');
        return;
      }
      if (cantidad > this.disponiblesDigitalSet) {
        this.mostrarAlerta('No hay suficientes', `Solo hay ${this.disponiblesDigitalSet} disponibles.`);
        return;
      }
      this.validarCantidadDigital(cantidad);
      return;
    }
    const desde = this.rangoDesde ? parseInt(this.rangoDesde, 10) : undefined;
    const hasta = this.rangoHasta ? parseInt(this.rangoHasta, 10) : undefined;
    const unidad = this.unidadNumero ? parseInt(this.unidadNumero, 10) : undefined;

    if (desde != null && hasta != null) {
      this.validarRango(desde, hasta);
    } else if (unidad != null && !isNaN(unidad)) {
      this.validarUnidad(unidad);
    } else {
      this.mostrarAlerta('Datos requeridos', 'Indica un rango (desde y hasta) o un número de participación.');
    }
  }

  private validarCantidadDigital(cantidad: number) {
    this.loading = true;
    this.ventasService.validateAssignmentsByCantidad(this.sellerId!, this.selectedSet.id, cantidad).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          this.agregarParticipacionesSinDuplicar(res.participations);
          this.cantidadDigitalNum = 1;
          if (res.disponibles_restantes !== undefined) {
            this.disponiblesDigitalSet = res.disponibles_restantes;
          }
        } else if (res.success && res.disponibles_restantes !== undefined) {
          this.disponiblesDigitalSet = res.disponibles_restantes;
        } else {
          this.mostrarAlerta('Sin resultados', res?.message || 'No se obtuvieron participaciones.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al validar.');
      }
    });
  }

  private validarRango(desde: number, hasta: number) {
    this.loading = true;
    this.ventasService.validateAssignments(this.sellerId!, this.selectedSet.id, desde, hasta).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          this.agregarParticipacionesSinDuplicar(res.participations);
          this.rangoDesde = '';
          this.rangoHasta = '';
          this.unidadNumero = '';
        } else {
          this.mostrarAlerta('Sin resultados', res?.message || 'No hay participaciones disponibles en ese rango.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al validar el rango.');
      }
    });
  }

  private validarUnidad(numero: number) {
    this.validarRango(numero, numero);
  }

  private agregarParticipacionesSinDuplicar(participations: any[]) {
    const setNombre = this.selectedSet?.set_name ?? this.selectedSet?.name ?? 'Set';
    for (const p of participations) {
      const id = p.id;
      const setId = p.set_id ?? this.selectedSet?.id;
      if (!this.participacionesToAssign.find(x => x.id === id)) {
        this.participacionesToAssign.push({
          id,
          number: p.number,
          participation_code: p.participation_code || '',
          set_id: setId,
          set_name: setNombre
        });
      }
    }
  }

  quitarParticipacion(p: AsignacionParticipation) {
    this.participacionesToAssign = this.participacionesToAssign.filter(x => x.id !== p.id);
  }

  irAResumen() {
    this.step = 'resumen';
  }

  backToParticipaciones() {
    this.step = 'participaciones';
  }

  aceptarResumenContinuar() {
    if (!this.signatureStepEnabled) {
      this.enviarAsignacion();
      return;
    }
    this.step = 'firma';
    this.hasSignature = false;
    this.signatureDataUrl = null;
    setTimeout(() => this.initSignatureCanvas(), 100);
  }

  private initSignatureCanvas() {
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    ctx.strokeStyle = '#212529';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
  }

  startDrawing(ev: TouchEvent | MouseEvent) {
    this.isDrawing = true;
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const coords = this.getCoords(ev, canvas);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
  }

  draw(ev: TouchEvent | MouseEvent) {
    if (!this.isDrawing) return;
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ev.preventDefault();
    const coords = this.getCoords(ev, canvas);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
    this.hasSignature = true;
  }

  endDrawing() {
    this.isDrawing = false;
    const canvas = this.signatureCanvas?.nativeElement;
    if (!canvas) return;
    this.signatureDataUrl = canvas.toDataURL('image/png');
  }

  private getCoords(ev: TouchEvent | MouseEvent, canvas: HTMLCanvasElement): { x: number; y: number } {
    const rect = canvas.getBoundingClientRect();
    if (ev instanceof TouchEvent) {
      const t = ev.touches[0] || ev.changedTouches[0];
      return { x: t.clientX - rect.left, y: t.clientY - rect.top };
    }
    return { x: (ev as MouseEvent).clientX - rect.left, y: (ev as MouseEvent).clientY - rect.top };
  }

  clearSignature() {
    const canvas = this.signatureCanvas?.nativeElement;
    if (canvas && canvas.getContext('2d')) {
      const ctx = canvas.getContext('2d')!;
      const dpr = window.devicePixelRatio || 1;
      ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
    }
    this.hasSignature = false;
    this.signatureDataUrl = null;
  }

  enviarAsignacion() {
    if (!this.sellerId || this.participacionesToAssign.length === 0) {
      this.mostrarAlerta('Aviso', 'No hay participaciones para asignar.');
      return;
    }
    if (this.signatureStepEnabled && !this.hasSignature) {
      this.mostrarAlerta('Firma requerida', 'El vendedor debe firmar para confirmar.');
      return;
    }
    this.procesando = true;
    const payload = this.participacionesToAssign.map(p => ({ id: p.id, number: p.number, set_id: p.set_id }));
    this.ventasService.saveAssignments(this.sellerId, payload).subscribe({
      next: (res) => {
        this.procesando = false;
        if (res.success) {
          this.applySuccessModalContent(res);
          this.showSuccessModal = true;
        } else {
          this.mostrarAlerta('Error', res.message || 'No se pudo guardar la asignación.');
        }
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al guardar la asignación.');
      }
    });
  }

  private applySuccessModalContent(res: {
    message?: string;
    queued?: boolean;
    proposal_count?: number;
    assigned_count?: number;
    pending_receipt?: boolean;
  }): void {
    if (res.message && !res.queued) {
      this.successModalTitle = '¡Asignación registrada!';
      this.successModalText = res.message;
      return;
    }

    const counts = this.countAssignmentTypes();
    const physical = counts.physical;
    const digital = counts.digital;

    if (physical > 0 && digital === 0) {
      this.successModalTitle = 'Propuesta enviada';
      this.successModalText =
        `Se ha registrado la propuesta de ${physical} participación(es) física(s). ` +
        'El vendedor recibirá un email para aceptar el recibo; hasta entonces no quedarán asignadas.';
      return;
    }

    if (digital > 0 && physical === 0) {
      this.successModalTitle = res.queued ? 'Asignación en proceso' : '¡Asignación registrada!';
      this.successModalText = res.queued
        ? `La asignación de ${digital} participación(es) digitales se está procesando en segundo plano. El vendedor recibirá confirmación por email.`
        : `Se asignaron ${digital} participación(es) digitales correctamente. El vendedor recibirá un email de confirmación.`;
      return;
    }

    if (physical > 0 && digital > 0) {
      this.successModalTitle = 'Asignación registrada';
      this.successModalText =
        `Digitales (${digital}): se asignarán al momento. ` +
        `Físicas (${physical}): el vendedor debe aceptar el recibo por email antes de quedar asignadas.`;
      return;
    }

    this.successModalTitle = '¡Asignación registrada!';
    this.successModalText =
      res.message ||
      (res.queued
        ? 'La asignación se está procesando en segundo plano. El vendedor recibirá un email con los detalles.'
        : 'La asignación ha sido registrada correctamente.');
  }

  private countAssignmentTypes(): { physical: number; digital: number } {
    let physical = 0;
    let digital = 0;
    for (const p of this.participacionesToAssign) {
      if (this.isParticipationDigital(p.participation_code)) {
        digital++;
      } else {
        physical++;
      }
    }
    return { physical, digital };
  }

  private isParticipationDigital(participationCode: string | undefined): boolean {
    const code = (participationCode || '').trim();
    return code.startsWith('1D/');
  }

  closeSuccessModal() {
    this.showSuccessModal = false;
    this.clearPersistedAsignacionContext();
    this.router.navigate(['/tabs/gestor-tab2'], {
      replaceUrl: true,
      state: {
        refreshSellerDetail: true,
        seller_id: this.sellerId,
        entity_id: this.entityId,
        seller_name: this.sellerName,
      },
    });
  }

  backToSorteos() {
    this.step = 'sorteos';
    this.showQrScannerView = false;
    this.selectedLottery = null;
    this.sets = [];
    this.selectedSet = null;
    this.participacionesToAssign = [];
    this.loadLotteries();
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = (imagePath || '').replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  onLotteryImageError(lot: any) {
    if (lot) lot.image = null;
  }

  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({ header, message, buttons: ['OK'] });
    await alert.present();
  }

  async escanearQRUnidad() {
    if (!this.entityId || !this.selectedLottery || !this.selectedSet) {
      this.mostrarAlerta('Falta selección', 'Selecciona sorteo y set antes de escanear.');
      return;
    }
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el código QR de la participación (unidad)'
      });
      const qrText = result?.ScanResult?.trim() || null;
      const referencia = this.extraerReferenciaDeQR(qrText);
      if (!referencia) {
        this.mostrarAlerta('QR no válido', 'No se pudo obtener la referencia.');
        return;
      }
      this.validarPorReferencia(referencia);
    } catch (err) {
      console.error('Error escáner QR:', err);
      if (this.biometricService.isScanCancelled(err)) {
        return;
      }
      this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    }
  }

  async escanearQRParaDesde() {
    if (!this.entityId || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona sorteo.');
      return;
    }
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el QR de la primera participación (Desde)'
      });
      const qrText = result?.ScanResult?.trim() || null;
      const referencia = this.extraerReferenciaDeQR(qrText);
      if (!referencia) {
        this.mostrarAlerta('QR no válido', 'No se pudo obtener la referencia.');
        return;
      }
      this.resolverReferenciaParaCampo(referencia, 'desde');
    } catch (err) {
      console.error('Error escáner QR:', err);
      if (this.biometricService.isScanCancelled(err)) {
        return;
      }
      this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    }
  }

  async escanearQRParaHasta() {
    if (!this.entityId || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona sorteo.');
      return;
    }
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el QR de la última participación (Hasta)'
      });
      const qrText = result?.ScanResult?.trim() || null;
      const referencia = this.extraerReferenciaDeQR(qrText);
      if (!referencia) {
        this.mostrarAlerta('QR no válido', 'No se pudo obtener la referencia.');
        return;
      }
      this.resolverReferenciaParaCampo(referencia, 'hasta');
    } catch (err) {
      console.error('Error escáner QR:', err);
      if (this.biometricService.isScanCancelled(err)) {
        return;
      }
      this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    }
  }

  private resolverReferenciaParaCampo(referencia: string, campo: 'desde' | 'hasta') {
    this.loading = true;
    this.ventasService.validateManagerAssignmentReference(
      this.entityId!,
      this.selectedLottery.id,
      referencia
    ).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          const num = res.participations[0].number ?? (res.participations[0] as any).participation_number;
          if (num != null) {
            if (campo === 'desde') this.rangoDesde = String(num);
            else this.rangoHasta = String(num);
            const first = res.participations[0] as any;
            if (first.set_id && this.sets.length > 0) {
              const set = this.sets.find(s => s.id === first.set_id);
              if (set) this.selectedSet = set;
            }
          }
        } else {
          this.mostrarAlerta('Sin resultados', 'No se encontró esa participación.');
        }
      },
      error: () => {
        this.loading = false;
        this.mostrarAlerta('Error', 'Error al validar el QR.');
      }
    });
  }

  private validarPorReferencia(referencia: string) {
    this.loading = true;
    this.ventasService.validateManagerAssignmentReference(
      this.entityId!,
      this.selectedLottery.id,
      referencia
    ).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          const first = res.participations[0] as any;
          const num = first.number ?? first.participation_number;
          if (num != null && this.sellerId && this.selectedSet) {
            this.ventasService.validateAssignments(this.sellerId, this.selectedSet.id, num, num).subscribe({
              next: (r) => {
                if (r.success && r.participations && r.participations.length > 0) {
                  this.agregarParticipacionesSinDuplicar(r.participations);
                  this.unidadNumero = '';
                  this.rangoDesde = '';
                  this.rangoHasta = '';
                } else {
                  this.mostrarAlerta('No disponible', 'Esa participación no está disponible para asignar.');
                }
              },
              error: () => this.mostrarAlerta('Error', 'No se pudo validar la participación.')
            });
          } else {
            this.mostrarAlerta('Sin resultados', 'No se pudo obtener el número de participación.');
          }
        } else {
          this.mostrarAlerta('Sin resultados', 'No se encontró esa participación.');
        }
      },
      error: () => {
        this.loading = false;
        this.mostrarAlerta('Error', 'Error al validar el QR.');
      }
    });
  }

  private extraerReferenciaDeQR(qrText: string | null): string | null {
    if (!qrText) return null;
    const t = qrText.trim();
    if (!t) return null;
    const m = t.match(/(?:participation|ref|referencia)[=\/:]\s*([a-zA-Z0-9_-]+)/i);
    if (m) return m[1];
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(t)) return t;
    return t;
  }
}
