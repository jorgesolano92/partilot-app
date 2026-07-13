import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { finalize } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { RoleSwitchService } from '../core/services/role-switch.service';
import {
  ApiNotificationRow,
  InAppNotificationsService,
} from '../core/services/in-app-notifications.service';
import {
  normalizeNotificationTipoForUi,
  notificationKindLabel,
} from '../core/constants/notification-kind.labels';

export type RolNotificacion = 'usuario' | 'vendedor' | 'gestor';

export interface AppNotificacion {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  fecha: string | Date;
  leida: boolean;
  detalle?: string;
  rolContext: RolNotificacion;
  entidadNombre?: string;
  invitadorTexto?: string;
  entity_image?: string | null;
}

@Component({
  selector: 'app-notificaciones',
  templateUrl: './notificaciones.page.html',
  styleUrls: ['./notificaciones.page.scss'],
  standalone: false,
})
export class NotificacionesPage implements OnInit {

  notificaciones: AppNotificacion[] = [];
  notificacionesFiltradas: AppNotificacion[] = [];
  rolActual: RolNotificacion = 'usuario';
  notificacionesNoLeidas = 0;

  cargandoLista = false;
  errorCarga = '';

  modalAbierto = false;
  notificacionModal: AppNotificacion | null = null;

  constructor(
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private toastController: ToastController,
    public authService: AuthService,
    private inAppNotifications: InAppNotificationsService,
    private roleSwitchService: RoleSwitchService
  ) {}

  ngOnInit(): void {
    this.detectarRol();
    this.route.queryParams.subscribe((params) => {
      const modalId = params['modalId'];
      if (modalId) {
        const id = Number(modalId);
        void this.router.navigate(['/tabs/notificaciones'], { replaceUrl: true, queryParams: {} });
        if (!Number.isNaN(id)) {
          this.abrirModalDesdePush(id);
        }
      }
    });
  }

  ionViewWillEnter(): void {
    this.detectarRol();
    this.cargarNotificaciones();
  }

  detectarRol(): void {
    const rolGuardado = localStorage.getItem('rolActual');
    const esVendedorStr = localStorage.getItem('esVendedor');
    const tieneSeller = this.authService.isSeller();

    if (rolGuardado) {
      this.rolActual = rolGuardado as RolNotificacion;
      if (this.rolActual === 'vendedor' && !tieneSeller) {
        this.rolActual = 'usuario';
      }
    } else if (esVendedorStr === 'true' && tieneSeller) {
      this.rolActual = 'vendedor';
    } else {
      this.rolActual = 'usuario';
    }
  }

  cambiarRol(rol: RolNotificacion): void {
    const tieneSeller = this.authService.isSeller();
    if (rol === 'vendedor' && !tieneSeller) {
      return;
    }
    if (rol === 'gestor' && !this.authService.canViewGestor()) {
      return;
    }

    void this.roleSwitchService.confirmRoleChange(rol, this.rolActual, () => {
      this.rolActual = rol;
      localStorage.setItem('rolActual', rol);
      if (rol === 'vendedor') {
        localStorage.setItem('esVendedor', 'true');
      } else if (rol === 'usuario') {
        localStorage.setItem('esVendedor', tieneSeller ? 'true' : 'false');
      } else if (rol === 'gestor') {
        localStorage.setItem('esVendedor', 'false');
      }

      this.aplicarFiltro();
      void this.router.navigate(['/tabs/notificaciones'], { replaceUrl: true });
    });
  }

  getDefaultBackHref(): string {
    const r = localStorage.getItem('rolActual') as RolNotificacion | null;
    if (r === 'vendedor') {
      return '/tabs/vendedor-tab3';
    }
    if (r === 'gestor') {
      return '/tabs/gestor-tab3';
    }
    return '/tabs/tab3';
  }

  etiquetaRol(rol: RolNotificacion): string {
    if (rol === 'vendedor') {
      return 'Vendedor';
    }
    if (rol === 'gestor') {
      return 'Gestor';
    }
    return 'Usuario';
  }

  /** Etiqueta legible del kind (`tipo` API). */
  etiquetaTipo(tipo: string): string {
    return notificationKindLabel(tipo);
  }

  esInvitacionVendedor(n: AppNotificacion | null): boolean {
    return !!n && n.tipo === 'invitacion_vendedor';
  }

  puedeGestionarTipo(tipo: string): boolean {
    const u = normalizeNotificationTipoForUi(tipo);
    return ['cobro', 'ganador', 'sorteo', 'regalo', 'asignacion_participaciones'].includes(u);
  }

  private mapApi(n: ApiNotificationRow): AppNotificacion {
    return {
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      fecha: n.fecha,
      leida: n.leida,
      detalle: n.detalle ?? undefined,
      rolContext: (n.rolContext || 'usuario') as RolNotificacion,
      entidadNombre: n.entidadNombre ?? undefined,
      invitadorTexto: n.invitadorTexto ?? undefined,
      entity_image: n.entity_image,
    };
  }

  cargarNotificaciones(): void {
    this.errorCarga = '';
    this.cargandoLista = true;
    this.inAppNotifications
      .list()
      .pipe(finalize(() => (this.cargandoLista = false)))
      .subscribe({
        next: (res) => {
          if (res.success && Array.isArray(res.notifications)) {
            this.notificaciones = res.notifications.map((n) => this.mapApi(n));
            this.calcularNoLeidas();
            this.aplicarFiltro();
            this.syncBadgeMenuFromUnread();
          } else {
            this.notificaciones = [];
            this.notificacionesFiltradas = [];
          }
        },
        error: () => {
          this.errorCarga = 'No se pudieron cargar las notificaciones.';
          this.notificaciones = [];
          this.notificacionesFiltradas = [];
        },
      });
  }

  /** Sincroniza contador del menú lateral (localStorage) con el servidor. */
  private syncBadgeMenuFromUnread(): void {
    this.inAppNotifications.unreadCount().subscribe({
      next: (r) => {
        if (r.success && typeof r.count === 'number') {
          this.notificacionesNoLeidas = r.count;
          try {
            localStorage.setItem('notificaciones_unread_server', String(r.count));
          } catch {
            /* ignore */
          }
        }
      },
      error: () => {
        this.calcularNoLeidas();
      },
    });
  }

  calcularNoLeidas(): void {
    this.notificacionesNoLeidas = this.notificaciones.filter((n) => !n.leida).length;
  }

  aplicarFiltro(): void {
    this.notificacionesFiltradas = this.notificaciones
      .filter((n) => n.rolContext === this.rolActual)
      .sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());
  }

  marcarLeida(n: AppNotificacion): void {
    if (n.leida) {
      return;
    }
    this.inAppNotifications.markRead(n.id).subscribe({
      next: () => {
        n.leida = true;
        const ix = this.notificaciones.findIndex((x) => x.id === n.id);
        if (ix !== -1) {
          this.notificaciones[ix] = n;
        }
        this.calcularNoLeidas();
        this.aplicarFiltro();
        this.syncBadgeMenuFromUnread();
      },
      error: () => {},
    });
  }

  /** Lista → pantalla detalle (captura 4). */
  abrirDetalle(notificacion: AppNotificacion): void {
    this.marcarLeida(notificacion);
    void this.router.navigate(['/tabs/notificacion-detalle'], {
      queryParams: { id: notificacion.id },
    });
  }

  private abrirModalDesdePush(id: number): void {
    this.inAppNotifications.getOne(id).subscribe({
      next: (res) => {
        if (res.success && res.notification) {
          const n = this.mapApi(res.notification);
          this.notificacionModal = n;
          this.modalAbierto = true;
          if (!n.leida) {
            this.marcarLeida(n);
          }
        }
      },
      error: () => {},
    });
  }

  cerrarModal(): void {
    this.modalAbierto = false;
    this.notificacionModal = null;
  }

  async aceptarInvitacionVendedor(): Promise<void> {
    if (!this.notificacionModal) {
      return;
    }
    this.cerrarModal();
    const toast = await this.toastController.create({
      message: 'Próximamente: aceptación en servidor.',
      duration: 2800,
      position: 'bottom',
    });
    await toast.present();
  }

  async rechazarInvitacionVendedor(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Rechazar invitación',
      message: '¿Seguro que quieres rechazar esta invitación?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          role: 'destructive',
          handler: async () => {
            this.cerrarModal();
            const t = await this.toastController.create({
              message: 'Invitación rechazada (pendiente de integración).',
              duration: 2000,
              position: 'bottom',
            });
            await t.present();
          },
        },
      ],
    });
    await alert.present();
  }

  irCondicionesVendedor(): void {
    void this.router.navigate(['/condiciones-legales']);
  }

  accionGestionar(n: AppNotificacion): void {
    this.cerrarModal();
    this.navigateByTipo(n);
  }

  private navigateByTipo(n: AppNotificacion): void {
    switch (normalizeNotificationTipoForUi(n.tipo)) {
      case 'cobro':
        void this.router.navigate(['/tabs/cobrar-gestionar']);
        break;
      case 'ganador':
      case 'sorteo':
        void this.router.navigate(['/tabs/tab4']);
        break;
      case 'regalo':
        void this.router.navigate(['/tabs/tab1']);
        break;
      case 'asignacion_participaciones':
        void this.router.navigate(['/tabs/vendedor-tab4']);
        break;
      default:
        break;
    }
  }

  async marcarTodasComoLeidas(): Promise<void> {
    const alert = await this.alertController.create({
      header: 'Confirmar',
      message: '¿Marcar como leídas todas las notificaciones visibles en el servidor?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Marcar',
          handler: () => {
            this.inAppNotifications.markAllRead().subscribe({
              next: () => {
                this.cargarNotificaciones();
              },
              error: () => {},
            });
          },
        },
      ],
    });
    await alert.present();
  }

  noLeidasEnVista(): number {
    return this.notificacionesFiltradas.filter((n) => !n.leida).length;
  }
}
