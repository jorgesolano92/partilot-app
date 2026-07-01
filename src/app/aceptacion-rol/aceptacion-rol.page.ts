import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { finalize, map } from 'rxjs';
import { AuthService } from '../core/services/auth.service';
import { LegalService, RoleInvitationPending } from '../core/services/legal.service';

@Component({
  selector: 'app-aceptacion-rol',
  templateUrl: './aceptacion-rol.page.html',
  styleUrls: ['./aceptacion-rol.page.scss'],
  standalone: false,
})
export class AceptacionRolPage implements OnInit {
  invitation: RoleInvitationPending | null = null;
  loading = true;
  submitting = false;
  aceptarTerminos = false;
  errorMsg = '';
  private invitationKey = '';

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private alertController: AlertController,
    private legalService: LegalService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.invitationKey = (params['key'] as string) || '';
      this.cargarInvitacion();
    });
  }

  private cargarInvitacion(): void {
    this.loading = true;
    this.errorMsg = '';
    this.invitation = null;

    const load$ = this.invitationKey
      ? this.legalService.getRoleInvitation(this.invitationKey)
      : this.legalService.getPendingAcceptances().pipe(map((pending) => pending[0] ?? null));

    load$.pipe(finalize(() => (this.loading = false))).subscribe({
      next: (invitation) => {
        if (!invitation) {
          this.errorMsg = 'No hay invitaciones pendientes.';
          return;
        }
        this.invitation = invitation;
        this.invitationKey = invitation.key;
      },
      error: () => {
        this.errorMsg = 'No se pudo cargar la invitación.';
      },
    });
  }

  get canAccept(): boolean {
    return !!this.invitation && this.aceptarTerminos && !this.submitting;
  }

  abrirDocumentoLegal(): void {
    void this.router.navigate(['/documento-legal'], {
      queryParams: { slug: this.invitation?.legal_document_slug || 'terminos-y-condiciones' },
    });
  }

  async aceptar(): Promise<void> {
    if (!this.invitation || !this.canAccept) {
      return;
    }
    await this.responder('accept');
  }

  async rechazar(): Promise<void> {
    if (!this.invitation || this.submitting) {
      return;
    }

    const alert = await this.alertController.create({
      header: 'Rechazar invitación',
      message: '¿Seguro que deseas rechazar esta invitación?',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Rechazar',
          role: 'destructive',
          handler: () => {
            void this.responder('reject');
          },
        },
      ],
    });
    await alert.present();
  }

  private async responder(action: 'accept' | 'reject'): Promise<void> {
    if (!this.invitation) {
      return;
    }

    this.submitting = true;
    this.legalService
      .respondRoleInvitation(this.invitation.key, action)
      .pipe(finalize(() => (this.submitting = false)))
      .subscribe({
        next: async (res) => {
          if (!res.success) {
            await this.mostrarAlerta('Error', res.message || 'No se pudo procesar la invitación.');
            return;
          }

          this.authService.refreshToken().subscribe({
            next: () => this.continuarTrasRespuesta(action),
            error: () => this.continuarTrasRespuesta(action),
          });
        },
        error: async () => {
          await this.mostrarAlerta('Error', 'No se pudo procesar la invitación.');
        },
      });
  }

  private continuarTrasRespuesta(action: 'accept' | 'reject'): void {
    this.legalService.getPendingAcceptances().subscribe((pending) => {
      const restantes = pending.filter((p) => p.key !== this.invitationKey);
      if (restantes.length > 0) {
        void this.router.navigate(['/aceptacion-rol'], {
          queryParams: { key: restantes[0].key },
          replaceUrl: true,
        });
        this.invitationKey = restantes[0].key;
        this.aceptarTerminos = false;
        this.cargarInvitacion();
        return;
      }

      if (action === 'reject') {
        void this.router.navigate(['/tabs/tab3'], { replaceUrl: true });
      } else {
        this.authService.navigateToDefaultHome();
      }
    });
  }

  private async mostrarAlerta(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK'],
    });
    await alert.present();
  }
}
