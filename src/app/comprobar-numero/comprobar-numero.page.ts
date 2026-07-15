import { Component } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Location } from '@angular/common';
import { Router } from '@angular/router';
import { environment } from '../../environments/environment';
import { AuthService } from '../core/services/auth.service';

@Component({
  selector: 'app-comprobar-numero',
  templateUrl: './comprobar-numero.page.html',
  styleUrls: ['./comprobar-numero.page.scss'],
  standalone: false,
})
export class ComprobarNumeroPage {

  lotteries: any[] = [];
  selectedLottery: any = null;
  numero: string = '';
  loading = false;
  loadingLotteries = false;
  result: {
    number: number;
    total_prize: number;
    prizes: Array<{ category: string; amount: number; type?: string }>;
  } | null = null;
  errorMessage: string | null = null;

  private apiUrl = environment.apiUrl;

  constructor(
    private http: HttpClient,
    private location: Location,
    private router: Router,
    private authService: AuthService
  ) {}

  ionViewWillEnter() {
    if (this.lotteries.length === 0) {
      this.loadLotteries();
    }
  }

  loadLotteries() {
    this.loadingLotteries = true;
    this.http.get<any[]>(`${this.apiUrl}/lottery/results`).subscribe({
      next: (rawList) => {
        const conResultados = (rawList || []).filter((l: any) => l.result != null);
        const seisMesesAtras = new Date();
        seisMesesAtras.setMonth(seisMesesAtras.getMonth() - 6);
        const filtrados = conResultados.filter((l: any) => {
          if (!l.draw_date) return false;
          return new Date(l.draw_date) >= seisMesesAtras;
        });
        filtrados.sort((a: any, b: any) => new Date(b.draw_date).getTime() - new Date(a.draw_date).getTime());
        this.lotteries = filtrados;
        this.loadingLotteries = false;
      },
      error: () => {
        this.loadingLotteries = false;
      }
    });
  }

  getLotteryDisplayName(lottery: any): string {
    if (!lottery) return '';
    const name = lottery.name || '';
    const date = lottery.draw_date
      ? new Date(lottery.draw_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '';
    return date ? `${name} (${date})` : name;
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = this.apiUrl.replace(/\/api\/?$/, '');
    const normalized = imagePath.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  onLotteryImageError(lot: any) {
    if (lot) lot.image = null;
  }

  selectLottery(lottery: any) {
    this.selectedLottery = lottery;
    this.numero = '';
    this.result = null;
    this.errorMessage = null;
  }

  volverASeleccionarSorteo() {
    this.selectedLottery = null;
    this.numero = '';
    this.result = null;
    this.errorMessage = null;
  }

  goBack() {
    if (this.selectedLottery) {
      this.volverASeleccionarSorteo();
      return;
    }
    if (window.history.length > 1) {
      this.location.back();
      return;
    }
    void this.router.navigateByUrl(this.authService.getHomeTabHref());
  }

  comprobar() {
    this.errorMessage = null;
    this.result = null;

    if (!this.selectedLottery?.id) {
      this.errorMessage = 'Selecciona un sorteo.';
      return;
    }
    const num = String(this.numero ?? '').trim().replace(/\D/g, '');
    if (num === '' || num.length > 5) {
      this.errorMessage = 'Introduce un número válido (0-99999).';
      return;
    }
    const n = parseInt(num, 10);
    if (isNaN(n) || n < 0 || n > 99999) {
      this.errorMessage = 'El número debe estar entre 0 y 99999.';
      return;
    }

    this.loading = true;
    const body = {
      lottery_id: this.selectedLottery.id,
      start_range: n,
      end_range: n,
      page: 1,
      per_page: 100,
      sort_order: 'desc',
      premio_al_decimo: true
    };

    this.http.post<{
      success: boolean;
      results: Array<{ number: number; total_prize: number; prizes: Array<{ category: string; amount: number; type?: string }> }>;
      message?: string;
    }>(`${this.apiUrl}/scrutiny/generate`, body).subscribe({
      next: (res) => {
        this.loading = false;
        if (res.success && res.results && res.results.length > 0) {
          this.result = res.results[0];
        } else {
          this.errorMessage = 'Este número no tiene premio en este sorteo.';
        }
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.message || err?.message || 'Error al comprobar el número.';
        this.errorMessage = msg;
      }
    });
  }
}
