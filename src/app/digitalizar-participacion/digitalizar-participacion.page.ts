import { Component, OnInit } from '@angular/core';
import { AlertModalService } from '../core/services/alert-modal.service';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { CarteraService } from '../core/services/cartera.service';
import { BiometricService } from '../core/services/biometric.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-digitalizar-participacion',
  templateUrl: './digitalizar-participacion.page.html',
  styleUrls: ['./digitalizar-participacion.page.scss'],
  standalone: false,
})
export class DigitalizarParticipacionPage implements OnInit {

  paso: 'elegir' | 'escanear' | 'manual' | 'detalle' = 'elegir';
  referenciaManual = '';
  participacion: any = null;
  walletOptions: any = null;
  digitalizationNotice = '';
  storageNotice = '';
  confirmDigitalizeChecked = false;
  confirmStorageChecked = false;
  status: 'can_link' | 'already_mine' | 'already_other' | 'not_found' | 'view_only' | null = null;
  mensajeError = '';
  loading = false;

  constructor(
    private alertModal: AlertModalService,
    private router: Router,
    private route: ActivatedRoute,
    private carteraService: CarteraService,
    private biometricService: BiometricService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    const ref = this.route.snapshot.queryParamMap.get('ref')?.trim();
    if (ref) {
      void this.consultarReferencia(ref);
    }
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = path.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  async abrirEscaner() {
    try {
      const { CapacitorBarcodeScannerTypeHint } = await import('@capacitor/barcode-scanner');
      const result = await this.biometricService.scanBarcodeWithoutBiometricPause({
        hint: CapacitorBarcodeScannerTypeHint.QR_CODE,
        scanText: 'Escanea el código QR de la participación'
      });
      const qrText = result?.ScanResult?.trim() || '';
      const ref = this.extraerReferenciaDeQR(qrText);
      if (ref) {
        await this.consultarReferencia(ref);
      }
    } catch (err: unknown) {
      if (this.biometricService.isScanCancelled(err)) {
        return;
      }
      await this.mostrarAlerta('Error', 'No se pudo iniciar el escáner.');
    }
  }

  irAManual() {
    this.paso = 'manual';
    this.referenciaManual = '';
    this.participacion = null;
    this.status = null;
    this.mensajeError = '';
  }

  async buscarPorReferencia() {
    const ref = this.referenciaManual.trim();
    if (!ref) {
      await this.mostrarAlerta('Atención', 'Introduce el número de referencia');
      return;
    }
    await this.consultarReferencia(ref);
  }

  async consultarReferencia(referencia: string) {
    const pasoAnterior = this.paso;
    this.loading = true;
    this.carteraService.checkByReference(referencia).subscribe({
      next: async (res: any) => {
        this.loading = false;
        this.participacion = res.participation || null;
        this.walletOptions = res.wallet_options || null;
        this.digitalizationNotice = res.digitalization_notice || '';
        this.storageNotice = res.storage_notice || '';
        this.status = res.status || null;
        this.mensajeError = res.message || '';
        this.paso = 'detalle';
        if (this.status === 'not_found' || this.status === 'already_other') {
          await this.mostrarAlerta(
            this.status === 'not_found' ? 'No encontrada' : 'No se puede vincular',
            this.mensajeError
          );
          this.paso = pasoAnterior === 'manual' ? 'manual' : 'elegir';
          this.participacion = null;
        }
      },
      error: async (err) => {
        this.loading = false;
        // view_only / can_link vienen en 200; 422 solo already_other / errores reales
        const body = err.error;
        if (body?.status === 'view_only' && body?.participation) {
          this.participacion = body.participation;
          this.walletOptions = body.wallet_options || null;
          this.status = 'view_only';
          this.mensajeError = body.message || '';
          this.paso = 'detalle';
          return;
        }
        const msg = body?.message || (err.status === 422
          ? 'La participación no se puede vincular porque ya se encuentra leída por otro usuario.'
          : 'No se encuentra la participación. Comprueba la referencia o el código QR.');
        await this.mostrarAlerta(err.status === 422 ? 'No se puede vincular' : 'No encontrada', msg);
        this.paso = pasoAnterior === 'manual' ? 'manual' : 'elegir';
        this.participacion = null;
      }
    });
  }

  async confirmarDigitalizar() {
    if (!this.participacion?.referencia || this.status !== 'can_link' || !this.confirmDigitalizeChecked) return;

    const ok = await this.mostrarConfirmacion(
      'Confirmar digitalización',
      `${this.digitalizationNotice}\n\n¿Quieres digitalizar esta participación?`
    );
    if (!ok) return;

    this.loading = true;
    this.carteraService.linkToWallet(this.participacion.referencia).subscribe({
      next: async () => {
        this.loading = false;
        this.carteraService.notifyParticipacionesChanged();
        await this.mostrarAlerta('Listo', 'Participación digitalizada y añadida a tu cartera.');
        this.reiniciarFlujo();
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'No se pudo añadir.');
      }
    });
  }

  async confirmarAlmacen() {
    if (!this.participacion?.referencia || this.status !== 'can_link' || !this.confirmStorageChecked) return;

    const ok = await this.mostrarConfirmacion(
      'Guardar en almacén',
      `${this.storageNotice}\n\n¿Quieres guardarla en almacén?`
    );
    if (!ok) return;

    this.loading = true;
    this.carteraService.storeInWarehouse(this.participacion.referencia).subscribe({
      next: async () => {
        this.loading = false;
        this.carteraService.notifyParticipacionesChanged();
        await this.mostrarAlerta('Listo', 'Participación guardada en almacén.');
        this.reiniciarFlujo();
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'No se pudo guardar.');
      }
    });
  }

  get canDigitalize(): boolean {
    return this.status === 'can_link' && !!this.walletOptions?.can_digitalize;
  }

  get canStoreInWarehouse(): boolean {
    return this.status === 'can_link' && !!this.walletOptions?.can_store_in_warehouse;
  }

  get canManage(): boolean {
    const hasPrize = (this.participacion?.premio ?? 0) > 0 || !!this.participacion?.has_won;
    return !!this.walletOptions?.can_manage && hasPrize
      && (this.status === 'can_link' || this.status === 'already_mine');
  }

  participationImageUrl(): string {
    const p = this.participacion;
    if (!p) return '';
    return this.getImageUrl(p.preview_image_url || p.image || p.snapshot_path || '');
  }

  async gestionarParticipacion() {
    if (!this.participacion?.referencia || !this.canManage) return;

    if (this.status === 'already_mine') {
      this.router.navigate(['/tabs/cobrar-gestionar']);
      return;
    }

    const ok = await this.mostrarConfirmacion(
      'Gestionar participación',
      'Se añadirá a tu cartera para cobrar, donar o generar código. ¿Continuar?'
    );
    if (!ok) return;

    this.loading = true;
    this.carteraService.linkToWallet(this.participacion.referencia, { forManage: true }).subscribe({
      next: async () => {
        this.loading = false;
        this.carteraService.notifyParticipacionesChanged();
        this.reiniciarFlujo();
        this.router.navigate(['/tabs/cobrar-gestionar']);
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'No se pudo añadir.');
      }
    });
  }

  volver() {
    if (this.paso === 'detalle') {
      this.paso = this.referenciaManual ? 'manual' : 'elegir';
      this.participacion = null;
      this.status = null;
      this.confirmDigitalizeChecked = false;
      this.confirmStorageChecked = false;
    } else if (this.paso === 'manual') {
      this.paso = 'elegir';
      this.referenciaManual = '';
    } else {
      this.router.navigate(['/tabs/tab1']);
    }
  }

  /** Vuelve al inicio del flujo para digitalizar otra participación. */
  private reiniciarFlujo() {
    this.participacion = null;
    this.walletOptions = null;
    this.digitalizationNotice = '';
    this.storageNotice = '';
    this.confirmDigitalizeChecked = false;
    this.confirmStorageChecked = false;
    this.status = null;
    this.mensajeError = '';
    this.referenciaManual = '';
    this.paso = 'elegir';
  }

  cerrar() {
    this.router.navigate(['/tabs/tab1']);
  }

  async mostrarAlerta(header: string, message: string) {
    await this.alertModal.show(header, message);
  }

  async mostrarConfirmacion(header: string, message: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(false) },
          { text: 'Confirmar', handler: () => resolve(true) },
        ],
      });
      await alert.present();
    });
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
