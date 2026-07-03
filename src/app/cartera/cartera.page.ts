import { Component, OnInit, OnDestroy } from '@angular/core';
import { AlertController } from '@ionic/angular';
import { Router } from '@angular/router';
import { CarteraService } from '../core/services/cartera.service';
import { AuthService } from '../core/services/auth.service';
import { AlertModalService } from '../core/services/alert-modal.service';
import { environment } from '../../environments/environment';
import { Subscription } from 'rxjs';
import {
  defaultListQuery,
  ParticipationListMeta,
  ParticipationListQuery,
} from '../core/models/list-pagination.model';

@Component({
  selector: 'app-cartera',
  templateUrl: './cartera.page.html',
  styleUrls: ['./cartera.page.scss'],
  standalone: false,
})
export class CarteraPage implements OnInit, OnDestroy {

  participaciones: any[] = [];
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';
  participacionExpandidaId: number | null = null;
  loading = false;
  participacionParaRegalar: any = null;
  emailDestinatario = '';
  mensajeRegalo = '';
  mostrarModalExito = false;
  mensajeExitoRegalo = '';
  emailRegaladoA = '';
  mostrarModalCodigoVinculacion = false;
  codigoVinculacion = '';
  vinculandoCodigo = false;
  listQuery: ParticipationListQuery = defaultListQuery(false);
  listMeta: ParticipationListMeta | null = null;
  private participacionesChangedSubscription?: Subscription;

  constructor(
    private router: Router,
    private carteraService: CarteraService,
    public authService: AuthService,
    private alertModal: AlertModalService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.detectarRol();
    this.loadParticipaciones();
    
    // Suscribirse a cambios en las participaciones
    this.participacionesChangedSubscription = this.carteraService.getParticipacionesChanged().subscribe(() => {
      this.loadParticipaciones();
    });
  }

  ngOnDestroy() {
    // Limpiar suscripción al destruir el componente
    if (this.participacionesChangedSubscription) {
      this.participacionesChangedSubscription.unsubscribe();
    }
  }

  ionViewWillEnter() {
    this.detectarRol();
    this.loadParticipaciones();
    this.checkPendingGiftsAlert();
  }

  detectarRol() {
    const rolGuardado = localStorage.getItem('rolActual');
    const esVendedorStr = localStorage.getItem('esVendedor');
    const tieneSeller = this.authService.isSeller();
    
    if (rolGuardado) {
      this.rolActual = rolGuardado as 'usuario' | 'vendedor' | 'gestor';
      // Si elige vendedor pero no tiene seller, forzar a usuario
      if (this.rolActual === 'vendedor' && !tieneSeller) {
        this.rolActual = 'usuario';
      }
    } else if (esVendedorStr === 'true' && tieneSeller) {
      this.rolActual = 'vendedor';
    } else {
      this.rolActual = 'usuario';
    }
  }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
    // Verificar que el usuario puede cambiar a ese rol
    const tieneSeller = this.authService.isSeller();
    
    // Solo permitir cambiar a vendedor si tiene seller guardado
    if (rol === 'vendedor' && !tieneSeller) {
      return; // No permitir cambio a vendedor si no tiene seller
    }
    
    this.rolActual = rol;
    localStorage.setItem('rolActual', rol);
    if (rol === 'vendedor') {
      localStorage.setItem('esVendedor', 'true');
      this.router.navigate(['/tabs/vendedor-tab3']);
    } else if (rol === 'usuario') {
      // Mantener esVendedor como 'true' si tiene seller, para permitir volver a vendedor
      localStorage.setItem('esVendedor', tieneSeller ? 'true' : 'false');
      this.router.navigate(['/tabs/tab3']);
    } else if (rol === 'gestor') {
      localStorage.setItem('esVendedor', 'false');
      this.router.navigate(['/tabs/gestor-tab3']);
    }
  }

  loadParticipaciones() {
    // Solo cargar participaciones si está logueado y está en modo usuario (no en modo vendedor)
    if (!this.authService.isLoggedIn() || this.rolActual === 'vendedor') {
      this.participaciones = [];
      this.listMeta = null;
      return;
    }
    this.loading = true;
    this.carteraService.getParticipations(this.listQuery).subscribe({
      next: (res) => {
        this.loading = false;
        this.participaciones = (res.participations || []).map((p: any) => ({ ...p, estado: p.estado || 'activa' }));
        this.listMeta = res.meta ?? null;
      },
      error: () => {
        this.loading = false;
        this.participaciones = [];
        this.listMeta = null;
      }
    });
  }

  onListFiltersApply(): void {
    this.listQuery = {
      ...this.listQuery,
      page: 1,
      per_page: Number(this.listQuery.per_page) || 20,
      include_expired: !!this.listQuery.include_expired,
    };
    this.loadParticipaciones();
  }

  onListPageChange(page: number): void {
    this.listQuery = { ...this.listQuery, page };
    this.loadParticipaciones();
  }

  get participacionesCartera(): any[] {
    return this.participaciones.filter(p => !p.is_storage);
  }

  get participacionesAlmacen(): any[] {
    return this.participaciones.filter(p => p.is_storage);
  }

  esAlmacen(participacion: any): boolean {
    return !!participacion?.is_storage;
  }

  /** Cobro presencial solo en almacén (papel sin digitalizar); no en cartera digitalizada. */
  muestraCobroPresencial(participacion: any): boolean {
    if (!participacion?.presencial_contact?.formatted || !(participacion.premio > 0)) {
      return false;
    }
    if (participacion.is_storage) {
      return true;
    }
    return !participacion.requires_online_collection
      && !participacion.is_digital
      && participacion.wallet_mode !== 'digital';
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = path.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  agregarParticipacion() {
    this.router.navigate(['/tabs/digitalizar-participacion']);
  }

  abrirModalCodigoVinculacion() {
    this.codigoVinculacion = '';
    this.mostrarModalCodigoVinculacion = true;
  }

  cerrarModalCodigoVinculacion() {
    this.mostrarModalCodigoVinculacion = false;
    this.codigoVinculacion = '';
  }

  vincularPorCodigo() {
    const code = this.codigoVinculacion.trim();
    if (!code || this.vinculandoCodigo) {
      return;
    }
    this.vinculandoCodigo = true;
    this.carteraService.claimPendingDigitalByCode(code).subscribe({
      next: async (res) => {
        this.vinculandoCodigo = false;
        if (res.success) {
          this.cerrarModalCodigoVinculacion();
          this.carteraService.notifyParticipacionesChanged();
          this.loadParticipaciones();
          const detalle = res.entity ? ` (${res.entity})` : '';
          await this.alertModal.show(
            'Participaciones vinculadas',
            res.message || `Se han añadido ${res.quantity ?? ''} participación(es) a tu cartera${detalle}.`
          );
        } else {
          await this.alertModal.show('Error', res.message || 'No se pudo vincular el código.');
        }
      },
      error: async (err) => {
        this.vinculandoCodigo = false;
        const msg = err?.error?.message || 'Código no válido o ya utilizado.';
        await this.alertModal.show('Error', msg);
      },
    });
  }

  irACobrarGestionar() {
    this.router.navigate(['/tabs/cobrar-gestionar']);
  }

  toggleDetalle(participacion: any) {
    const id = participacion.id;
    this.participacionExpandidaId = this.participacionExpandidaId === id ? null : id;
  }

  estaExpandida(participacion: any): boolean {
    return this.participacionExpandidaId === participacion.id;
  }

  getEstadoTexto(estado: string): string {
    const map: { [key: string]: string } = {
      cobrada: 'Pagada',
      donada: 'Donada',
      caducada: 'Caducada',
      regalada: 'Regalada',
      pendiente_regalo: 'Regalo pendiente',
      recibida: 'Recibida',
      activa: ''
    };
    return map[estado] || '';
  }

  esAtenuada(participacion: any): boolean {
    const e = participacion?.estado || 'activa';
    return e === 'regalada' || e === 'pendiente_regalo';
  }

  puedeAceptarRegalo(participacion: any): boolean {
    return participacion?.estado === 'pendiente_regalo' && !!participacion?.gift_id;
  }

  formatGiftDate(iso?: string): string {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleDateString('es-ES');
    } catch {
      return '—';
    }
  }

  async checkPendingGiftsAlert() {
    if (!this.authService.isLoggedIn() || this.rolActual === 'vendedor') return;
    this.carteraService.getPendingGifts().subscribe({
      next: async (res) => {
        if (!res.success || !res.count) return;
        const first = res.gifts?.[0];
        const from = first?.from_name || first?.from_email || 'Alguien';
        await this.alertModal.show(
          'Participación regalada',
          `${from} te ha regalado una participación. Revísala en tu cartera y acéptala si quieres recibirla.`
        );
      }
    });
  }

  async aceptarRegalo(participacion: any, event?: Event) {
    event?.stopPropagation();
    if (!participacion?.gift_id) return;
    const ok = await this.confirmDialog(
      'Aceptar regalo',
      'Al aceptar, la participación pasará a tu cartera de forma definitiva y no podrá reclamarse.'
    );
    if (!ok) return;
    this.carteraService.acceptGift(participacion.gift_id).subscribe({
      next: async (res) => {
        this.carteraService.notifyParticipacionesChanged();
        this.loadParticipaciones();
        await this.alertModal.show('Regalo aceptado', res.message || 'La participación ya es tuya.');
      },
      error: async (err) => {
        await this.alertModal.show('Error', err?.error?.message || 'No se pudo aceptar el regalo.');
      }
    });
  }

  async rechazarRegalo(participacion: any, event?: Event) {
    event?.stopPropagation();
    if (!participacion?.gift_id) return;
    const ok = await this.confirmDialog(
      'Rechazar regalo',
      '¿Seguro? La participación volverá al usuario que te la envió.'
    );
    if (!ok) return;
    this.carteraService.rejectGift(participacion.gift_id).subscribe({
      next: async (res) => {
        this.carteraService.notifyParticipacionesChanged();
        this.loadParticipaciones();
        await this.alertModal.show('Regalo rechazado', res.message || 'Has rechazado el regalo.');
      },
      error: async (err) => {
        await this.alertModal.show('Error', err?.error?.message || 'No se pudo rechazar el regalo.');
      }
    });
  }

  puedeRegalar(participacion: any): boolean {
    if (!participacion || participacion.is_storage) return false;
    const e = participacion.estado || 'activa';
    if (e === 'cobrada' || e === 'donada' || e === 'caducada' || e === 'regalada' || e === 'pendiente_regalo') return false;
    if (participacion.received_from_email || participacion.gift_status === 'accepted') return false;
    return true;
  }

  abrirModalRegalo(participacion: any, event: Event) {
    event?.stopPropagation();
    this.participacionParaRegalar = participacion;
    this.emailDestinatario = '';
    this.mensajeRegalo = '';
  }

  cerrarModalRegalo() {
    this.participacionParaRegalar = null;
    this.emailDestinatario = '';
    this.mensajeRegalo = '';
  }

  async enviarRegalo() {
    if (!this.participacionParaRegalar || !this.emailDestinatario.trim()) return;
    const email = this.emailDestinatario.trim();
    const ok = await this.confirmDialog(
      'Confirmar regalo',
      `¿Enviar la participación a ${email}? Asegúrate de que el correo es correcto: no podrás deshacerlo.`
    );
    if (!ok) return;
    this.carteraService.gift(this.participacionParaRegalar.id, email, this.mensajeRegalo).subscribe({
      next: (res: any) => {
        this.cerrarModalRegalo();
        this.mensajeExitoRegalo = `La participación perteneciente a ${this.participacionParaRegalar?.entidad || 'la entidad'} ha sido enviada correctamente a ${res.gifted_to_email || email}.`;
        this.emailRegaladoA = res.gifted_to_email || email;
        this.mostrarModalExito = true;
        this.loadParticipaciones();
      },
      error: async (err) => {
        const msg = err.error?.message || 'No se pudo enviar el regalo.';
        await this.alertModal.show('Error', msg);
      }
    });
  }

  cerrarModalExito() {
    this.mostrarModalExito = false;
    this.mensajeExitoRegalo = '';
    this.emailRegaladoA = '';
  }

  manejarErrorImagen(event: any) {
    if (event?.target) {
      event.target.style.display = 'none';
      const parent = event.target.closest('.participacion-image');
      if (parent) parent.classList.add('image-error');
    }
  }

  private async confirmDialog(header: string, message: string): Promise<boolean> {
    return new Promise(async (resolve) => {
      const alert = await this.alertController.create({
        header,
        message,
        buttons: [
          { text: 'Cancelar', role: 'cancel', handler: () => resolve(false) },
          { text: 'Aceptar', handler: () => resolve(true) },
        ],
      });
      await alert.present();
    });
  }
}
