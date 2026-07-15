import { Component, OnDestroy, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { Location } from '@angular/common';
import { Subscription } from 'rxjs';
import { AlertModalService } from '../core/services/alert-modal.service';
import { AuthService } from '../core/services/auth.service';
import { BiometricService } from '../core/services/biometric.service';
import {
  ParticipationPublicCheckResponse,
  ParticipationPublicCheckService,
  ParticipationPublicCheckTicket,
} from '../core/services/participation-public-check.service';
import { extraerParamsParticipacionDeUrl } from '../core/utils/participation-deeplink.util';

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

  private querySub: Subscription | null = null;
  private ultimaConsulta = '';

  constructor(
    private route: ActivatedRoute,
    private location: Location,
    private router: Router,
    private authService: AuthService,
    private publicCheckService: ParticipationPublicCheckService,
    private alertModal: AlertModalService,
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

  get prizeInfo() {
    return this.ticket?.prize_info ?? null;
  }

  get prizeStatus(): 'winner' | 'no_prize' | 'pending' | null {
    if (!this.ticket) {
      return null;
    }
    const prize = this.ticket.prize_info;
    if (!prize || Object.keys(prize).length === 0) {
      return 'pending';
    }
    return prize.has_won ? 'winner' : 'no_prize';
  }

  get reservationNumbers(): number[] {
    return this.ticket?.reserve?.reservation_numbers
      ?? this.ticket?.data?.numbers
      ?? [];
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

  formatDrawDate(value: string | null | undefined): string {
    if (!value) {
      return '—';
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

    this.publicCheckService.check(referencia, sig).subscribe({
      next: (res: ParticipationPublicCheckResponse) => {
        this.loading = false;
        if (res.success && res.ticket) {
          this.ticket = res.ticket;
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

  nuevaConsulta(): void {
    this.ticket = null;
    this.errorMessage = null;
    this.referenciaManual = '';
    this.ultimaConsulta = '';
    this.mostrarFormulario = true;
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
