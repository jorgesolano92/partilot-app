import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { AlertController } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { AlertModalService } from '../core/services/alert-modal.service';
import { AuthService } from '../core/services/auth.service';
import { BiometricService } from '../core/services/biometric.service';
import { CarteraService } from '../core/services/cartera.service';
import {
  ParticipationPublicCheckResponse,
  ParticipationPublicCheckService,
  ParticipationPublicCheckTicket,
} from '../core/services/participation-public-check.service';
import { extraerParamsParticipacionDeUrl } from '../core/utils/participation-deeplink.util';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-comprobar-participacion',
  templateUrl: './comprobar-participacion.page.html',
  styleUrls: ['./comprobar-participacion.page.scss'],
  standalone: false,
})
export class ComprobarParticipacionPage implements OnInit, OnDestroy {
  referenciaManual = '';
  loading = false;
  ticket: ParticipationPublicCheckTicket | null = null;
  errorMessage: string | null = null;
  mostrarFormulario = true;

  /** Opciones de cartera tras el check autenticado (solo si hay sesión). */
  walletStatus: 'can_link' | 'already_mine' | 'already_other' | 'not_found' | 'view_only' | null = null;
  walletOptions: any = null;
  walletParticipation: any = null;
  walletMessage = '';
  walletLoading = false;
  lastSig: string | undefined;

  private querySub: Subscription | null = null;
  private ultimaConsulta = '';

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private authService: AuthService,
    private publicCheckService: ParticipationPublicCheckService,
    private carteraService: CarteraService,
    private alertModal: AlertModalService,
    private alertController: AlertController,
    private biometricService: BiometricService
  ) {}

  ngOnInit(): void {
    this.querySub = this.route.queryParamMap.subscribe((params) => {
      const ref = params.get('ref')?.trim();
      const sig = params.get('sig')?.trim() || undefined;
      if (ref && ref !== this.ultimaConsulta) {
        this.referenciaManual = ref;
        void this.consultar(ref, sig);
      }
    });
  }

  ngOnDestroy(): void {
    this.querySub?.unsubscribe();
  }

  get isLoggedIn(): boolean {
    return this.authService.isLoggedIn();
  }

  get prizeInfo() {
    return this.ticket?.prize_info ?? null;
  }

  get drawStatus(): string {
    return this.ticket?.draw_status || 'pending_celebration';
  }

  get drawStatusLabel(): string {
    switch (this.drawStatus) {
      case 'completed':
        return 'Sorteado';
      case 'pending_results':
        return 'Pendiente de resultados';
      default:
        return 'Pendiente de sorteo';
    }
  }

  /** winner | no_prize | pending_celebration | pending_results */
  get prizeStatus(): 'winner' | 'no_prize' | 'pending_celebration' | 'pending_results' | null {
    if (!this.ticket) {
      return null;
    }
    if (this.drawStatus === 'pending_celebration') {
      return 'pending_celebration';
    }
    if (this.drawStatus === 'pending_results') {
      return 'pending_results';
    }
    const prize = this.ticket.prize_info;
    if (prize?.has_won) {
      return 'winner';
    }
    return 'no_prize';
  }

  get reservationNumbers(): number[] {
    return this.ticket?.reserve?.reservation_numbers
      ?? this.ticket?.data?.numbers
      ?? [];
  }

  get canDigitalize(): boolean {
    return this.isLoggedIn
      && this.walletStatus === 'can_link'
      && !!this.walletOptions?.can_digitalize;
  }

  get canStoreInWarehouse(): boolean {
    return this.isLoggedIn
      && this.walletStatus === 'can_link'
      && !!this.walletOptions?.can_store_in_warehouse;
  }

  get canManage(): boolean {
    if (!this.isLoggedIn || !this.walletOptions?.can_manage) {
      return false;
    }
    const hasPrize = (this.walletParticipation?.premio ?? this.prizeInfo?.prize_amount ?? 0) > 0
      || !!this.walletParticipation?.has_won
      || !!this.prizeInfo?.has_won;
    return hasPrize && (this.walletStatus === 'can_link' || this.walletStatus === 'already_mine');
  }

  get previewImageUrl(): string {
    const url = this.ticket?.preview_image_url
      || this.walletParticipation?.preview_image_url
      || this.walletParticipation?.image
      || this.walletParticipation?.snapshot_path
      || '';
    return this.resolveImageUrl(url);
  }

  formatNumber(value: number | string | null | undefined): string {
    if (value === null || value === undefined || value === '') {
      return '—';
    }
    const num = typeof value === 'number' ? value : parseInt(String(value), 10);
    if (Number.isNaN(num)) {
      return String(value);
    }
    return String(num).padStart(5, '0');
  }

  /** Evita desfase UTC al parsear Y-m-d. */
  formatDrawDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
    }
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (m) {
      const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
      return d.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      });
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }

  private resolveImageUrl(path: string): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = path.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  async abrirEscaner(): Promise<void> {
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el código QR de la participación',
      });
      const qrText = result?.ScanResult?.trim() || '';
      const params = extraerParamsParticipacionDeUrl(qrText);
      if (!params.ref) {
        await this.alertModal.show('QR no válido', 'No se pudo obtener la referencia de la participación.');
        return;
      }
      this.referenciaManual = params.ref;
      await this.consultar(params.ref, params.sig ?? undefined);
    } catch (err: unknown) {
      if (this.biometricService.isScanCancelled(err)) {
        await this.alertModal.show('Información', this.biometricService.scanCancelMessage);
        return;
      }
      await this.alertModal.show('Error', 'No se pudo iniciar el escáner.');
    }
  }

  async buscarManual(): Promise<void> {
    const ref = this.referenciaManual.trim();
    if (!ref) {
      await this.alertModal.show('Atención', 'Introduce el número de referencia.');
      return;
    }
    await this.consultar(ref);
  }

  async consultar(referencia: string, sig?: string): Promise<void> {
    this.loading = true;
    this.ticket = null;
    this.errorMessage = null;
    this.mostrarFormulario = false;
    this.ultimaConsulta = referencia;
    this.lastSig = sig;
    this.resetWalletState();

    this.publicCheckService.check(referencia, sig).subscribe({
      next: (res: ParticipationPublicCheckResponse) => {
        this.loading = false;
        if (res.success && res.ticket) {
          this.ticket = res.ticket;
          if (this.isLoggedIn) {
            this.loadWalletOptions(referencia);
          }
          return;
        }
        this.errorMessage = res.error || 'No se encontró ninguna participación con esa referencia.';
        this.mostrarFormulario = true;
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err?.error?.error
          || err?.error?.message
          || 'No se pudo comprobar la participación.';
        this.mostrarFormulario = true;
      },
    });
  }

  private loadWalletOptions(referencia: string): void {
    this.walletLoading = true;
    this.carteraService.checkByReference(referencia).subscribe({
      next: (res: any) => {
        this.walletLoading = false;
        this.walletStatus = res.status || null;
        this.walletOptions = res.wallet_options || null;
        this.walletParticipation = res.participation || null;
        this.walletMessage = res.message || '';
      },
      error: (err) => {
        this.walletLoading = false;
        const body = err?.error;
        if (body?.participation) {
          this.walletStatus = body.status || 'view_only';
          this.walletOptions = body.wallet_options || null;
          this.walletParticipation = body.participation;
          this.walletMessage = body.message || '';
          return;
        }
        this.walletStatus = null;
        this.walletOptions = null;
        this.walletParticipation = null;
        this.walletMessage = body?.message || '';
      },
    });
  }

  private resetWalletState(): void {
    this.walletStatus = null;
    this.walletOptions = null;
    this.walletParticipation = null;
    this.walletMessage = '';
    this.walletLoading = false;
  }

  async digitalizar(): Promise<void> {
    const ref = this.walletParticipation?.referencia || this.referenciaManual.trim();
    if (!ref || !this.canDigitalize) return;

    const ok = await this.confirm(
      'Confirmar digitalización',
      'El proceso de digitalización no se puede deshacer. Si la participación tiene premio, el cobro será online.\n\n¿Digitalizar?'
    );
    if (!ok) return;

    this.walletLoading = true;
    this.carteraService.linkToWallet(ref).subscribe({
      next: async () => {
        this.walletLoading = false;
        this.carteraService.notifyParticipacionesChanged();
        await this.alertModal.show('Listo', 'Participación digitalizada y añadida a tu cartera.');
        this.loadWalletOptions(ref);
      },
      error: async (err) => {
        this.walletLoading = false;
        await this.alertModal.show('Error', err?.error?.message || 'No se pudo digitalizar.');
      },
    });
  }

  async guardarAlmacen(): Promise<void> {
    const ref = this.walletParticipation?.referencia || this.referenciaManual.trim();
    if (!ref || !this.canStoreInWarehouse) return;

    const ok = await this.confirm(
      'Guardar en almacén',
      'Guardar en almacén no digitaliza la participación. Solo podrás consultar el resultado.\n\n¿Continuar?'
    );
    if (!ok) return;

    this.walletLoading = true;
    this.carteraService.storeInWarehouse(ref).subscribe({
      next: async () => {
        this.walletLoading = false;
        this.carteraService.notifyParticipacionesChanged();
        await this.alertModal.show('Listo', 'Participación guardada en almacén.');
        this.loadWalletOptions(ref);
      },
      error: async (err) => {
        this.walletLoading = false;
        await this.alertModal.show('Error', err?.error?.message || 'No se pudo guardar.');
      },
    });
  }

  async gestionarParticipacion(): Promise<void> {
    if (!this.canManage) return;
    const ref = this.walletParticipation?.referencia || this.referenciaManual.trim();
    if (!ref) return;

    if (this.walletStatus === 'already_mine') {
      void this.router.navigate(['/tabs/cobrar-gestionar']);
      return;
    }

    const ok = await this.confirm(
      'Gestionar participación',
      'Se añadirá a tu cartera para cobrar, donar o generar código. ¿Continuar?'
    );
    if (!ok) return;

    this.walletLoading = true;
    this.carteraService.linkToWallet(ref, { forManage: true }).subscribe({
      next: () => {
        this.walletLoading = false;
        this.carteraService.notifyParticipacionesChanged();
        void this.router.navigate(['/tabs/cobrar-gestionar']);
      },
      error: async (err) => {
        this.walletLoading = false;
        await this.alertModal.show('Error', err?.error?.message || 'No se pudo añadir a tu cartera.');
      },
    });
  }

  irALogin(): void {
    void this.router.navigate(['/login'], {
      queryParams: {
        returnUrl: `/tabs/comprobar-participacion?ref=${encodeURIComponent(this.referenciaManual.trim())}`,
      },
    });
  }

  private async confirm(header: string, message: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(false) },
          { text: 'Continuar', handler: () => resolve(true) },
        ],
      });
      await alert.present();
    });
  }

  nuevaConsulta(): void {
    this.ticket = null;
    this.errorMessage = null;
    this.referenciaManual = '';
    this.ultimaConsulta = '';
    this.mostrarFormulario = true;
    this.lastSig = undefined;
    this.resetWalletState();
  }

  goBack(): void {
    if (this.ticket || this.loading) {
      this.nuevaConsulta();
      return;
    }
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.authService.getHomeTabHref());
  }
}
