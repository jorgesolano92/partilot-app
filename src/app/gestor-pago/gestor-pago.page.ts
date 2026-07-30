import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { ModalController } from '@ionic/angular';
import { DevolutionsService } from '../core/services/devolutions.service';
import { PagoService } from '../core/services/pago.service';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import { AlertModalService } from '../core/services/alert-modal.service';
import { BiometricService } from '../core/services/biometric.service';
import { CarteraService } from '../core/services/cartera.service';
import { environment } from '../../environments/environment';
import { ModalExitoPagoComponent } from './modal-exito-pago/modal-exito-pago.component';

type Step = 'entrada' | 'entidades' | 'sorteos' | 'participaciones' | 'gestion';

@Component({
  selector: 'app-gestor-pago',
  templateUrl: './gestor-pago.page.html',
  styleUrls: ['./gestor-pago.page.scss'],
  standalone: false,
})
export class GestorPagoPage implements OnInit {
  step: Step = 'entrada';
  loading = false;
  errorMessage = '';
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'gestor';

  entities: any[] = [];
  selectedEntity: any = null;
  lotteries: any[] = [];
  selectedLottery: any = null;
  sets: any[] = [];
  selectedSet: any = null;
  rangoDesde = '';
  rangoHasta = '';
  unidadNumero = '';
  referencia = '';

  /** Participaciones con premio listas para pagar (id, participation_code, premio, entity_name, etc.) */
  listaParaPagar: any[] = [];
  totalPremio = 0;

  constructor(
    private router: Router,
    private modalCtrl: ModalController,
    private devolutionsService: DevolutionsService,
    private pagoService: PagoService,
    public authService: AuthService,
    private alertModal: AlertModalService,
    private biometricService: BiometricService,
    private carteraService: CarteraService,
    private roleSwitchService: RoleSwitchService
  ) {}

  ngOnInit() {
    this.detectarRol();
  }

  ionViewWillEnter() {
    this.detectarRol();
    if (this.step === 'entrada') {
      this.listaParaPagar = [];
      this.totalPremio = 0;
    }
  }

  detectarRol() {
    const ruta = typeof window !== 'undefined' ? window.location.pathname : '';
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
        this.router.navigate(['/tabs/vendedor-tab4']);
      } else if (rol === 'usuario') {
        this.router.navigate(['/tabs/tab3']);
      } else {
        this.router.navigate(['/tabs/gestor-tab1']);
      }
    });
  }

  irAManual() {
    this.step = 'entidades';
    this.loadEntities();
  }

  loadEntities() {
    this.loading = true;
    this.errorMessage = '';
    this.pagoService.getEntities().subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.entities) {
          this.entities = res.entities;
          if (this.entities.length === 0) {
            this.errorMessage = 'No tienes entidades asignadas.';
          } else if (this.entities.length === 1) {
            this.selectEntity(this.entities[0]);
          }
        } else {
          this.errorMessage = 'Error al cargar entidades.';
        }
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error de conexión.';
      }
    });
  }

  selectEntity(entity: any) {
    this.selectedEntity = entity;
    this.loadSorteos();
    this.step = 'sorteos';
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
            this.errorMessage = 'No hay sorteos para esta entidad.';
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
    this.loadSets();
    this.step = 'participaciones';
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
            this.errorMessage = 'No hay sets para este sorteo.';
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

  onSetChange(ev: any) {
    const v = ev?.detail?.value;
    if (v != null) this.selectedSet = v;
  }

  comprobar() {
    if (!this.selectedEntity || !this.selectedLottery) {
      this.mostrarAlerta('Falta selección', 'Selecciona entidad y sorteo.');
      return;
    }
    const desde = this.rangoDesde ? parseInt(this.rangoDesde, 10) : undefined;
    const hasta = this.rangoHasta ? parseInt(this.rangoHasta, 10) : undefined;
    const unidad = this.unidadNumero ? this.unidadNumero.trim() : '';
    const ref = this.referencia ? this.referencia.trim() : '';

    if (ref) {
      this.validarPorReferencia(ref);
      return;
    }
    if (desde != null && hasta != null && !isNaN(desde) && !isNaN(hasta)) {
      this.validarPorRango(desde, hasta);
      return;
    }
    if (unidad) {
      const num = parseInt(unidad.replace(/\D/g, ''), 10);
      if (!isNaN(num)) {
        this.validarPorUnidad(num);
        return;
      }
    }
    this.mostrarAlerta('Datos requeridos', 'Indica referencia, un número de participación o un rango (desde y hasta).');
  }

  private handleValidateResponse(res: any, onSuccess: () => void) {
    if (res.success && res.participations && res.participations.length > 0) {
      this.agregarALista(res.participations);
      onSuccess();
      if (res.rejected?.length) {
        const detalle = res.rejected
          .map((r: any) => `${r.participation_code || '—'}: ${r.message}`)
          .join('\n');
        void this.mostrarAlerta('Algunas participaciones no se añadieron', detalle);
      }
      return;
    }
    if (res.rejected?.length) {
      const detalle = res.rejected
        .map((r: any) => `${r.participation_code || '—'}: ${r.message}`)
        .join('\n');
      this.errorMessage = detalle;
      return;
    }
    this.errorMessage = 'No se encontró participación con premio habilitada para pago presencial.';
  }

  private validarPorReferencia(referencia: string) {
    this.loading = true;
    this.errorMessage = '';
    this.pagoService.validateForPayment({
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      referencia
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.handleValidateResponse(res, () => { this.referencia = ''; });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al comprobar.';
      }
    });
  }

  private validarPorRango(desde: number, hasta: number) {
    if (!this.selectedSet) {
      this.mostrarAlerta('Falta set', 'Selecciona un set.');
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.pagoService.validateForPayment({
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      set_id: this.selectedSet.id,
      desde,
      hasta
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.handleValidateResponse(res, () => {
          this.rangoDesde = '';
          this.rangoHasta = '';
        });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al comprobar.';
      }
    });
  }

  private validarPorUnidad(num: number) {
    if (!this.selectedSet) {
      this.mostrarAlerta('Falta set', 'Selecciona un set.');
      return;
    }
    this.loading = true;
    this.errorMessage = '';
    this.pagoService.validateForPayment({
      entity_id: this.selectedEntity.id,
      lottery_id: this.selectedLottery.id,
      set_id: this.selectedSet.id,
      desde: num,
      hasta: num
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.handleValidateResponse(res, () => { this.unidadNumero = ''; });
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.message || 'Error al comprobar.';
      }
    });
  }

  private agregarALista(participations: any[]) {
    const ids = new Set(this.listaParaPagar.map(p => p.id));
    let added = 0;
    for (const p of participations) {
      if (!ids.has(p.id)) {
        ids.add(p.id);
        this.listaParaPagar.push(p);
        added++;
      }
    }
    this.actualizarTotal();
    if (added > 0) {
      this.step = 'gestion';
    }
  }

  private actualizarTotal() {
    this.totalPremio = this.listaParaPagar.reduce((sum, p) => sum + (p.premio || 0), 0);
  }

  quitarDeLista(p: any) {
    this.listaParaPagar = this.listaParaPagar.filter(x => x.id !== p.id);
    this.actualizarTotal();
  }

  irAGestion() {
    this.step = 'gestion';
  }

  pagar() {
    if (this.listaParaPagar.length === 0) {
      this.mostrarAlerta('Sin participaciones', 'Añade al menos una participación con premio.');
      return;
    }
    const ids = this.listaParaPagar.map(p => p.id);
    this.loading = true;
    this.pagoService.registerPayment(ids).subscribe({
      next: async (res) => {
        this.loading = false;
        if (res.success) {
          const modal = await this.modalCtrl.create({
            component: ModalExitoPagoComponent,
            cssClass: 'modal-exito-pago',
            backdropDismiss: false
          });
          await modal.present();
          modal.onDidDismiss().then(() => this.cerrarExito());
        } else {
          this.mostrarAlerta('Error', res.message || 'No se pudo registrar el pago.');
        }
      },
      error: (err) => {
        this.loading = false;
        this.mostrarAlerta('Error', err?.error?.message || 'Error al registrar el pago.');
      }
    });
  }

  cerrarExito() {
    this.listaParaPagar = [];
    this.totalPremio = 0;
    this.step = 'entrada';
    this.errorMessage = '';
  }

  backToEntrada() {
    this.step = 'entrada';
    this.errorMessage = '';
  }

  backToEntidades() {
    // Si solo hay una entidad, no tiene sentido mostrar selección de entidades (queda en blanco)
    if (this.entities.length <= 1) {
      this.backToEntrada();
      return;
    }
    this.step = 'entidades';
    this.selectedEntity = null;
    this.selectedLottery = null;
    this.sets = [];
    this.selectedSet = null;
    this.errorMessage = '';
  }

  backToSorteos() {
    this.step = 'sorteos';
    this.selectedLottery = null;
    this.sets = [];
    this.selectedSet = null;
    this.errorMessage = '';
  }

  backToParticipaciones() {
    this.step = 'participaciones';
    this.errorMessage = '';
  }

  async escanearQR() {
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el código QR de la participación'
      });
      const qrText = result?.ScanResult?.trim() || null;
      const referencia = this.extraerReferenciaDeQR(qrText);
      if (!referencia) {
        await this.mostrarAlerta('QR no válido', 'No se pudo obtener la referencia de la participación.');
        return;
      }
      this.procesarReferenciaEscaneada(referencia);
    } catch (err) {
      console.error('Error escáner QR:', err);
      if (this.biometricService.isScanCancelled(err)) {
        return;
      }
      await this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    }
  }

  private procesarReferenciaEscaneada(referencia: string) {
    this.loading = true;
    this.errorMessage = '';
    this.carteraService.checkByReference(referencia).subscribe({
      next: (checkRes: any) => {
        const p = checkRes?.participation;
        const entityId = p?.entity_id ?? p?.set?.reserve?.entity_id ?? p?.set?.reserve?.entity?.id;
        const lotteryId = p?.set?.reserve?.lottery_id ?? p?.set?.reserve?.lottery?.id;
        if (!entityId || !lotteryId) {
          this.loading = false;
          void this.mostrarAlerta('Error', 'No se pudo identificar la entidad o el sorteo de esta participación.');
          return;
        }
        this.selectedEntity = {
          id: entityId,
          name: p?.entity_name ?? p?.set?.reserve?.entity?.name ?? '',
        };
        this.selectedLottery = {
          id: lotteryId,
          name: p?.set?.reserve?.lottery?.name ?? '',
        };
        this.validarPorReferencia(referencia);
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err?.error?.message || 'No se encontró la participación.');
      }
    });
  }

  private extraerReferenciaDeQR(qrText: string | null): string | null {
    if (!qrText) return null;
    if (qrText.includes('ref=')) {
      const parts = qrText.split('ref=');
      if (parts.length > 1) {
        const referencia = parts[1].split('&')[0].split('#')[0].trim();
        return referencia || null;
      }
    }
    return qrText.trim() || null;
  }

  getImageUrl(path: string | null): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = path.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  onLotteryImageError(lot: any) {
    if (lot) lot.image = null;
  }

  private async mostrarAlerta(titulo: string, mensaje: string) {
    await this.alertModal.show(titulo, mensaje);
  }
}
