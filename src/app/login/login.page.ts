import { Component } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { AlertController } from '@ionic/angular';
import { BiometricService } from '../core/services/biometric.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
})
export class LoginPage {
  email = '';
  password = '';
  returnUrl = '/tabs';
  loading = false;
  showPassword = false;
  biometricReady = false;
  biometricEnabled = false;
  biometricIcon = 'finger-print-outline';

  constructor(
    public authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private biometricService: BiometricService
  ) {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    this.returnUrl = returnUrl || '/tabs';
  }

  ionViewDidEnter() {
    if (!this.authService.isLoggedIn()) return;
    if (this.biometricService.mustShowBiometricGate()) {
      this.router.navigate(['/biometric-unlock'], {
        replaceUrl: true,
        queryParams: { returnUrl: this.returnUrl || '/tabs' },
      });
      return;
    }
    this.navigateByRole();
  }

  async ionViewWillEnter() {
    this.biometricReady = await this.biometricService.isBiometryAvailable();
    this.biometricEnabled = this.biometricService.isBiometricEnabled();
    this.biometricIcon = await this.biometricService.getBiometricIconName();
  }

  private navigateByRole() {
    this.authService.navigateToDefaultHome(this.returnUrl);
  }

  togglePassword() {
    this.showPassword = !this.showPassword;
  }

  async recordarPassword() {
    await this.mostrarAlerta('Recordar contraseña', 'Contacta con tu entidad o administrador para recuperar tu contraseña.');
  }

  async loginBiometrico() {
    if (this.loading) return;
    if (!this.biometricEnabled) {
      await this.mostrarAlerta('Acceso biométrico', 'Activa "Recordar acceso biométrico" para usar esta opción.');
      return;
    }
    const stored = this.biometricService.getStoredLoginCredentials();
    if (!stored) {
      await this.mostrarAlerta('Acceso biométrico', 'Inicia sesión manualmente una vez para activar el acceso biométrico.');
      return;
    }
    const authorized = await this.biometricService.authenticate();
    if (!authorized) return;

    this.loading = true;
    this.authService.loginUsuario(stored.email, stored.password).subscribe({
      next: async (response) => {
        this.loading = false;
        if (response.success) {
          this.navigateByRole();
        } else {
          await this.mostrarAlerta('Error', response.message || 'No se pudo iniciar sesión biométrica.');
        }
      },
      error: async (err) => {
        this.loading = false;
        const message = err.error?.message || 'Error de conexión. Verifica la URL de la API.';
        await this.mostrarAlerta('Error', message);
      },
    });
  }

  irARegistro() {
    this.router.navigate(['/registro']);
  }

  onBiometricToggle(ev: CustomEvent) {
    const enabled = !!ev.detail.checked;
    this.biometricEnabled = enabled;
    this.biometricService.setBiometricEnabled(enabled);
  }

  async onSubmit() {
    if (!this.email.trim() || !this.password) {
      await this.mostrarAlerta('Atención', 'Introduce email y contraseña');
      return;
    }

    this.loading = true;
    // Usar loginUsuario que determina automáticamente el rol del usuario
    this.authService.loginUsuario(this.email, this.password).subscribe({
      next: async (response) => {
        this.loading = false;
        if (response.success) {
          if (this.biometricReady && this.biometricEnabled) {
            await this.biometricService.saveLoginCredentials(this.email.trim(), this.password);
          }
          // Navegar según el rol detectado automáticamente
          this.navigateByRole();
        } else {
          await this.mostrarAlerta('Error', response.message || 'No se pudo iniciar sesión');
        }
      },
      error: async (err) => {
        this.loading = false;
        if (err.error?.deletion_reactivable) {
          await this.ofrecerReactivacion(err.error?.deletion_scheduled_at);
          return;
        }
        const message = err.error?.message || 'Error de conexión. Verifica la URL de la API.';
        await this.mostrarAlerta('Error', message);
      }
    });
  }

  private async ofrecerReactivacion(scheduledAt?: string | null) {
    const fecha = scheduledAt ? new Date(scheduledAt).toLocaleDateString('es-ES') : null;
    const alert = await this.alertController.create({
      header: 'Cuenta en proceso de baja',
      message: fecha
        ? `Solicitaste eliminar tu cuenta. Se borrará definitivamente el ${fecha}. ¿Quieres reactivarla?`
        : 'Solicitaste eliminar tu cuenta. ¿Quieres reactivarla?',
      buttons: [
        { text: 'No', role: 'cancel' },
        {
          text: 'Reactivar cuenta',
          handler: () => {
            this.reactivarCuenta();
          },
        },
      ],
    });
    await alert.present();
  }

  private reactivarCuenta() {
    this.loading = true;
    this.authService.cancelAccountDeletion(this.email.trim(), this.password).subscribe({
      next: () => {
        this.loading = false;
        this.onSubmit();
      },
      error: async (err) => {
        this.loading = false;
        await this.mostrarAlerta('Error', err.error?.message || 'No se pudo reactivar la cuenta.');
      },
    });
  }

  private async mostrarAlerta(header: string, message: string) {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}
