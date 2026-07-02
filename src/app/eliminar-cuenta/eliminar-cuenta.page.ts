import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { AuthService } from '../core/services/auth.service';
import { LegalService, AccountDeletionStatus } from '../core/services/legal.service';

@Component({
  selector: 'app-eliminar-cuenta',
  templateUrl: './eliminar-cuenta.page.html',
  styleUrls: ['./eliminar-cuenta.page.scss'],
  standalone: false,
})
export class EliminarCuentaPage implements OnInit {
  status: AccountDeletionStatus | null = null;
  loading = true;
  emailConfirm = '';
  userEmail = '';

  constructor(
    private legalService: LegalService,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private toastCtrl: ToastController,
    private alertCtrl: AlertController,
  ) {}

  ngOnInit() {
    const user = this.authService.getUser();
    this.userEmail = user?.email || user?.correo || '';
    this.loadStatus();
  }

  loadStatus() {
    this.loading = true;
    this.legalService.getAccountDeletionStatus().subscribe((status) => {
      this.status = status;
      this.loading = false;
    });
  }

  get canSubmit(): boolean {
    if (!this.status?.can_request) {
      return false;
    }
    return this.emailConfirm.trim().toLowerCase() === this.userEmail.trim().toLowerCase();
  }

  async submit() {
    if (!this.canSubmit) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Confirmar eliminación',
      message: this.status?.ui?.main_warning || 'Esta acción no se puede deshacer.',
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Eliminar',
          role: 'destructive',
          handler: () => {
            this.executeDeletion();
          },
        },
      ],
    });
    await alert.present();
  }

  private async executeDeletion() {
    const loader = await this.loadingCtrl.create({ message: 'Procesando...' });
    await loader.present();

    this.legalService.requestAccountDeletion(this.emailConfirm.trim()).subscribe(async (result) => {
      await loader.dismiss();
      const toast = await this.toastCtrl.create({
        message: result.message || (result.success ? 'Solicitud registrada' : 'No se pudo procesar'),
        duration: 4000,
        color: result.success ? 'success' : 'danger',
      });
      await toast.present();

      if (result.success) {
        this.authService.logout().subscribe();
      } else if (result.status) {
        this.status = result.status;
      }
    });
  }

  cancel() {
    this.router.navigate(['/perfil']);
  }
}
