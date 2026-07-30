import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DevolutionsService } from '../core/services/devolutions.service';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import { BiometricService } from '../core/services/biometric.service';
import { AlertModalService } from '../core/services/alert-modal.service';
import { DevolucionPreselectService } from '../core/services/devolucion-preselect.service';
import { environment } from '../../environments/environment';
import { refreshWithLoadingWatch } from '../core/utils/ion-refresher.util';

type Step = 'entidades' | 'sorteos' | 'vendedores' | 'participaciones' | 'resumen' | 'liquidacion';

@Component({
  selector: 'app-gestor-devolucion',
  templateUrl: './gestor-devolucion.page.html',
  styleUrls: ['./gestor-devolucion.page.scss'],
  standalone: false,
})
export class GestorDevolucionPage implements OnInit {
  step: Step = 'entidades';
  loading = false;
  errorMessage = '';
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'gestor';

  // Entidades
  entities: any[] = [];
  selectedEntity: any = null;

  // Sorteos
  lotteries: any[] = [];
  selectedLottery: any = null;

  // Vendedores (devolución vendedor: las devueltas pasan a disponibles y las que quedan se liquidan como vendidas)
  sellers: any[] = [];
  selectedSeller: any = null;

  // Reservas, sets y participaciones
  reserves: any[] = [];
  selectedReserve: any = null;
  sets: any[] = [];
  selectedSet: any = null;
  rangoDesde = '';
  rangoHasta = '';
  unidadNumero = '';
  participacionesAsignadas: Array<{ id: number; number: number; participation_code: string; set_id: number; set_name: string }> = [];

  // Participaciones disponibles para devolver (entidad o vendedor en la reserva seleccionada)
  availableToReturn: number | null = null;
  availableToReturnFisicas: number = 0;
  availableToReturnDigitales: number = 0;
  loadingAvailable = false;

  // Liquidación
  summary: any = null;
  pagoEfectivo = '';
  pagoBizum = '';
  pagoTransferencia = '';
  procesando = false;
  showLiquidationModal = false;
  showLiquidationSuccessModal = false;
  showPaymentModeModal = false;
  prizePaymentMode: 'presencial' | 'online' | null = null;
  onlinePayer: 'partilot' | 'entity' = 'partilot';
  prizePaymentModeConfirmed = false;
  private pendingLiquidationBody: any = null;

  constructor(
    private router: Router,
    private devolutionsService: DevolutionsService,
    public authService: AuthService,
    private alertModal: AlertModalService,
    private devolucionPreselect: DevolucionPreselectService,
    private biometricService: BiometricService,
    private roleSwitchService: RoleSwitchService
  ) {}

  ngOnInit() {
    this.detectarRol();
  }

  ionViewWillEnter() {
    this.detectarRol();
    const preselect = this.devolucionPreselect.getAndClear();
    if (preselect?.entity && preselect?.sellerId != null) {
      this.applyPreselectionFromDetail(preselect.entity, preselect.sellerId);
      return;
    }
    if (this.step === 'entidades') {
      this.loadEntities();
    }
  }

  handleRefresh(event: CustomEvent): void {
    refreshWithLoadingWatch(
      event,
      () => this.loading || this.loadingAvailable,
      () => this.refreshCurrentStep()
    );
  }

  private refreshCurrentStep(): void {
    switch (this.step) {
      case 'entidades':
        this.loadEntities();
        break;
      case 'vendedores':
        this.loadSellers();
        break;
      case 'sorteos':
        this.loadSorteos();
        break;
      case 'participaciones':
        this.loadReserves();
        this.loadSets();
        if (this.selectedSet) {
          this.loadAvailableToReturn();
        }
        break;
      case 'resumen':
      case 'liquidacion':
        this.cargarResumenLiquidacion();
        break;
    }
  }

  /**
   * Llegada desde detalle del vendedor (Devolver): entidad y vendedor ya elegidos.
   * Lleva al paso Sorteos para que el usuario solo elija el sorteo.
   */
  private applyPreselectionFromDetail(entity: any, sellerId: number) {
    this.selectedEntity = entity;
    this.entities = [entity];
    this.loading = true;
    this.errorMessage = '';
    this.devolutionsService.getSellersByEntity(entity.id).subscribe({
      next: (res) => {
        if (res.success && res.sellers) {
          this.sellers = res.sellers;
          this.selectedSeller = res.sellers.find((s: any) => s.id === sellerId) || null;
          this.devolutionsService.getLotteriesByEntity(entity.id).subscribe({
            next: (lotRes) => {
              this.loading = false;
              if (lotRes.success && lotRes.lotteries) this.lotteries = lotRes.lotteries;
              this.step = 'sorteos';
            },
            error: () => {
              this.loading = false;
              this.step = 'sorteos';
            }
          });
        } else {
          this.loading = false;
          this.errorMessage = 'Error al cargar vendedores.';
        }
      },
      error: () => {
        this.loading = false;
        this.errorMessage = 'Error al cargar vendedores.';
      }
    });
  }

  detectarRol() {
    const ruta = typeof window !== 'undefined' ? window.location.pathname : '';
    if (ruta.includes('/vendedor-tab') && this.authService.isSeller()) {
      this.rolActual = 'vendedor';
      return;
    }
    if (ruta.includes('/gestor-tab') && this.authService.isManager()) {
      this.rolActual = 'gestor';
      return;
    }
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
        this.router.navigate(['/tabs/vendedor-tab4']);
      } else if (rol === 'usuario') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/tab3']);
      } else if (rol === 'gestor') {
        localStorage.setItem('esVendedor', 'false');
        this.router.navigate(['/tabs/gestor-tab1']);
      }
    });
  }

  loadEntities() {
    this.loading = true;
    this.errorMessage = '';
    this.devolutionsService.getEntities().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.entities) {
          this.entities = res.entities;
          if (this.entities.length === 0) {
            this.errorMessage = 'No tienes entidades asignadas para devoluciones.';
          } else if (this.entities.length === 1 && this.isEntityActive(this.entities[0])) {
            this.selectEntity(this.entities[0]);
          }
        } else {
          this.errorMessage = 'Error al cargar entidades.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error de conexión al cargar entidades.';
      }
    });
  }

  isEntityActive(entity: any): boolean {
    return entity?.status === 'activo' || entity?.status === 1;
  }

  selectEntity(entity: any) {
    if (!this.isEntityActive(entity)) {
      this.alertModal.show('Entidad inactiva', 'No puedes seleccionar una entidad inactiva para devoluciones.');
      return;
    }
    this.selectedEntity = entity;
    this.loadSellers();
    this.step = 'vendedores';
  }

  loadSorteos() {
    if (!this.selectedEntity) return;
    this.loading = true;
    this.errorMessage = '';
    this.devolutionsService.getLotteriesByEntity(this.selectedEntity.id).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.lotteries) {
          this.lotteries = res.lotteries;
          if (this.lotteries.length === 0) {
            this.errorMessage = 'No hay sorteos asignados a esta entidad.';
          }
        } else {
          this.errorMessage = 'Error al cargar sorteos.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al cargar sorteos.';
      }
    });
  }

  selectSorteo(lottery: any) {
    this.selectedLottery = lottery;
    this.loadReserves();
    this.loadSets(); // se mantiene para poder calcular liquidación por set cuando sea necesario
    this.step = 'participaciones';
  }

  loadSellers() {
    if (!this.selectedEntity) return;
    this.loading = true;
    this.errorMessage = '';
    this.devolutionsService.getSellersByEntity(this.selectedEntity.id).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.sellers) {
          this.sellers = res.sellers;
          if (this.sellers.length === 1) {
            this.selectSeller(this.sellers[0]);
          } else if (this.sellers.length === 0) {
            this.selectedSeller = null;
            this.loadSorteos();
            this.step = 'sorteos';
          }
        } else {
          this.errorMessage = 'Error al cargar vendedores.';
        }
      },
      error: () => {
        this.loading = false;
        this.sellers = [];
        this.selectedSeller = null;
        this.loadSorteos();
        this.step = 'sorteos';
      }
    });
  }

  selectSeller(seller: any) {
    this.selectedSeller = seller;
    this.loadSorteos();
    this.step = 'sorteos';
  }

  loadReserves() {
    if (!this.selectedEntity || !this.selectedLottery) return;
    this.loading = true;
    this.errorMessage = '';
    this.availableToReturn = null;
    this.devolutionsService
      .getReservesByEntityAndLottery(this.selectedEntity.id, this.selectedLottery.id)
      .subscribe({
        next: (res) => {
          this.loading = false;
          if (res.success && res.reserves) {
            this.reserves = res.reserves;
            this.selectedReserve = this.reserves.length === 1 ? this.reserves[0] : null;
            this.loadAvailableToReturn();
          } else {
            this.reserves = [];
            this.selectedReserve = null;
            this.errorMessage = 'No hay reservas disponibles para este sorteo.';
          }
        },
        error: (err) => {
          this.loading = false;
          this.reserves = [];
          this.selectedReserve = null;
          this.errorMessage = err?.error?.message || 'Error al cargar reservas.';
        }
      });
  }

  /** Cargar conteo de participaciones disponibles para devolver (entidad o vendedor en la reserva) */
  loadAvailableToReturn() {
    if (!this.selectedEntity || !this.selectedLottery || !this.selectedReserve) {
      this.availableToReturn = null;
      return;
    }
    const reserveId = typeof this.selectedReserve === 'object' ? this.selectedReserve?.id : this.selectedReserve;
    if (!reserveId) {
      this.availableToReturn = null;
      return;
    }
    this.loadingAvailable = true;
    const params: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      reserve_id: reserveId,
      participations: []
    };
    if (this.selectedSeller?.id) {
      params.seller_id = this.selectedSeller.id;
      params.tipo_devolucion = 'vendedor';
    }
    this.devolutionsService.getLiquidationSummary(params).subscribe({
      next: (res) => {
        this.loadingAvailable = false;
        if (res.success && res.summary) {
          const s = res.summary;
          this.availableToReturn = s.available_to_return ?? s.available_participations ?? 0;
          this.availableToReturnFisicas = s.available_to_return_fisicas ?? s.total_fisicas ?? 0;
          this.availableToReturnDigitales = s.available_to_return_digitales ?? s.total_digitales ?? 0;
        } else {
          this.availableToReturn = null;
        }
      },
      error: () => {
        this.loadingAvailable = false;
        this.availableToReturn = null;
      }
    });
  }

  /** Al cambiar la reserva en el selector, actualizar disponibles para devolver */
  onReserveChange() {
    this.loadAvailableToReturn();
  }

  loadSets() {
    if (!this.selectedEntity || !this.selectedLottery) return;
    this.loading = true;
    this.errorMessage = '';
    this.devolutionsService.getSetsByEntityAndLottery(this.selectedEntity.id, this.selectedLottery.id).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.sets) {
          this.sets = res.sets;
          this.selectedSet = this.sets.length === 1 ? this.sets[0] : null;
          if (this.sets.length === 0) {
            this.errorMessage = 'No hay sets con participaciones disponibles para este sorteo.';
          }
        } else {
          this.errorMessage = 'Error al cargar sets.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al cargar sets.';
      }
    });
  }

  compareSet(a: any, b: any): boolean {
    return a && b && a.id === b.id;
  }

  selectSet(set: any) {
    this.selectedSet = set;
  }

  onSetChange(ev: any) {
    const v = ev?.detail?.value;
    if (v != null) this.selectedSet = v;
  }

  validarYAsignar() {
    if (!this.selectedEntity || !this.selectedLottery || !this.selectedReserve) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad, sorteo y reserva.');
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

  private validarRango(desde: number, hasta: number) {
    this.loading = true;
    const params: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      reserve_id: this.selectedReserve.id,
      desde,
      hasta
    };
    if (this.selectedSeller?.id) params.seller_id = this.selectedSeller.id;
    this.devolutionsService.validateParticipations(params).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          this.agregarParticipacionesSinDuplicar(res.participations);
          this.rangoDesde = '';
          this.rangoHasta = '';
          this.unidadNumero = '';
        } else {
          this.mostrarAlerta('Sin resultados', 'No hay participaciones disponibles en ese rango.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al validar el rango.');
      }
    });
  }

  private validarUnidad(numero: number) {
    this.loading = true;
    const params: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      set_id: this.selectedSet.id,
      participation_id: numero
    };
    if (this.selectedSeller?.id) params.seller_id = this.selectedSeller.id;
    this.devolutionsService.validateParticipations(params).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          this.agregarParticipacionesSinDuplicar(res.participations);
          this.unidadNumero = '';
          this.rangoDesde = '';
          this.rangoHasta = '';
        } else {
          this.mostrarAlerta('Sin resultados', 'No se encontró esa participación o no está disponible.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al validar la participación.');
      }
    });
  }

  private agregarParticipacionesSinDuplicar(participations: any[]) {
    for (const p of participations) {
      const id = p.id;
      const setId = p.set_id ?? this.selectedSet?.id;
      const setNombre = p.set_name ?? this.selectedSet?.set_name ?? this.selectedSet?.name ?? 'Set';
      if (!this.participacionesAsignadas.find(x => x.id === id)) {
        this.participacionesAsignadas.push({
          id,
          number: p.number,
          participation_code: p.participation_code || '',
          set_id: setId,
          set_name: setNombre
        });
      }
    }
  }

  quitarParticipacion(p: { id: number }) {
    this.participacionesAsignadas = this.participacionesAsignadas.filter(x => x.id !== p.id);
  }

  /** Terminar selección: ir al resumen de participaciones a devolver (puede ser sin participaciones, como en la web) */
  irAResumen() {
    this.step = 'resumen';
  }

  /** Desde resumen: volver a participaciones para seguir editando la lista */
  aceptarResumenVolver() {
    this.step = 'participaciones';
  }

  /** Desde resumen: pasar a liquidación (cargar resumen financiero y formas de pago) */
  irALiquidacion() {
    this.step = 'liquidacion';
    this.cargarResumenLiquidacion();
  }

  /** Desde participaciones: ir a liquidación sin añadir ninguna participación (liquidar sin devolver) */
  irALiquidacionSinDevolver() {
    if (!this.selectedEntity || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad y sorteo.');
      return;
    }
    this.step = 'liquidacion';
    this.cargarResumenLiquidacion();
  }

  cargarResumenLiquidacion() {
    if (!this.selectedEntity || !this.selectedLottery) return;
    this.loading = true;
    // Si no hay participaciones pero hay sets, usar el set seleccionado o el primero (liquidar sin devolver)
    if (this.participacionesAsignadas.length === 0 && this.sets.length > 0 && !this.selectedSet) {
      this.selectedSet = this.sets[0];
    }
    const participationIds = this.participacionesAsignadas.map(p => p.id);
    const setId = this.participacionesAsignadas.length > 0
      ? this.participacionesAsignadas[0].set_id
      : this.selectedSet?.id;

    const summaryParams: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      set_id: setId ?? undefined,
      participations: participationIds
    };
    if (this.selectedSeller?.id) {
      summaryParams.seller_id = this.selectedSeller.id;
      summaryParams.tipo_devolucion = 'vendedor';
    }
    this.devolutionsService.getLiquidationSummary(summaryParams).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.summary) {
          this.summary = res.summary;
        } else {
          this.errorMessage = 'No se pudo calcular el resumen de liquidación.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al cargar el resumen.';
      }
    });
  }

  get totalPagarAhora(): number {
    const a = parseFloat(this.pagoEfectivo) || 0;
    const b = parseFloat(this.pagoBizum) || 0;
    const c = parseFloat(this.pagoTransferencia) || 0;
    return a + b + c;
  }

  get totalAPagar(): number {
    return this.summary?.total_to_pay ?? this.summary?.total_liquidation ?? 0;
  }

  get pendiente(): number {
    return this.totalAPagar - this.totalPagarAhora;
  }

  /** Precio por participación del set (para mostrar importes en resumen) */
  get precioPorParticipacion(): number {
    const setsInfo = this.summary?.sets_info;
    if (setsInfo && setsInfo.length > 0 && setsInfo[0].price_per_participation != null) {
      return Number(setsInfo[0].price_per_participation);
    }
    return 0;
  }

  get totalParticipacionesImporte(): number {
    return (this.summary?.total_participations ?? 0) * this.precioPorParticipacion;
  }

  get ventasRegistradasImporte(): number {
    const n = this.summary?.ventas_registradas ?? this.summary?.sold_participations ?? 0;
    return n * this.precioPorParticipacion;
  }

  get devueltasImporte(): number {
    return (this.summary?.returned_participations ?? 0) * this.precioPorParticipacion;
  }

  get disponiblesImporte(): number {
    return (this.summary?.available_participations ?? 0) * this.precioPorParticipacion;
  }

  /** Solo devolución (sin liquidar), como en la web */
  aceptarSoloDevolucion() {
    if (!this.selectedEntity || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad y sorteo.');
      return;
    }
    if (this.participacionesAsignadas.length === 0) {
      this.mostrarAlerta('Sin participaciones', 'Añade al menos una participación para devolver.');
      return;
    }

    const ids = this.participacionesAsignadas.map(p => p.id);
    const setId = this.participacionesAsignadas.length > 0
      ? this.participacionesAsignadas[0].set_id
      : this.selectedSet?.id;

    this.procesando = true;
    const storeBody: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      set_id: setId ?? undefined,
      return_reason: this.selectedSeller?.id ? 'Devolución de vendedor a entidad' : 'Devolución de entidad a administración',
      solo_devolucion: true,
      liquidacion: {
        devolver: ids,
        vender: [],
        pagos: []
      }
    };
    if (this.selectedSeller?.id) {
      storeBody.seller_id = this.selectedSeller.id;
      storeBody.tipo_devolucion = 'vendedor';
    }

    this.devolutionsService.storeDevolution(storeBody).subscribe({
      next: (res) => {
        this.procesando = false;
        if (res.success) {
          this.mostrarAlerta('Devolución registrada', 'Las participaciones se han devuelto correctamente (sin liquidar).');
          this.reiniciarFlujo();
        } else {
          this.mostrarAlerta('Error', res.message || 'No se pudo procesar la devolución.');
        }
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al procesar la devolución.');
      }
    });
  }

  openLiquidationModal() {
    this.pagoEfectivo = '';
    this.pagoBizum = '';
    this.pagoTransferencia = '';
    this.showLiquidationModal = true;
  }

  closeLiquidationModal() {
    this.showLiquidationModal = false;
  }

  confirmarLiquidacion() {
    if (!this.selectedEntity || !this.selectedLottery) return;
    const pagos: Array<{ payment_method: string; amount: number }> = [];
    const efectivo = parseFloat(this.pagoEfectivo) || 0;
    const bizum = parseFloat(this.pagoBizum) || 0;
    const transferencia = parseFloat(this.pagoTransferencia) || 0;
    if (efectivo > 0) pagos.push({ payment_method: 'efectivo', amount: efectivo });
    if (bizum > 0) pagos.push({ payment_method: 'bizum', amount: bizum });
    if (transferencia > 0) pagos.push({ payment_method: 'transferencia', amount: transferencia });

    if (pagos.length === 0) {
      this.mostrarAlerta('Aviso', 'Debes registrar al menos un pago para completar la liquidación.');
      return;
    }

    const ids = this.participacionesAsignadas.map(p => p.id);
    const setId = this.participacionesAsignadas.length > 0
      ? this.participacionesAsignadas[0].set_id
      : this.selectedSet?.id;

    const storeBody: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      set_id: setId ?? undefined,
      reserve_id: this.selectedReserve?.id ?? undefined,
      return_reason: this.selectedSeller?.id ? 'Devolución de vendedor a entidad' : 'Devolución de entidad a administración',
      tipo_devolucion: this.selectedSeller?.id ? 'vendedor' : 'administracion',
      liquidacion: {
        devolver: ids,
        vender: [],
        pagos
      }
    };
    if (this.selectedSeller?.id) {
      storeBody.seller_id = this.selectedSeller.id;
    }

    if (!this.selectedSeller?.id) {
      this.pendingLiquidationBody = storeBody;
      this.prizePaymentMode = null;
      this.prizePaymentModeConfirmed = false;
      this.closeLiquidationModal();
      this.showPaymentModeModal = true;
      return;
    }

    this.ejecutarLiquidacion(storeBody);
  }

  closePaymentModeModal() {
    this.showPaymentModeModal = false;
    this.pendingLiquidationBody = null;
    this.prizePaymentMode = null;
    this.onlinePayer = 'partilot';
    this.prizePaymentModeConfirmed = false;
  }

  selectPrizePaymentMode(mode: 'presencial' | 'online', onlinePayer: 'partilot' | 'entity' = 'partilot') {
    this.prizePaymentMode = mode;
    this.onlinePayer = onlinePayer;
  }

  canConfirmPrizePaymentMode(): boolean {
    return !!this.prizePaymentMode && this.prizePaymentModeConfirmed;
  }

  confirmarModalidadPago() {
    if (!this.pendingLiquidationBody || !this.canConfirmPrizePaymentMode()) {
      this.mostrarAlerta('Aviso', 'Selecciona la modalidad de pago y confírmala.');
      return;
    }
    const body = {
      ...this.pendingLiquidationBody,
      prize_payment_mode: this.prizePaymentMode,
      ...(this.prizePaymentMode === 'online' ? { online_payer: this.onlinePayer } : {}),
    };
    this.showPaymentModeModal = false;
    this.ejecutarLiquidacion(body);
    this.pendingLiquidationBody = null;
    this.prizePaymentMode = null;
    this.onlinePayer = 'partilot';
    this.prizePaymentModeConfirmed = false;
  }

  private ejecutarLiquidacion(storeBody: any) {
    this.procesando = true;
    this.devolutionsService.storeDevolution(storeBody).subscribe({
      next: (res) => {
        this.procesando = false;
        this.closeLiquidationModal();
        if (res.success) {
          this.showLiquidationSuccessModal = true;
        } else {
          this.mostrarAlerta('Error', res.message || 'No se pudo procesar la devolución.');
        }
      },
      error: (err) => {
        this.procesando = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al procesar la devolución.');
      }
    });
  }

  closeLiquidationSuccessModal() {
    this.showLiquidationSuccessModal = false;
    this.reiniciarFlujo();
  }

  reiniciarFlujo() {
    this.step = 'entidades';
    this.selectedEntity = null;
    this.selectedLottery = null;
    this.selectedSeller = null;
    this.selectedReserve = null;
    this.selectedSet = null;
    this.reserves = [];
    this.lotteries = [];
    this.sellers = [];
    this.sets = [];
    this.participacionesAsignadas = [];
    this.summary = null;
    this.rangoDesde = '';
    this.rangoHasta = '';
    this.unidadNumero = '';
    this.pagoEfectivo = '';
    this.pagoBizum = '';
    this.pagoTransferencia = '';
    this.loadEntities();
  }

  backToEntidades() {
    this.step = 'entidades';
    this.selectedEntity = null;
    this.selectedLottery = null;
    this.lotteries = [];
    this.loadEntities();
  }

  backToSorteos() {
    this.step = 'sorteos';
    this.selectedLottery = null;
    this.sets = [];
    this.selectedSet = null;
    this.participacionesAsignadas = [];
    this.summary = null;
  }

  backToVendedores() {
    this.step = 'vendedores';
    this.selectedLottery = null;
    this.sets = [];
    this.selectedSet = null;
    this.participacionesAsignadas = [];
    this.summary = null;
  }

  backToParticipaciones() {
    this.step = 'participaciones';
    this.summary = null;
  }

  backToResumen() {
    this.step = 'resumen';
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = imagePath.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  /** Imagen del vendedor/usuario (storage), igual que en gestor-vendedores */
  getUserImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = imagePath.replace(/^storage\/?/, '');
    return `${base}/storage/${normalized}`;
  }

  /** Path de imagen del vendedor (API devuelve seller.image o seller.user?.image) */
  getSellerImage(seller: any): string | null | undefined {
    return seller?.image ?? seller?.user?.image ?? null;
  }

  onLotteryImageError(lot: any) {
    if (lot) lot.image = null;
  }

  async mostrarAlerta(header: string, message: string) {
    await this.alertModal.show(header, message);
  }

  /** QR para participación unidad: escanea y añade esa participación a la lista */
  async escanearQRUnidad() {
    if (!this.selectedEntity || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad y sorteo antes de escanear.');
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
        this.mostrarAlerta('QR no válido', 'No se pudo obtener la referencia de la participación.');
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

  /** QR para rango "desde": escanea y rellena el campo desde con el número de participación */
  async escanearQRParaDesde() {
    if (!this.selectedEntity || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad y sorteo.');
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

  /** QR para rango "hasta": escanea y rellena el campo hasta con el número de participación */
  async escanearQRParaHasta() {
    if (!this.selectedEntity || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad y sorteo.');
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
    this.devolutionsService.validateParticipations({
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      referencia
    }).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          const num = res.participations[0].number ?? res.participations[0].participation_number;
          if (num != null) {
            if (campo === 'desde') this.rangoDesde = String(num);
            else this.rangoHasta = String(num);
            const first = res.participations[0];
            if (first.set_id && this.sets.length > 0) {
              const set = this.sets.find(s => s.id === first.set_id);
              if (set) this.selectedSet = set;
            }
          } else {
            this.mostrarAlerta('Error', 'No se obtuvo el número de participación.');
          }
        } else {
          this.mostrarAlerta('Sin resultados', res?.message || 'No se encontró esa participación.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al validar el QR.');
      }
    });
  }

  private extraerReferenciaDeQR(qrText: string | null): string | null {
    if (!qrText) return null;
    const trimmed = qrText.trim();
    if (!trimmed) return null;
    const urlMatch = trimmed.match(/(?:participation|ref|referencia)[=\/:]\s*([a-zA-Z0-9_-]+)/i);
    if (urlMatch) return urlMatch[1];
    if (/^[a-zA-Z0-9_-]{1,64}$/.test(trimmed)) return trimmed;
    return trimmed;
  }

  private validarPorReferencia(referencia: string) {
    this.loading = true;
    const params: any = {
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      referencia
    };
    if (this.selectedSeller?.id) params.seller_id = this.selectedSeller.id;
    this.devolutionsService.validateParticipations(params).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.participations && res.participations.length > 0) {
          this.agregarParticipacionesSinDuplicar(res.participations);
          this.unidadNumero = '';
          this.rangoDesde = '';
          this.rangoHasta = '';
          const first = res.participations[0];
          if (first.set_id && this.sets.length > 0 && !this.sets.find(s => s.id === first.set_id)) {
            this.selectedSet = { id: first.set_id, set_name: first.set_name };
          } else if (first.set_id && this.sets.find(s => s.id === first.set_id)) {
            this.selectedSet = this.sets.find(s => s.id === first.set_id);
          }
        } else {
          this.mostrarAlerta('Sin resultados', res?.message || 'No se encontró esa participación o no está disponible para devolución.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al validar el QR.');
      }
    });
  }
}
