import { Component, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { VentasService } from '../core/services/ventas.service';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import { AlertModalService } from '../core/services/alert-modal.service';
import { DevolucionPreselectService } from '../core/services/devolucion-preselect.service';
import { environment } from '../../environments/environment';
import { refreshWithLoadingWatch } from '../core/utils/ion-refresher.util';

@Component({
  selector: 'app-gestor-vendedores',
  templateUrl: './gestor-vendedores.page.html',
  styleUrls: ['./gestor-vendedores.page.scss'],
  standalone: false,
})
export class GestorVendedoresPage implements OnInit, OnDestroy {
  /** Fondo de ion-tabs mientras hay un overlay inferior (huecos laterales del menú pill). */
  private static readonly TABS_STRIP_SHEET_CLASS = 'ion-tabs-strip-sheet';
  entities: any[] = [];
  selectedEntity: any = null;
  showEntitySelection = false;
  showSellersList = false;
  sellers: any[] = [];
  loading = false;

  filterNombre = '';
  filterImporte: 'todos' | 'con-saldo' | 'liquidado' = 'todos';
  filterGrupo = '';
  openFilterPanel: 'nombre' | 'importe' | 'grupo' | null = null;

  showAddSellerScreen = false;
  showSellerDetail = false;
  sellerDetail: {
    seller: any;
    participations_summary: any;
    liquidation_summary: any;
    lotteries_with_pending?: Array<{ lottery_id: number; lottery_name: string; pending_amount: number }>;
  } | null = null;
  loadingDetail = false;
  showLiquidationModal = false;
  showLiquidationSuccessModal = false;
  savingSettlement = false;
  liquidationForm = { efectivo: '' as string | number, bizum: '' as string | number, transferencia: '' as string | number };
  /** Lotería seleccionada para la liquidación (primera con pendiente) */
  selectedLotteryForSettlement: { lottery_id: number; lottery_name: string; pending_amount: number } | null = null;
  showSearchUserSheet = false;
  showExternalFormSheet = false;
  showMatchModal = false;
  showNoMatchModal = false;
  showVerMasSheet = false;
  pendingRefreshSellerId: number | null = null;
  pendingRefreshEntityId: number | null = null;
  pendingRefreshSellerName = '';

  partilotEmail = '';
  partilotEmailChecked: boolean | null = null;
  /** Email guardado al pasar del buscador al modal de confirmación */
  pendingInviteEmail = '';
  savingPartilot = false;
  savingExternal = false;

  externalForm: {
    name: string;
    last_name: string;
    last_name2: string;
    email: string;
    phone: string;
    birthday: string;
    nif_cif: string;
  } = {
    name: '',
    last_name: '',
    last_name2: '',
    email: '',
    phone: '',
    birthday: '',
    nif_cif: '',
  };

  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'gestor';

  constructor(
    private router: Router,
    private ventasService: VentasService,
    public authService: AuthService,
    private alertModal: AlertModalService,
    private devolucionPreselect: DevolucionPreselectService,
    private roleSwitchService: RoleSwitchService
  ) {}

  detectarRol(): void {
    const ruta = window.location.pathname;
    const tieneSeller = this.authService.isSeller();
    const esGestor = this.authService.isManager();

    if (ruta.includes('/vendedor-tab') && tieneSeller) {
      this.rolActual = 'vendedor';
      localStorage.setItem('rolActual', 'vendedor');
      localStorage.setItem('esVendedor', 'true');
      return;
    }
    if ((ruta.includes('/gestor-tab') || ruta.includes('gestor-vendedores')) && esGestor) {
      this.rolActual = 'gestor';
      localStorage.setItem('rolActual', 'gestor');
      localStorage.setItem('esVendedor', 'false');
      return;
    }
    const rolGuardado = localStorage.getItem('rolActual');
    if (rolGuardado) {
      this.rolActual = rolGuardado as 'usuario' | 'vendedor' | 'gestor';
      if (this.rolActual === 'vendedor' && !tieneSeller) this.rolActual = 'usuario';
      if (this.rolActual === 'gestor' && !esGestor) this.rolActual = tieneSeller ? 'vendedor' : 'usuario';
    } else {
      this.rolActual = esGestor ? 'gestor' : (tieneSeller ? 'vendedor' : 'usuario');
      localStorage.setItem('rolActual', this.rolActual);
    }
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor'): void {
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
        this.router.navigate(['/tabs/gestor-tab3']);
      }
    });
  }

  get uniqueGroupNames(): string[] {
    const set = new Set<string>();
    this.sellers.forEach((s) => {
      const groups = (s.group_name || []) as string[];
      groups.forEach((g) => {
        if (g && String(g).trim()) set.add(String(g).trim());
      });
    });
    return Array.from(set).sort();
  }

  get hasActiveFilters(): boolean {
    return this.filterNombre.trim() !== '' || this.filterImporte !== 'todos' || this.filterGrupo !== '';
  }

  get filteredSellers(): any[] {
    let list = this.sellers;
    const nombre = this.filterNombre.trim().toLowerCase();
    if (nombre) {
      list = list.filter(
        (s) =>
          (s.name && (s.name as string).toLowerCase().includes(nombre)) ||
          (s.first_name && (s.first_name as string).toLowerCase().includes(nombre)) ||
          (s.last_name && (s.last_name as string).toLowerCase().includes(nombre))
      );
    }
    if (this.filterImporte === 'con-saldo') {
      list = list.filter((s) => (s.pending_amount || 0) > 0);
    } else if (this.filterImporte === 'liquidado') {
      list = list.filter((s) => (s.pending_amount || 0) === 0);
    }
    if (this.filterGrupo !== '') {
      list = list.filter((s) => ((s.group_name || []) as string[]).includes(this.filterGrupo));
    }
    return list;
  }

  onFilterChange(): void {}

  setFilterImporte(value: 'todos' | 'con-saldo' | 'liquidado'): void {
    this.filterImporte = value;
  }

  setFilterGrupo(value: string): void {
    this.filterGrupo = value;
  }

  openSellerDetail(seller: any): void {
    if (!this.selectedEntity || !seller?.id) return;
    const displayName = seller.name || (seller.first_name + ' ' + (seller.last_name || '')).trim() || 'Vendedor';
    this.sellerDetail = {
      seller: { id: seller.id, name: displayName, image: seller.image },
      participations_summary: {},
      liquidation_summary: {},
      lotteries_with_pending: [],
    };
    this.showSellerDetail = true;
    this.loadSellerDetail();
  }

  backToSellerList(): void {
    this.showSellerDetail = false;
    this.sellerDetail = null;
    if (this.selectedEntity) {
      this.loadSellers();
    }
  }

  loadSellerDetail(): void {
    if (!this.selectedEntity || !this.sellerDetail?.seller?.id) return;
    const sellerId = this.sellerDetail.seller.id;
    const entityId = this.selectedEntity.id;
    this.loadingDetail = true;
    this.ventasService.getManagerSellerDetail(entityId, sellerId).subscribe({
      next: (res: any) => {
        this.loadingDetail = false;
        if (res.success) {
          this.sellerDetail = {
            seller: res.seller,
            participations_summary: res.participations_summary || {},
            liquidation_summary: res.liquidation_summary || {},
            lotteries_with_pending: res.lotteries_with_pending || [],
          };
        } else {
          this.showAlerta('Error', res.message || 'Error al cargar el detalle.');
        }
      },
      error: (err) => {
        this.loadingDetail = false;
        this.showAlerta('Error', err?.error?.message || 'Error al cargar el detalle.');
      },
    });
  }

  openLiquidationModal(): void {
    const list = this.sellerDetail?.lotteries_with_pending || [];
    this.selectedLotteryForSettlement = list.length > 0 ? list[0] : null;
    this.liquidationForm = { efectivo: '', bizum: '', transferencia: '' };
    this.showLiquidationModal = true;
    this.syncTabsStripForBottomOverlays();
  }

  closeLiquidationModal(): void {
    this.showLiquidationModal = false;
    this.selectedLotteryForSettlement = null;
    this.syncTabsStripForBottomOverlays();
  }

  get liquidationImporteTotal(): number {
    return this.selectedLotteryForSettlement?.pending_amount ?? this.sellerDetail?.liquidation_summary?.total_to_pay ?? 0;
  }

  get liquidationTotalPagarAhora(): number {
    const e = Number(this.liquidationForm.efectivo) || 0;
    const b = Number(this.liquidationForm.bizum) || 0;
    const t = Number(this.liquidationForm.transferencia) || 0;
    return e + b + t;
  }

  submitLiquidation(): void {
    const pagos: Array<{ payment_method: string; amount: number }> = [];
    const efectivo = Number(this.liquidationForm.efectivo) || 0;
    const bizum = Number(this.liquidationForm.bizum) || 0;
    const transferencia = Number(this.liquidationForm.transferencia) || 0;
    if (efectivo > 0) pagos.push({ payment_method: 'efectivo', amount: efectivo });
    if (bizum > 0) pagos.push({ payment_method: 'bizum', amount: bizum });
    if (transferencia > 0) pagos.push({ payment_method: 'transferencia', amount: transferencia });
    if (pagos.length === 0) {
      this.showAlerta('Aviso', 'Debes ingresar al menos un importe.');
      return;
    }
    if (!this.selectedEntity || !this.sellerDetail?.seller?.id || !this.selectedLotteryForSettlement) {
      this.showAlerta('Error', 'Faltan datos para la liquidación.');
      return;
    }
    this.savingSettlement = true;
    this.ventasService
      .storeManagerSettlement(this.selectedEntity.id, this.sellerDetail.seller.id, {
        lottery_id: this.selectedLotteryForSettlement.lottery_id,
        pagos,
      })
      .subscribe({
        next: (res: any) => {
          this.savingSettlement = false;
          this.closeLiquidationModal();
          if (res.success) {
            this.showLiquidationSuccessModal = true;
            this.syncTabsStripForBottomOverlays();
          } else {
            this.showAlerta('Error', res.message || 'Error al registrar la liquidación.');
          }
        },
        error: (err) => {
          this.savingSettlement = false;
          this.showAlerta('Error', err?.error?.message || 'Error al registrar la liquidación.');
        },
      });
  }

  closeLiquidationSuccessModal(): void {
    this.showLiquidationSuccessModal = false;
    this.syncTabsStripForBottomOverlays();
    this.loadSellerDetail();
  }

  toggleFilterPanel(panel: 'nombre' | 'importe' | 'grupo'): void {
    this.openFilterPanel = this.openFilterPanel === panel ? null : panel;
  }

  ngOnInit() {
    this.detectarRol();
    this.restoreSellerDetailState();
    this.loadEntities();
  }

  ionViewWillEnter() {
    this.detectarRol();
    this.restoreSellerDetailState();
    // Solo refrescar el detalle al volver a la pestaña; no volver a cargar el listado aquí
    // (loadSellers pone `loading=true` y el spinner global se superpone al detalle ya cargado).
    if (this.showSellerDetail && this.sellerDetail?.seller?.id) {
      this.loadSellerDetail();
      return;
    }
    if (this.selectedEntity && this.showSellersList) {
      this.loadSellers();
    } else if (!this.selectedEntity && this.entities.length > 0) {
      this.loadEntities();
    }
  }

  handleRefresh(event: CustomEvent): void {
    refreshWithLoadingWatch(event, () => this.loading, () => {
      if (this.showSellerDetail && this.sellerDetail?.seller?.id) {
        this.loadSellerDetail();
      } else if (this.showSellersList && this.selectedEntity) {
        this.loadSellers();
      } else {
        this.loadEntities();
      }
    });
  }

  ionViewWillLeave(): void {
    this.clearTabsStripSheetOverlay();
  }

  ngOnDestroy(): void {
    this.clearTabsStripSheetOverlay();
  }

  private clearTabsStripSheetOverlay(): void {
    document.querySelector('ion-tabs')?.classList.remove(GestorVendedoresPage.TABS_STRIP_SHEET_CLASS);
  }

  /** Rellena los laterales del menú pill con blanco cuando hay un sheet/modal inferior abierto. */
  private syncTabsStripForBottomOverlays(): void {
    const anyOpen =
      this.showVerMasSheet ||
      this.showLiquidationModal ||
      this.showLiquidationSuccessModal ||
      this.showSearchUserSheet ||
      this.showExternalFormSheet ||
      this.showMatchModal ||
      this.showNoMatchModal;
    const tabs = document.querySelector('ion-tabs');
    if (!tabs) return;
    tabs.classList.toggle(GestorVendedoresPage.TABS_STRIP_SHEET_CLASS, anyOpen);
  }

  private restoreSellerDetailState(): void {
    const state = (history.state || {}) as any;
    if (!state?.refreshSellerDetail) return;
    if (state.entity_id) this.pendingRefreshEntityId = Number(state.entity_id);
    if (state.seller_id) this.pendingRefreshSellerId = Number(state.seller_id);
    if (state.seller_name) this.pendingRefreshSellerName = String(state.seller_name);
  }

  private tryOpenPendingSellerDetail(): void {
    if (!this.pendingRefreshSellerId) return;
    const sellerId = this.pendingRefreshSellerId;
    const seller =
      this.sellers.find((s) => Number(s.id) === sellerId) ||
      { id: sellerId, name: this.pendingRefreshSellerName || 'Vendedor' };
    this.pendingRefreshSellerId = null;
    this.pendingRefreshSellerName = '';
    this.showSellerDetail = true;
    this.openSellerDetail(seller);
  }

  loadEntities() {
    this.loading = true;
    this.ventasService.getManagerEntities().subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success && res.entities) {
          this.entities = res.entities || [];
          if (this.pendingRefreshEntityId) {
            const entityMatch = this.entities.find((e: any) => Number(e.id) === this.pendingRefreshEntityId);
            if (entityMatch) {
              this.selectedEntity = entityMatch;
              this.showEntitySelection = false;
              this.showSellersList = true;
              this.pendingRefreshEntityId = null;
              this.loadSellers();
              return;
            }
          }
          if (this.entities.length === 1) {
            this.selectedEntity = this.entities[0];
            this.loadSellers();
          } else if (this.entities.length > 1) {
            this.showEntitySelection = true;
            this.showSellersList = false;
          }
        } else {
          this.showAlerta('Error', res.message || 'Error al cargar entidades.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.showAlerta('Error', err?.error?.message || 'Error al cargar entidades.');
      },
    });
  }

  selectEntity(entity: any) {
    this.selectedEntity = entity;
    this.showEntitySelection = false;
    this.loadSellers();
  }

  goToAsignacion(): void {
    if (!this.selectedEntity?.id || !this.sellerDetail?.seller?.id) {
      this.showAlerta('Aviso', 'Selecciona una entidad y un vendedor.');
      return;
    }
    this.router.navigate(['/tabs/gestor-asignacion'], {
      state: {
        seller_id: this.sellerDetail.seller.id,
        entity_id: this.selectedEntity.id,
        seller_name: this.sellerDetail.seller.name || this.sellerDetail.seller.first_name || 'Vendedor'
      }
    });
  }

  /** Ir a Devoluciones con esta entidad y vendedor preseleccionados (lleva a elegir sorteo) */
  goToDevolucion(): void {
    if (!this.selectedEntity?.id || !this.sellerDetail?.seller?.id) return;
    this.devolucionPreselect.setFromDetail(this.selectedEntity, this.sellerDetail.seller);
    this.router.navigate(['/tabs/gestor-tab4']);
  }

  backToEntities() {
    this.showSellersList = false;
    this.selectedEntity = null;
    this.sellers = [];
    if (this.entities.length > 1) {
      this.showEntitySelection = true;
    }
  }

  goBackFromRoot(): void {
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    this.router.navigate(['/tabs/gestor-tab3']);
  }

  loadSellers() {
    if (!this.selectedEntity) return;
    this.loading = true;
    this.ventasService.getManagerEntitySellers(this.selectedEntity.id).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          this.sellers = res.sellers || [];
          this.showSellersList = true;
          this.tryOpenPendingSellerDetail();
        } else {
          this.showAlerta('Error', res.message || 'Error al cargar vendedores.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.showAlerta('Error', err?.error?.message || 'Error al cargar vendedores.');
      },
    });
  }

  openAddSellerOptions() {
    this.showAddSellerScreen = true;
  }

  closeAddSellerScreen() {
    this.showAddSellerScreen = false;
  }

  openPartilotFlow() {
    this.closeAddSellerScreen();
    this.partilotEmail = '';
    this.partilotEmailChecked = null;
    this.showSearchUserSheet = true;
    this.syncTabsStripForBottomOverlays();
  }

  openExternalForm() {
    this.closeAddSellerScreen();
    this.externalForm = {
      name: '',
      last_name: '',
      last_name2: '',
      email: '',
      phone: '',
      birthday: '',
      nif_cif: '',
    };
    this.showExternalFormSheet = true;
    this.syncTabsStripForBottomOverlays();
  }

  closeSearchUserSheet() {
    this.showSearchUserSheet = false;
    this.partilotEmail = '';
    this.partilotEmailChecked = null;
    this.syncTabsStripForBottomOverlays();
  }

  closeExternalFormSheet() {
    this.showExternalFormSheet = false;
    this.syncTabsStripForBottomOverlays();
  }

  closeMatchModal() {
    this.showMatchModal = false;
    this.pendingInviteEmail = '';
    this.syncTabsStripForBottomOverlays();
  }

  closeNoMatchModal() {
    this.showNoMatchModal = false;
    this.pendingInviteEmail = '';
    this.syncTabsStripForBottomOverlays();
  }

  invitePartilot() {
    const email = (this.partilotEmail || '').trim();
    if (!email) return;
    this.ventasService.checkManagerUserEmail(email).subscribe({
      next: (res: any) => {
        const exists = res.exists === true;
        this.partilotEmailChecked = exists;
        this.pendingInviteEmail = email;
        this.closeSearchUserSheet();
        if (exists) {
          this.showMatchModal = true;
        } else {
          this.showNoMatchModal = true;
        }
        this.syncTabsStripForBottomOverlays();
      },
      error: () => {
        this.showAlerta('Error', 'No se pudo comprobar el email.');
      },
    });
  }

  confirmMatchOne() {
    const email = (this.pendingInviteEmail || '').trim();
    if (!email || !this.selectedEntity) {
      this.showAlerta('Error', 'No se pudo recuperar el email. Vuelve a intentarlo.');
      return;
    }
    this.savingPartilot = true;
    this.ventasService.storeManagerExistingUser(this.selectedEntity.id, email).subscribe({
      next: (res: any) => {
        this.savingPartilot = false;
        this.closeMatchModal();
        this.partilotEmail = '';
        this.showAlerta('Éxito', res.message || 'Vendedor añadido.');
        this.loadSellers();
      },
      error: (err) => {
        this.savingPartilot = false;
        this.showAlerta('Error', err?.error?.message || 'Error al añadir vendedor.');
      },
    });
  }

  confirmMatchZero() {
    const email = (this.pendingInviteEmail || '').trim();
    if (!email || !this.selectedEntity) {
      this.showAlerta('Error', 'No se pudo recuperar el email. Vuelve a intentarlo.');
      return;
    }
    // Igual que el panel web: 0 coincidencias también usa invitación SIPART solo con email.
    this.savingPartilot = true;
    this.ventasService.storeManagerExistingUser(this.selectedEntity.id, email).subscribe({
      next: (res: any) => {
        this.savingPartilot = false;
        this.closeNoMatchModal();
        this.partilotEmail = '';
        this.showAlerta('Éxito', res.message || 'Invitación enviada.');
        this.loadSellers();
      },
      error: (err) => {
        this.savingPartilot = false;
        this.showAlerta('Error', err?.error?.message || 'Error al enviar invitación.');
      },
    });
  }

  saveExternalSeller() {
    const email = (this.externalForm.email || '').trim();
    if (!email) {
      this.showAlerta('Datos requeridos', 'El email es obligatorio.');
      return;
    }
    if (!this.selectedEntity) return;
    this.savingExternal = true;
    const data: any = {
      email,
      name: this.externalForm.name?.trim() || undefined,
      last_name: this.externalForm.last_name?.trim() || undefined,
      last_name2: this.externalForm.last_name2?.trim() || undefined,
      phone: this.externalForm.phone?.trim() || undefined,
      birthday: this.externalForm.birthday || undefined,
      nif_cif: this.externalForm.nif_cif?.trim() || undefined,
    };
    this.ventasService.storeManagerExternalSeller(this.selectedEntity.id, data).subscribe({
      next: (res: any) => {
        this.savingExternal = false;
        this.closeExternalFormSheet();
        this.showAlerta('Éxito', res.message || 'Vendedor externo creado.');
        this.loadSellers();
      },
      error: (err) => {
        this.savingExternal = false;
        this.showAlerta('Error', err?.error?.message || 'Error al guardar.');
      },
    });
  }

  async showAlerta(header: string, message: string) {
    await this.alertModal.show(header, message);
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const apiBaseUrl = environment.apiUrl.replace('/api', '');
    return `${apiBaseUrl}/uploads/${imagePath}`;
  }
  
  getUserImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const apiBaseUrl = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = imagePath.replace(/^storage\/?/, '');
    return `${apiBaseUrl}/storage/${normalized}`;
  }

  openVerMasSheet(): void {
    this.showVerMasSheet = true;
    this.syncTabsStripForBottomOverlays();
  }

  closeVerMasSheet(): void {
    this.showVerMasSheet = false;
    this.syncTabsStripForBottomOverlays();
  }

  sellerLlamar(): void {
    const phone = this.sellerDetail?.seller?.phone?.replace(/\s/g, '') ?? '';
    if (phone) window.location.href = `tel:${phone}`;
  }

  sellerEmail(): void {
    const email = this.sellerDetail?.seller?.email ?? '';
    if (email) window.location.href = `mailto:${email}`;
  }
}
