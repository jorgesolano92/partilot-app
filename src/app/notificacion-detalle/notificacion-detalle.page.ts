import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { finalize } from 'rxjs';
import {
  ApiNotificationRow,
  InAppNotificationsService,
} from '../core/services/in-app-notifications.service';
import {
  normalizeNotificationTipoForUi,
  notificationKindLabel,
} from '../core/constants/notification-kind.labels';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-notificacion-detalle',
  templateUrl: './notificacion-detalle.page.html',
  styleUrls: ['./notificacion-detalle.page.scss'],
  standalone: false,
})
export class NotificacionDetallePage implements OnInit {

  notificacion: {
    id: number;
    tipo: string;
    titulo: string;
    mensaje: string;
    fecha: string;
    leida: boolean;
    detalle?: string;
    entidadNombre?: string;
    invitadorTexto?: string;
    entity_image?: string | null;
  } | null = null;

  loading = true;
  errorMsg = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inAppNotifications: InAppNotificationsService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      const id = params['id'] ? parseInt(params['id'], 10) : NaN;
      if (Number.isNaN(id)) {
        void this.router.navigate(['/tabs/notificaciones']);
        return;
      }
      this.cargar(id);
    });
  }

  private mapRow(n: ApiNotificationRow): typeof this.notificacion {
    return {
      id: n.id,
      tipo: n.tipo,
      titulo: n.titulo,
      mensaje: n.mensaje,
      fecha: n.fecha,
      leida: n.leida,
      detalle: n.detalle ?? undefined,
      entidadNombre: n.entidadNombre ?? undefined,
      invitadorTexto: n.invitadorTexto ?? undefined,
      entity_image: n.entity_image,
    };
  }

  cargar(id: number): void {
    this.loading = true;
    this.errorMsg = '';
    this.notificacion = null;
    this.inAppNotifications
      .getOne(id)
      .pipe(finalize(() => (this.loading = false)))
      .subscribe({
        next: (res) => {
          if (res.success && res.notification) {
            this.notificacion = this.mapRow(res.notification);
            if (!res.notification.leida) {
              this.inAppNotifications.markRead(id).subscribe({ error: () => {} });
            }
          } else {
            this.errorMsg = 'No se encontró la notificación.';
          }
        },
        error: () => {
          this.errorMsg = 'No se pudo cargar la notificación.';
        },
      });
  }

  esInvitacionVendedor(): boolean {
    return !!this.notificacion && this.notificacion.tipo === 'invitacion_vendedor';
  }

  mostrarAcciones(): boolean {
    if (!this.notificacion) {
      return false;
    }
    const u = normalizeNotificationTipoForUi(this.notificacion.tipo);
    return ['cobro', 'ganador', 'regalo', 'sorteo', 'asignacion_participaciones'].includes(u);
  }

  irACobros(): void {
    void this.router.navigate(['/tabs/cobrar-gestionar']);
  }

  irAResultados(): void {
    void this.router.navigate(['/tabs/tab4']);
  }

  irACartera(): void {
    void this.router.navigate(['/tabs/tab1']);
  }

  irASorteo(): void {
    void this.router.navigate(['/tabs/tab4']);
  }

  irParticipacionesVendedor(): void {
    void this.router.navigate(['/tabs/vendedor-tab4']);
  }

  irGestionInvitacion(): void {
    void this.router.navigate(['/aceptacion-rol']);
  }

  irCondicionesVendedor(): void {
    void this.router.navigate(['/aceptacion-rol']);
  }

  /** Kind API normalizado para iconos y botones (cobro_registrado → cobro). */
  get tipoUi(): string {
    return this.notificacion ? normalizeNotificationTipoForUi(this.notificacion.tipo) : '';
  }

  etiquetaTipo(): string {
    return notificationKindLabel(this.notificacion?.tipo);
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) return imagePath;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = (imagePath || '').replace(/^storage\/?/, '');
    return `${base}/storage/${normalized}`;
  }
}
