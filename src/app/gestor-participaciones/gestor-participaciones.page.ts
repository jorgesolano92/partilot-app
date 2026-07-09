import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { VentasService } from '../core/services/ventas.service';
import { AuthService } from '../core/services/auth.service';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { refreshWithLoadingWatch } from '../core/utils/ion-refresher.util';

@Component({
  selector: 'app-gestor-participaciones',
  templateUrl: './gestor-participaciones.page.html',
  styleUrls: ['./gestor-participaciones.page.scss'],
  standalone: false,
})
export class GestorParticipacionesPage implements OnInit, OnDestroy {
  isVendedor: boolean = false;
  isGestor: boolean = false;
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'vendedor';
  
  // Vista 1: Selección de entidades
  entities: any[] = [];
  selectedEntity: any = null;
  showEntitySelection: boolean = false;
  
  // Vista 2: Lista de tacos
  summary: any = null;
  tacos: any[] = [];
  showTacosList: boolean = false;
  
  // Vista 3: Participaciones del taco
  selectedTaco: any = null;
  tacoParticipations: any[] = [];
  showTacoDetail: boolean = false;

  loading = false;
  private ventasChangedSub?: Subscription;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private ventasService: VentasService,
    public authService: AuthService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.isVendedor = this.authService.isSeller();
    this.detectarRol();
    // Carga solo en ionViewWillEnter para evitar doble carga (mensaje "no hay" duplicado)
    this.ventasChangedSub = this.ventasService.getVentasChanged().subscribe(() => {
      if (this.usaFlujoGestor) this.recargarVistaActualGestor();
      else if (this.usaFlujoVendedor) this.recargarVistaActual();
    });
  }

  ngOnDestroy() {
    this.ventasChangedSub?.unsubscribe();
  }

  /** Path del tab actual (vendedor-tab4, gestor-tab1, etc.) desde la ruta activa; más fiable que router.url al cargar. */
  private get pathTabActual(): string {
    const fromUrl = this.router.url || '';
    if (fromUrl.includes('vendedor-tab') || fromUrl.includes('gestor-tab')) return fromUrl;
    let r: ActivatedRoute | null = this.route;
    while (r) {
      const path = r.snapshot?.routeConfig?.path || '';
      if (path.includes('vendedor-tab') || path.includes('gestor-tab')) return path;
      r = r.parent;
    }
    return fromUrl;
  }

  /** True si estamos en la pestaña de gestor (usa API managers/me). */
  private get usaFlujoGestor(): boolean {
    return this.pathTabActual.includes('gestor-tab') && this.authService.isManager();
  }

  /** True si estamos en la pestaña de vendedor (usa API sellers/me). */
  private get usaFlujoVendedor(): boolean {
    return this.pathTabActual.includes('vendedor-tab') && this.authService.isSeller();
  }

  /** Para la plantilla: true si estamos en pestaña gestor (mostrar nombre vendedor, etc.). */
  get enPestanaGestor(): boolean {
    return this.pathTabActual.includes('gestor-tab');
  }

  ionViewWillEnter() {
    this.detectarRol();
    this.isVendedor = this.authService.isSeller();
    this.isGestor = this.authService.isManager();
    if (this.usaFlujoGestor) {
      this.recargarVistaActualGestor();
    } else if (this.usaFlujoVendedor) {
      this.recargarVistaActual();
    }
  }

  handleRefresh(event: CustomEvent): void {
    refreshWithLoadingWatch(event, () => this.loading, () => {
      if (this.usaFlujoGestor) {
        this.recargarVistaActualGestor();
      } else if (this.usaFlujoVendedor) {
        this.recargarVistaActual();
      }
    });
  }

  /** Recarga la vista actual (entidades, tacos o detalle taco) para reflejar ventas recientes */
  private recargarVistaActual() {
    if (this.showTacoDetail && this.selectedTaco) {
      const setId = this.selectedTaco.set_id ?? this.selectedTaco.setId;
      const bookNumber = this.selectedTaco.book_number ?? this.selectedTaco.bookNumber;
      if (setId != null && bookNumber != null) {
        this.viewTaco({ set_id: setId, book_number: bookNumber });
      }
    } else if (this.showTacosList && this.selectedEntity) {
      this.loadTacos();
    } else {
      this.loadEntities();
    }
  }

  /** Recarga la vista actual para gestor (entidades, tacos con vendedor o detalle taco) */
  private recargarVistaActualGestor() {
    if (this.showTacoDetail && this.selectedTaco) {
      const setId = this.selectedTaco.set_id ?? this.selectedTaco.setId;
      const bookNumber = this.selectedTaco.book_number ?? this.selectedTaco.bookNumber;
      const sellerId = this.selectedTaco.seller_id ?? this.selectedTaco.sellerId;
      if (setId != null && bookNumber != null && sellerId != null) {
        this.viewTacoGestor(setId, bookNumber, sellerId);
      }
    } else if (this.showTacosList && this.selectedEntity) {
      this.loadTacosGestor();
    } else {
      this.loadEntitiesGestor();
    }
  }

  detectarRol() {
    const ruta = this.pathTabActual || this.router.url || '';
    const tieneSeller = this.authService.isSeller();
    const esGestor = this.authService.isGestor();

    // La ruta tiene prioridad: si estamos en tabs de vendedor/gestor, usar ese rol
    if (ruta.includes('vendedor-tab') && tieneSeller) {
      this.rolActual = 'vendedor';
      localStorage.setItem('rolActual', 'vendedor');
      localStorage.setItem('esVendedor', 'true');
      return;
    }
    if (ruta.includes('gestor-tab') && esGestor) {
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
      this.rolActual = tieneSeller ? 'vendedor' : (esGestor ? 'gestor' : 'usuario');
      localStorage.setItem('rolActual', this.rolActual);
    }
  }

  isSeller(): boolean {
    return this.authService.isSeller();
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
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
  }

  loadEntitiesGestor() {
    this.loading = true;
    this.ventasService.getManagerEntities().subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success && res.entities) {
          this.entities = res.entities || [];
          if (this.entities.length === 1) {
            this.selectedEntity = this.entities[0];
            this.loadTacosGestor();
          } else if (this.entities.length > 1) {
            this.showEntitySelection = true;
          } else {
            this.mostrarAlerta('Sin entidades', 'No tienes entidades asignadas como gestor.');
          }
        } else {
          this.mostrarAlerta('Error', res.message || 'Error al cargar las entidades.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al cargar las entidades.');
      }
    });
  }

  loadTacosGestor() {
    if (!this.selectedEntity) return;
    this.loading = true;
    this.ventasService.getManagerTacos(this.selectedEntity.id).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          this.summary = res.summary;
          this.tacos = res.tacos || [];
          this.showTacosList = true;
        } else {
          this.mostrarAlerta('Error', res.message || 'Error al cargar los tacos.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al cargar los tacos.');
      }
    });
  }

  viewTacoGestor(setId: number, bookNumber: number, sellerId: number) {
    this.loading = true;
    this.ventasService.getManagerTacoParticipations(setId, bookNumber, sellerId).subscribe({
      next: (res: any) => {
        this.loading = false;
        if (res.success) {
          this.selectedTaco = { ...res.taco_info, set_id: res.taco_info.set_id, book_number: res.taco_info.book_number };
          this.tacoParticipations = res.participations;
          this.showTacoDetail = true;
        }
      },
      error: () => {
        this.loading = false;
        this.mostrarAlerta('Error', 'Error al cargar las participaciones.');
      }
    });
  }

  async loadEntities() {
    this.loading = true;
    this.ventasService.getMyEntities().subscribe({
      next: async (res: any) => {
        this.loading = false;
        if (res.success && res.entities) {
          this.entities = res.entities || [];
          if (this.entities.length === 1) {
            this.selectedEntity = this.entities[0];
            this.loadTacos();
          } else if (this.entities.length > 1) {
            this.showEntitySelection = true;
          } else {
            await this.mostrarAlerta('Sin entidades', 'No tienes entidades asignadas.');
          }
        } else {
          await this.mostrarAlerta('Error', res.message || 'Error al cargar las entidades.');
        }
      },
      error: async (err) => {
        this.loading = false;
        console.error('Error al cargar entidades:', err);
        const errorMessage = err?.error?.message || 'Error al cargar las entidades.';
        await this.mostrarAlerta('Error', errorMessage);
      }
    });
  }

  selectEntity(entity: any) {
    this.selectedEntity = entity;
    this.showEntitySelection = false;
    if (this.usaFlujoGestor) {
      this.loadTacosGestor();
    } else {
      this.loadTacos();
    }
  }

  async loadTacos() {
    if (!this.selectedEntity) return;
    this.loading = true;
    this.ventasService.getMyTacos(this.selectedEntity.id).subscribe({
      next: async (res: any) => {
        this.loading = false;
        if (res.success) {
          this.summary = res.summary;
          this.tacos = res.tacos || [];
          this.showTacosList = true;
          
          // Si no hay tacos, mostrar mensaje
          if (this.tacos.length === 0) {
            await this.mostrarAlerta('Sin participaciones', 'No tienes participaciones asignadas para esta entidad.');
          }
        } else {
          await this.mostrarAlerta('Error', res.message || 'Error al cargar los tacos.');
        }
      },
      error: async (err) => {
        this.loading = false;
        console.error('Error al cargar tacos:', err);
        const errorMessage = err?.error?.message || 'Error al cargar los tacos.';
        await this.mostrarAlerta('Error', errorMessage);
      }
    });
  }

  /** Abre el detalle de un taco: como vendedor (sellers/me) o como gestor (managers/me) según la pestaña actual. */
  openTaco(taco: any) {
    if (this.usaFlujoGestor && (taco.seller_id != null || taco.sellerId != null)) {
      const setId = taco.set_id ?? taco.setId;
      const bookNumber = taco.book_number ?? taco.bookNumber;
      const sellerId = taco.seller_id ?? taco.sellerId;
      this.viewTacoGestor(setId, bookNumber, sellerId);
    } else {
      this.viewTaco(taco);
    }
  }

  async viewTaco(taco: any) {
    this.loading = true;
    this.ventasService.getTacoParticipations(taco.set_id, taco.book_number).subscribe({
      next: async (res: any) => {
        this.loading = false;
        if (res.success) {
          this.selectedTaco = res.taco_info;
          this.tacoParticipations = res.participations;
          this.showTacoDetail = true;
        }
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', 'Error al cargar las participaciones.');
      }
    });
  }

  backToTacos() {
    this.showTacoDetail = false;
    this.selectedTaco = null;
    this.tacoParticipations = [];
  }

  backToEntities() {
    this.showTacosList = false;
    this.selectedEntity = null;
    this.summary = null;
    this.tacos = [];
    if (this.entities.length > 1) {
      this.showEntitySelection = true;
    }
  }

  /** Status 'pagada' se comporta como vendida (pago ya registrado en gestor pago). */
  private isSoldStatus(status: string): boolean {
    return status === 'vendida' || status === 'pagada';
  }

  getStatusBadgeClass(status: string, paymentMethod?: string): string {
    if (this.isSoldStatus(status)) {
      if (paymentMethod === 'efectivo') return 'badge-efectivo';
      if (paymentMethod === 'bizum') return 'badge-bizum';
      if (paymentMethod === 'transferencia') return 'badge-transferencia';
      return 'badge-vendida';
    }
    if (status === 'devuelta') return 'badge-devuelta';
    return 'badge-disponible';
  }

  getStatusText(status: string, paymentMethod?: string): string {
    if (status === 'pagada') return 'Pagada';
    if (status === 'vendida') {
      if (paymentMethod) {
        return paymentMethod.charAt(0).toUpperCase() + paymentMethod.slice(1) + ' Vendida';
      }
      return 'Vendida';
    }
    if (status === 'devuelta') return 'Devuelta';
    return 'Disponible';
  }

  getPaymentCount(amount: number, salesAmount: number, salesCount: number): number {
    if (salesAmount === 0 || salesCount === 0) return 0;
    // Calcular precio promedio por participación vendida
    const avgPrice = salesAmount / salesCount;
    // Calcular cuántas participaciones representa este monto
    return Math.round(amount / avgPrice);
  }

  padNumber(num: number, length: number): string {
    return String(num).padStart(length, '0');
  }

  formatDate(date: string | null): string {
    if (!date) return '';
    const d = new Date(date);
    return d.toLocaleDateString('es-ES');
  }

  getTacoSalesCount(): number {
    return this.tacoParticipations.filter(p => this.isSoldStatus(p.status)).length;
  }

  getTacoSalesAmount(): number {
    const price = this.getPlayedAmount();
    return this.getTacoSalesCount() * price;
  }

  getTacoReturnedCount(): number {
    return this.tacoParticipations.filter(p => p.status === 'devuelta').length;
  }

  getTacoReturnedAmount(): number {
    const price = this.getPlayedAmount();
    return this.getTacoReturnedCount() * price;
  }

  getTacoAvailableCount(): number {
    return this.tacoParticipations.filter(p => p.status === 'asignada').length;
  }

  getTacoAvailableAmount(): number {
    const price = this.getPlayedAmount();
    return this.getTacoAvailableCount() * price;
  }

  getTacoPaymentBreakdown(): any {
    const price = this.getPlayedAmount();
    const breakdown: any = { efectivo: 0, bizum: 0, transferencia: 0, sin_registrar: 0 };
    
    this.tacoParticipations
      .filter(p => this.isSoldStatus(p.status))
      .forEach(p => {
        if (p.payment_method === 'efectivo') breakdown.efectivo += price;
        else if (p.payment_method === 'bizum') breakdown.bizum += price;
        else if (p.payment_method === 'transferencia') breakdown.transferencia += price;
        else breakdown.sin_registrar += price;
      });
    
    return breakdown;
  }

  getPlayedAmount(): number {
    return Number(
      this.selectedTaco?.played_amount ??
      this.selectedTaco?.price_per_participation ??
      0
    );
  }

  getDonationAmount(): number {
    return Number(
      this.selectedTaco?.donation_amount ??
      this.selectedTaco?.donation_per_participation ??
      0
    );
  }

  getTotalParticipationAmount(): number {
    return Number(
      this.selectedTaco?.total_participation_amount ??
      this.selectedTaco?.total_per_participation ??
      (this.getPlayedAmount() + this.getDonationAmount())
    );
  }

  getReservedNumberDisplay(): string {
    const raw = this.selectedTaco?.reservation_numbers_display ?? this.selectedTaco?.reserved_number;
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      const asText = String(raw).trim();
      if (/^\d+$/.test(asText)) {
        return Number(asText).toLocaleString('es-ES');
      }
      return asText;
    }
    const fallback = this.selectedTaco?.set_number;
    if (fallback !== '' && fallback !== null && fallback !== undefined) {
      return Number(fallback).toLocaleString('es-ES');
    }
    return `${this.selectedTaco?.set_number ?? ''}.${this.padNumber(this.selectedTaco?.book_number ?? 0, 3)}`;
  }

  getSetSnapshotUrl(): string {
    return this.getTacoSnapshotUrl(this.selectedTaco);
  }

  getTacoSnapshotUrl(taco: any): string {
    const item = taco || {};
    const raw =
      item.design_snapshot_url ||
      item.design_snapshot_path ||
      item.design_snapshot ||
      item.snapshot_path ||
      item.snapshot ||
      '';

    if (raw) {
      if (String(raw).startsWith('http://') || String(raw).startsWith('https://')) {
        return raw;
      }
      const apiBaseUrl = environment.apiUrl.replace('/api', '');
      const clean = String(raw).replace(/^\/+/, '');
      if (clean.startsWith('storage/')) return `${apiBaseUrl}/${clean}`;
      if (clean.includes('design_snapshots/')) return `${apiBaseUrl}/storage/${clean}`;
      return `${apiBaseUrl}/storage/design_snapshots/${clean}`;
    }

    const setId = item.set_id ?? item.setId ?? item.set_number ?? 0;
    const apiBaseUrl = environment.apiUrl.replace('/api', '');
    return `${apiBaseUrl}/storage/design_snapshots/design_set_${setId}.png`;
  }

  getTacoPaymentCount(method: string): number {
    return this.tacoParticipations.filter(p => 
      this.isSoldStatus(p.status) && p.payment_method === method
    ).length;
  }

  async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    // Si ya es una URL completa, retornarla tal cual
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Construir URL completa desde la API base (sin /api)
    const apiBaseUrl = environment.apiUrl.replace('/api', '');
    return `${apiBaseUrl}/uploads/${imagePath}`;
  }

  /** Etiqueta del tipo de set para mostrar en lista y detalle (digital / físico / mixto). */
  getSetTypeLabel(setType: string | undefined): string {
    if (!setType) return '';
    if (setType === 'digital') return 'Digital';
    if (setType === 'fisico') return 'Físico';
    if (setType === 'mixto') return 'Mixto';
    return '';
  }

  /** Título de lista/detalle: para digital "Set Digital: {nombre}", para físico "Taco: set_number/book". */
  getTacoOrSetTitle(taco: any): string {
    if (!taco) return '';
    if (taco.set_type === 'digital') {
      const name = taco.set_name || 'Set';
      return `Set Digital: ${name}`;
    }
    const setNum = taco.set_number ?? taco.setId ?? taco.set_id ?? '';
    const bookNum = taco.book_number ?? taco.bookNumber ?? '';
    return `Taco: ${setNum}/${this.padNumber(bookNum, 3)}`;
  }

  /** Rango de participaciones: para digital "de la N a la N", para físico el range tal cual (ej. 1/00001-1/00100). */
  getParticipationsRangeDisplay(taco: any): string {
    if (!taco || !taco.participations_range) return '';
    if (taco.set_type === 'digital') {
      const m = String(taco.participations_range).match(/(\d+)\/(\d+)-(\d+)\/(\d+)/);
      if (m) {
        const from = parseInt(m[2], 10);
        const to = parseInt(m[4], 10);
        return `de la ${from} a la ${to}`;
      }
    }
    return taco.participations_range;
  }
}
