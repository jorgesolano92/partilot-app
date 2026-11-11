import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController, ToastController } from '@ionic/angular';
import { finalize } from 'rxjs';
import {
  ApiNotificationRow,
  InAppNotificationsService,
} from '../core/services/in-app-notifications.service';
import { VentasService } from '../core/services/ventas.service';
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
    roleInvitationKey?: string | null;
    assignmentState?: string | null;
    actionable?: boolean;
    proposalId?: number | null;
  } | null = null;

  loading = true;
  errorMsg = '';
  accionando = false;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private inAppNotifications: InAppNotificationsService,
    private ventasService: VentasService,
    private alertController: AlertController,
    private toastController: ToastController
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
      titulo: n.titulo || notificationKindLabel(n.tipo),
      mensaje: n.mensaje || '',
      fecha: n.fecha,
      leida: n.leida,
      detalle: n.detalle ?? undefined,
      entidadNombre: n.entidadNombre ?? undefined,
      invitadorTexto: n.invitadorTexto ?? undefined,
      entity_image: n.entity_image,
      roleInvitationKey: n.roleInvitationKey ?? null,
      assignmentState: n.assignmentState ?? null,
      actionable: n.actionable === true,
      proposalId: n.proposalId ?? null,
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
    const n = this.notificacion;
    return (
      !!n &&
      n.tipo === 'invitacion_vendedor' &&
      (n.actionable === true ||
        n.assignmentState === 'pending' ||
        n.assignmentState === 'sent' ||
        Boolean(n.roleInvitationKey))
    );
  }

  esAsignacionPendiente(): boolean {
    const n = this.notificacion;
    return (
      !!n &&
      normalizeNotificationTipoForUi(n.tipo) === 'asignacion_participaciones' &&
      n.assignmentState === 'pending' &&
      !!n.proposalId &&
      n.actionable !== false
    );
  }

  mostrarAcciones(): boolean {
    if (!this.notificacion) {
      return false;
    }
    if (this.esAsignacionPendiente()) {
      return true;
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
    const key = this.notificacion?.roleInvitationKey;
    void this.router.navigate(['/aceptacion-rol'], key ? { queryParams: { key } } : {});
  }

  irCondicionesVendedor(): void {
    const key = this.notificacion?.roleInvitationKey;
    void this.router.navigate(['/aceptacion-rol'], key ? { queryParams: { key } } : {});
  }

  async aceptarAsignacion(): Promise<void> {
    const proposalId = this.notificacion?.proposalId;
    if (!proposalId || this.accionando) {
      return;
    }
    const alert = await this.alertController.create({
      header: 'Aceptar asignación',
      message: '¿Confirmas que has recibido estas participaciones físicas?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Aceptar',
          handler: () => {
            this.ejecutarRespuestaPropuesta(proposalId, 'accept');
          },
        },
      ],
    });
    await alert.present();
  }

  async rechazarAsignacion(): Promise<void> {
    const proposalId = this.notificacion?.proposalId;
    if (!proposalId || this.accionando) {
      return;
    }
    const alert = await this.alertController.create({
      header: 'Rechazar asignación',
      message: 'Las participaciones volverán a estar disponibles para la entidad.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          role: 'destructive',
          handler: () => {
            this.ejecutarRespuestaPropuesta(proposalId, 'reject');
          },
        },
      ],
    });
    await alert.present();
  }

  private ejecutarRespuestaPropuesta(proposalId: number, action: 'accept' | 'reject'): void {
    this.accionando = true;
    const req =
      action === 'accept'
        ? this.ventasService.acceptAssignmentProposal(proposalId)
        : this.ventasService.rejectAssignmentProposal(proposalId);

    req.pipe(finalize(() => (this.accionando = false))).subscribe({
      next: async (res) => {
        const toast = await this.toastController.create({
          message: res.message || (res.success ? 'Hecho.' : 'No se pudo completar.'),
          duration: 2800,
          color: res.success ? 'success' : 'danger',
          position: 'top',
        });
        await toast.present();
        if (res.success && this.notificacion) {
          this.notificacion = {
            ...this.notificacion,
            actionable: false,
            assignmentState: action === 'accept' ? 'accepted' : 'rejected',
          };
          if (action === 'accept') {
            void this.router.navigate(['/tabs/vendedor-tab4']);
          }
        }
      },
      error: async (err) => {
        const toast = await this.toastController.create({
          message: err?.error?.message || 'No se pudo completar la acción.',
          duration: 2800,
          color: 'danger',
          position: 'top',
        });
        await toast.present();
      },
    });
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
