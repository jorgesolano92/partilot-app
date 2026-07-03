import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { VentasService } from '../core/services/ventas.service';
import { Subscription } from 'rxjs';
import { CarteraService } from '../core/services/cartera.service';
import { AuthService } from '../core/services/auth.service';
import { environment } from '../../environments/environment';
import { Capacitor } from '@capacitor/core';
import {
  defaultListQuery,
  ParticipationListMeta,
  ParticipationListQuery,
} from '../core/models/list-pagination.model';

@Component({
  selector: 'app-historial',
  templateUrl: './historial.page.html',
  styleUrls: ['./historial.page.scss'],
  standalone: false,
})
export class HistorialPage implements OnInit, OnDestroy {

  historial: any[] = [];
  private ventasChangedSub?: Subscription;
  rolActual: 'usuario' | 'vendedor' | 'gestor' = 'usuario';
  loadingHistorial = false;
  errorHistorial: string | null = null;
  itemExpandido: string | number | null = null; // ID del item expandido (string para API: 'd-1', 'r-1')
  notifyAutoEnabled = false;
  buyerNotifyChannel: 'sms' | 'manual' = 'manual';
  enviandoNotificacion = false;
  listQuery: ParticipationListQuery = defaultListQuery(false);
  listMeta: ParticipationListMeta | null = null;

  constructor(
    private router: Router,
    private ventasService: VentasService,
    private carteraService: CarteraService,
    public authService: AuthService,
    private alertController: AlertController
  ) { }

  ngOnInit() {
    this.detectarRol();
    this.loadHistorial();
    this.ventasChangedSub = this.ventasService.getVentasChanged().subscribe(() => this.loadHistorial());
  }

  ngOnDestroy() {
    this.ventasChangedSub?.unsubscribe();
  }

  ionViewWillEnter() {
    this.detectarRol();
    this.loadHistorial();
  }

  detectarRol() {
    const rolGuardado = localStorage.getItem('rolActual');
    const esVendedorStr = localStorage.getItem('esVendedor');
    
    if (rolGuardado) {
      this.rolActual = rolGuardado as 'usuario' | 'vendedor' | 'gestor';
    } else if (esVendedorStr === 'true') {
      this.rolActual = 'vendedor';
    } else {
      // Detectar desde la ruta
      const ruta = window.location.pathname;
      if (ruta.includes('/vendedor-tab') || ruta.includes('/venta') || ruta.includes('/gestor-participaciones')) {
        this.rolActual = 'vendedor';
      } else {
        this.rolActual = 'usuario';
      }
    }
  }

  canViewUsuario(): boolean { return this.authService.canViewUsuario(); }
  canViewVendedor(): boolean { return this.authService.canViewVendedor(); }
  canViewGestor(): boolean { return this.authService.canViewGestor(); }

  cambiarRol(rol: 'usuario' | 'vendedor' | 'gestor') {
    this.rolActual = rol;
    localStorage.setItem('rolActual', rol);
    
    if (rol === 'vendedor') {
      localStorage.setItem('esVendedor', 'true');
      // Siempre navegar a la home de vendedor dentro de tabs
      this.router.navigate(['/tabs/vendedor-tab3']);
    } else if (rol === 'usuario') {
      localStorage.setItem('esVendedor', 'false');
      // Siempre navegar a la home de usuario
      this.router.navigate(['/tabs/tab3']);
    } else if (rol === 'gestor') {
      localStorage.setItem('esVendedor', 'false');
      // Siempre navegar a la home de gestor dentro de tabs
      this.router.navigate(['/tabs/gestor-tab3']);
    }
  }

  /** Para usuario: digitalizaciones, ventas digitales, regalos, cobros y donaciones. */
  get historialParaLista(): any[] {
    if (this.rolActual === 'usuario') {
      return this.historial.filter((i: any) =>
        ['digitalizacion', 'venta_digital_recibida', 'regalo', 'cobro', 'donacion'].includes(i.tipo)
        || (i.tipo === 'regalo' && (i.direccion === 'recibido' || i.direccion === 'enviado'))
      );
    }
    return this.historial;
  }

  loadHistorial() {
    this.errorHistorial = null;

    // Como vendedor: cargar historial desde la API Partilot
    if (this.rolActual === 'vendedor') {
      this.loadingHistorial = true;
      this.ventasService.getHistorial(this.listQuery).subscribe({
        next: (res) => {
          this.loadingHistorial = false;
          if (res.success && Array.isArray(res.historial)) {
            this.applyBuyerNotifyConfig(res);
            this.historial = this.normalizarFormaPagoEnHistorial(res.historial).sort(
              (a: any, b: any) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            );
            this.listMeta = res.meta ?? null;
            return;
          }
          this.errorHistorial = 'No se pudo cargar el historial desde el servidor.';
          this.historial = [];
          this.listMeta = null;
        },
        error: () => {
          this.loadingHistorial = false;
          this.errorHistorial =
            'No se pudo cargar el historial. Comprueba la conexión. El historial de ventas está en el servidor, no en este dispositivo.';
          this.historial = [];
          this.listMeta = null;
        }
      });
      return;
    }

    // Como usuario: cargar historial desde API (digitalizaciones, regalos; cobros pendiente)
    if (this.rolActual === 'usuario') {
      this.loadingHistorial = true;
      this.carteraService.getHistorial(this.listQuery).subscribe({
        next: (res) => {
          this.loadingHistorial = false;
          if (res.success && Array.isArray(res.historial)) {
            this.historial = res.historial.sort((a: any, b: any) =>
              new Date(b.fecha).getTime() - new Date(a.fecha).getTime()
            );
            this.listMeta = res.meta ?? null;
            return;
          }
          this.cargarHistorialDesdeLocalStorage();
        },
        error: () => {
          this.loadingHistorial = false;
          this.errorHistorial = 'No se pudo cargar el historial. Comprueba la conexión.';
          this.cargarHistorialDesdeLocalStorage();
        }
      });
      return;
    }

    // Gestor: solo localStorage
    this.cargarHistorialDesdeLocalStorage();
  }

  onListFiltersApply(): void {
    this.listQuery = {
      ...this.listQuery,
      page: 1,
      per_page: Number(this.listQuery.per_page) || 20,
    };
    this.loadHistorial();
  }

  onListPageChange(page: number): void {
    this.listQuery = { ...this.listQuery, page };
    this.loadHistorial();
  }

  private cargarHistorialDesdeLocalStorage() {
    try {
      const historialGuardado = JSON.parse(localStorage.getItem('historial') || '[]');
      
      if (historialGuardado.length > 0) {
        this.historial = this.normalizarFormaPagoEnHistorial(historialGuardado).sort((a: any, b: any) => {
          return new Date(b.fecha).getTime() - new Date(a.fecha).getTime();
        });
      } else {
        // Datos de ejemplo basados en el diseño
        this.historial = [
          {
            id: 0,
            tipo: 'venta',
            fecha: new Date('2025-09-02T16:45:00').toISOString(),
            formaPago: 'efectivo',
            descripcion: 'Participación CSIF-Rioja',
            participacion: {
              entidad: 'CSIF-Rioja',
              numero: '40083',
              fechaSorteo: '22/12/25',
              importeJugado: 5.00,
              donativo: 1.00,
              importeTotal: 6.00,
              numeroParticipacion: '1/0001',
              numeroReferencia: '0000000000000000000',
              imagen: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            }
          },
          {
            id: 1,
            tipo: 'digitalizacion',
            fecha: new Date('2025-11-10').toISOString(),
            participacion: {
              entidad: 'CSIF-Rioja',
              numero: '40083',
              fechaSorteo: '22/12/25',
              importeJugado: 5.00,
              donativo: 1.00,
              importeTotal: 6.00,
              numeroParticipacion: '1/0001',
              numeroReferencia: '0000000000000000000',
              imagen: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            },
            descripcion: 'Participación digitalizada'
          },
          {
            id: 2,
            tipo: 'regalo',
            fecha: new Date('2025-11-09').toISOString(),
            participacion: {
              entidad: 'CSIF-Rioja',
              numero: '40083',
              fechaSorteo: '22/12/25',
              importeJugado: 5.00,
              donativo: 1.00,
              importeTotal: 6.00,
              imagen: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            },
            emailDestinatario: 'jorgeruizortega@example.es',
            descripcion: 'Participación regalada'
          },
          {
            id: 3,
            tipo: 'recibido-regalo',
            fecha: new Date('2025-11-08').toISOString(),
            participacion: {
              entidad: 'CSIF-Rioja',
              numero: '40083',
              fechaSorteo: '22/12/25',
              importeTotal: 6.00
            },
            emailRemitente: 'amigo@example.es',
            descripcion: 'Regalo recibido'
          },
          {
            id: 4,
            tipo: 'cobro',
            fecha: new Date('2025-11-07').toISOString(),
            importeTotal: 25.00,
            participaciones: [
              {
                entidad: 'CSIF-Rioja',
                numero: '40083',
                importeTotal: 25.00
              }
            ],
            descripcion: 'Cobro de participaciones'
          },
          {
            id: 5,
            tipo: 'donacion',
            fecha: new Date('2025-11-06').toISOString(),
            importeDonacion: 25.00,
            descripcion: 'Donación realizada'
          },
          {
            id: 6,
            tipo: 'codigo-recarga',
            fecha: new Date('2025-11-05').toISOString(),
            codigoRecarga: 'BA0858695',
            importeCodigo: 25.00,
            participacion: {
              entidad: 'CSIF-Rioja',
              numero: '40083',
              fechaSorteo: '22/12/25',
              importeJugado: 5.00,
              donativo: 1.00,
              importeTotal: 6.00,
              imagen: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
            },
            descripcion: 'Código de recarga generado'
          }
        ];
        localStorage.setItem('historial', JSON.stringify(this.historial));
      }
    } catch (error) {
      console.error('Error cargando historial:', error);
      this.historial = [];
    }
  }

  getIconoTipo(tipo: string): string {
    const iconos: { [key: string]: string } = {
      'venta': 'receipt-outline',
      'venta-digital': 'phone-portrait-outline',
      'venta_digital_recibida': 'phone-portrait-outline',
      'digitalizacion': 'qr-code-outline',
      'regalo': 'arrow-down-outline',
      'recibido-regalo': 'gift-outline',
      'cobro': 'camera-outline',
      'donacion': 'heart-outline',
      'codigo-recarga': 'document-text-outline',
      'codigo': 'document-text-outline'
    };
    return iconos[tipo] || 'document-outline';
  }

  esVentaDigitalPendiente(item: any): boolean {
    return item?.tipo === 'venta-digital' && !!item?.pendienteRegistro;
  }

  /** Etiqueta «Digital» solo en participaciones digitales (venta digital, pool, recibidas). */
  esParticipacionDigital(item: any): boolean {
    if (!item) {
      return false;
    }
    if (item.tipo === 'venta-digital' || item.tipo === 'venta_digital_recibida') {
      return true;
    }
    if (item.esDigital === true || item.participacion?.esDigital === true) {
      return true;
    }
    if (item.participacion?.is_digital === true) {
      return true;
    }
    return false;
  }

  getSetLabel(item: any): string | null {
    if (!item) {
      return null;
    }
    const p = item.participacion;
    const direct =
      item.setLabel ??
      p?.setLabel ??
      p?.set_name ??
      p?.setName;
    if (direct != null && String(direct).trim() !== '') {
      return String(direct).trim();
    }
    const num = p?.set_number ?? item.set_number;
    if (num != null && num !== '') {
      return `Set ${num}`;
    }
    return null;
  }

  puedeEnviarWhatsApp(item: any): boolean {
    if (!this.esVentaDigitalPendiente(item)) {
      return false;
    }
    if (item.notify_channel === 'email' || item.can_resend_email) {
      return true;
    }
    if (this.notifyAutoEnabled && item.buyer_sms_can_send === false) {
      return false;
    }
    return item.notify_channel === 'sms' || item.notify_channel === 'whatsapp' || !item.notify_channel;
  }

  smsLimiteAlcanzado(item: any): boolean {
    return (
      this.esVentaDigitalPendiente(item) &&
      this.notifyAutoEnabled &&
      item.buyer_sms_can_send === false
    );
  }

  getSmsButtonLabel(item: any): string {
    if (item?.notify_channel === 'email' || item?.can_resend_email) {
      return 'Reenviar correo';
    }
    if (!this.notifyAutoEnabled) {
      return 'Abrir WhatsApp';
    }
    const sent = Number(item?.buyer_sms_sent_count ?? 0);
    return sent > 0 ? 'Reenviar mensaje' : 'Enviar mensaje';
  }

  /** Sorteo: API puede enviarlo en participacion o en la raíz del ítem. */
  getHistorialSorteo(item: any): string {
    const v =
      item?.participacion?.sorteo ??
      item?.sorteo ??
      item?.participacion?.lottery_name ??
      item?.lottery_name;
    const s = v != null ? String(v).trim() : '';
    return s !== '' && s !== '—' ? s : '—';
  }

  getHistorialFechaSorteo(item: any): string {
    const v =
      item?.participacion?.fechaSorteo ??
      item?.fechaSorteo ??
      item?.participacion?.fecha_sorteo;
    const s = v != null ? String(v).trim() : '';
    return s !== '' && s !== '—' ? s : '—';
  }

  getCantidadParticipacionesVenta(item: any): number {
    if (item?.quantity != null) {
      const q = Number(item.quantity);
      if (Number.isFinite(q) && q > 0) {
        return q;
      }
    }
    const num = String(item?.participacion?.numero ?? '');
    const match = num.match(/^(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return 1;
  }

  private buildMensajeWhatsAppVenta(item: any): string {
    const qty = this.getCantidadParticipacionesVenta(item);
    const entidad = item.participacion?.entidad;
    const sorteo = this.getHistorialSorteo(item);
    const email = item.participacion?.clienteEmail;
    const inviteUrl =
      item.buyer_registration_url || item.participacion?.buyer_registration_url;
    const participacionesTexto =
      qty === 1 ? '1 participación digital' : `${qty} participaciones digitales`;

    let msg = `Hola. Te he vendido ${participacionesTexto}`;
    if (entidad && entidad !== '—') {
      msg += ` de ${entidad}`;
    }
    if (sorteo && sorteo !== '—') {
      msg += ` (${sorteo})`;
    }
    msg += '.';

    if (email) {
      msg +=
        `\n\nRevisa tu correo ${email}: recibirás las instrucciones para reclamar tus participaciones en la app Partilot.`;
      msg += '\n\nEn la app: Cartera → Vincular con código.';
    } else if (inviteUrl) {
      msg +=
        `\n\nPara completar el registro y reclamar tus participaciones, abre este enlace:\n${inviteUrl}`;
    } else {
      msg +=
        '\n\nDescarga la app Partilot y sigue las instrucciones que recibirás para vincular tus participaciones.';
    }

    return msg;
  }

  private normalizarTelefonoWhatsApp(raw: string): string | null {
    let digits = (raw || '').replace(/\D/g, '');
    if (!digits) {
      return null;
    }
    if (digits.startsWith('00')) {
      digits = digits.slice(2);
    }
    if (digits.length === 9 && /^[67]/.test(digits)) {
      digits = `34${digits}`;
    }
    if (digits.length < 8 || digits.length > 15) {
      return null;
    }
    return digits;
  }

  private abrirWhatsApp(telefono: string, mensaje: string): void {
    const url = `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
    if (Capacitor.isNativePlatform()) {
      window.location.href = url;
    } else {
      window.open(url, '_blank');
    }
  }

  private resolvePendingId(item: any): number | null {
    if (item?.pending_id != null) {
      const id = Number(item.pending_id);
      return Number.isFinite(id) && id > 0 ? id : null;
    }
    const raw = String(item?.id ?? '');
    const match = raw.match(/^p-(\d+)$/i);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  private applyBuyerNotifyConfig(res: {
    notify_auto_enabled?: boolean;
    buyer_notify_channel?: string;
    sms_enabled?: boolean;
    whatsapp_enabled?: boolean;
  }): void {
    this.buyerNotifyChannel =
      res.buyer_notify_channel === 'sms' || res.sms_enabled ? 'sms' : 'manual';
    this.notifyAutoEnabled =
      res.notify_auto_enabled ?? this.buyerNotifyChannel === 'sms';
  }

  getNotifyChannelLabel(): string {
    return this.buyerNotifyChannel === 'sms' ? 'SMS' : 'WhatsApp';
  }

  getNotifyAlertHeader(item?: any): string {
    if (!this.notifyAutoEnabled) {
      return 'Enviar por WhatsApp';
    }
    return Number(item?.buyer_sms_sent_count ?? 0) > 0
      ? 'Reenviar mensaje'
      : 'Enviar mensaje al comprador';
  }

  getNotifyAlertMessage(): string {
    if (this.notifyAutoEnabled) {
      return 'Introduce el teléfono del comprador (ej. 34600111222). Se enviará por SMS con código y enlace; no se muestra en la app.';
    }
    return 'Introduce el teléfono del comprador. Se abrirá WhatsApp (wa.me) manualmente. Activa DIGITAL_SALE_SMS_ENABLED y httpSMS en el servidor para envío automático por SMS.';
  }

  getNotifyAlertButtonText(item?: any): string {
    if (!this.notifyAutoEnabled) {
      return 'Abrir WhatsApp';
    }
    return Number(item?.buyer_sms_sent_count ?? 0) > 0 ? 'Reenviar mensaje' : 'Enviar mensaje';
  }

  private actualizarContadorSmsTrasEnvio(
    item: any,
    res: { buyer_sms_sent_count?: number; buyer_sms_sends_remaining?: number }
  ): void {
    if (!item || res.buyer_sms_sent_count == null) {
      return;
    }
    item.buyer_sms_sent_count = res.buyer_sms_sent_count;
    item.buyer_sms_sends_remaining = res.buyer_sms_sends_remaining ?? 0;
    item.buyer_sms_can_send = (res.buyer_sms_sends_remaining ?? 0) > 0;
  }

  private async enviarNotificacionTwilio(
    pendingId: number,
    telefonoRaw?: string,
    item?: any
  ): Promise<void> {
    const telefono = telefonoRaw?.trim();

    this.enviandoNotificacion = true;
    this.ventasService.sendPendingDigitalNotify(pendingId, telefono || undefined).subscribe({
      next: async (res) => {
        this.enviandoNotificacion = false;
        if (res.success) {
          const canal = 'SMS';
          this.actualizarContadorSmsTrasEnvio(item, res);
          const restantes = res.buyer_sms_sends_remaining ?? 0;
          const extra =
            restantes > 0
              ? ` Puedes reenviar ${restantes} vez más desde el historial.`
              : ' No quedan reenvíos disponibles para esta venta.';
          await this.mostrarAlerta(
            `${canal} enviado`,
            (res.message || `El comprador recibirá el código y el enlace por ${canal}.`) + extra
          );
          return;
        }
        await this.mostrarAlerta('Error', res.message || 'No se pudo enviar el mensaje.');
      },
      error: async (err) => {
        this.enviandoNotificacion = false;
        const msg = err?.error?.message || 'Error de conexión al enviar el mensaje.';
        await this.mostrarAlerta('Error', msg);
      },
    });
  }

  async compartirVentaPorWhatsApp(item: any, event?: Event): Promise<void> {
    if (event) {
      event.stopPropagation();
    }

    const pendingId = this.resolvePendingId(item);
    if (!pendingId) {
      await this.mostrarAlerta('Error', 'No se puede enviar: venta pendiente no identificada.');
      return;
    }

    if (item.notify_channel === 'email' || item.can_resend_email) {
      this.enviandoNotificacion = true;
      this.ventasService.resendPendingDigitalEmail(pendingId).subscribe({
        next: async (res) => {
          this.enviandoNotificacion = false;
          if (res.success) {
            await this.mostrarAlerta('Correo reenviado', res.message || 'Correo reenviado al comprador.');
            return;
          }
          await this.mostrarAlerta('Error', res.message || 'No se pudo reenviar el correo.');
        },
        error: async (err) => {
          this.enviandoNotificacion = false;
          await this.mostrarAlerta('Error', err?.error?.message || 'Error al reenviar el correo.');
        },
      });
      return;
    }

    if (this.smsLimiteAlcanzado(item)) {
      await this.mostrarAlerta(
        'SMS no disponible',
        'Solo se permite 1 reenvío por venta. El SMS ya se ha enviado el máximo de veces.'
      );
      return;
    }
    if (!this.puedeEnviarWhatsApp(item) || this.enviandoNotificacion) {
      return;
    }

    if (!this.notifyAutoEnabled) {
      this.enviandoNotificacion = true;
      this.ventasService.getPendingDigitalWhatsAppLink(pendingId).subscribe({
        next: async (res) => {
          this.enviandoNotificacion = false;
          if (res.success && res.whatsapp_url) {
            if (Capacitor.isNativePlatform()) {
              window.location.href = res.whatsapp_url;
            } else {
              window.open(res.whatsapp_url, '_blank');
            }
            return;
          }
          await this.mostrarAlerta('Error', res.message || 'No se pudo abrir WhatsApp.');
        },
        error: async (err) => {
          this.enviandoNotificacion = false;
          await this.mostrarAlerta('Error', err?.error?.message || 'Error al abrir WhatsApp.');
        },
      });
      return;
    }

    await this.enviarNotificacionTwilio(pendingId, undefined, item);
  }

  private async mostrarAlerta(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: ['Aceptar'],
    });
    await alert.present();
  }

  getTituloTipo(tipo: string, item?: any): string {
    if (tipo === 'venta-digital' && item && this.esVentaDigitalPendiente(item)) {
      return 'Venta Digital (pendiente)';
    }
    const titulos: { [key: string]: string } = {
      'venta': 'Venta',
      'venta-digital': 'Venta Digital',
      'venta_digital_recibida': 'Participaciones digitales recibidas',
      'digitalizacion': 'Digitalización',
      'regalo': 'Envio Regalo',
      'recibido-regalo': 'Recibido Regalo',
      'cobro': 'Cobro',
      'donacion': 'Donacion',
      'codigo-recarga': 'Código de Recarga',
      'codigo': 'Código de Recarga'
    };
    return titulos[tipo] || 'Acción';
  }

  getColorTipo(tipo: string): string {
    const colores: { [key: string]: string } = {
      'venta': '#28a745',
      'venta-digital': '#0D6EFD',
      'venta_digital_recibida': '#0D6EFD',
      'digitalizacion': '#0D6EFD',
      'regalo': '#F49200',
      'cobro': '#28a745',
      'donacion': '#DC3545',
      'codigo': '#6c757d',
      'codigo-recarga': '#6c757d'
    };
    return colores[tipo] || '#6c757d';
  }

  /** Importe total para venta_digital_recibida (suma de importeTotal de cada participación, incluye donativo) */
  getImporteTotalVentaDigitalRecibida(item: any): number {
    if (!item || item.tipo !== 'venta_digital_recibida') return 0;
    const parts = item.participaciones || (item.participacion ? [item.participacion] : []);
    return parts.reduce((sum: number, p: any) => {
      const total = parseFloat(p?.importeTotal);
      const jugado = parseFloat(p?.importeJugado) || 0;
      const donativo = parseFloat(p?.donativo) || 0;
      return sum + (Number.isFinite(total) ? total : jugado + donativo);
    }, 0);
  }

  /** Donativo por participación para venta_digital_recibida (solo 1 participación, no la suma) */
  getDonativoVentaDigitalRecibida(item: any): number {
    if (!item || item.tipo !== 'venta_digital_recibida') return 0;
    const p = item.participacion || item.participaciones?.[0];
    return parseFloat(p?.donativo) || 0;
  }

  /** Descripción para la lista: ej. "Participación CSIF-Rioja" */
  getDescripcion(item: any): string {
    if (item.descripcion) return item.descripcion;
    const entidad = item.participacion?.entidad || item.entidad;
    const contacto =
      item.masked_buyer_contact || item.participacion?.clienteContactoEnmascarado;
    if (item.tipo === 'venta-digital' && this.esVentaDigitalPendiente(item)) {
      const base = entidad ? `Venta digital ${entidad}` : 'Venta digital';
      return contacto ? `${base} · ${contacto}` : `${base} · Pendiente de registro`;
    }
    if (entidad) return `Participación ${entidad}`;
    return 'Participación';
  }

  /** Fecha y hora para la cabecera del listado: "02/09/25 - 16:45h" */
  formatearFechayHora(fecha: string): string {
    const date = new Date(fecha);
    const dia = date.getDate().toString().padStart(2, '0');
    const mes = (date.getMonth() + 1).toString().padStart(2, '0');
    const anio = date.getFullYear().toString().slice(-2);
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${dia}/${mes}/${anio} - ${h}:${m}h`;
  }

  /** Asegura que cada item tenga formaPago (la API puede devolver payment_method) */
  private normalizarFormaPagoEnHistorial(historial: any[]): any[] {
    return historial.map(item => {
      const sanitized = { ...item };
      delete sanitized.codigoVinculacion;
      if (sanitized.participacion) {
        sanitized.participacion = { ...sanitized.participacion };
        delete sanitized.participacion.codigoVinculacion;
        if (!sanitized.participacion.sorteo && sanitized.sorteo) {
          sanitized.participacion.sorteo = sanitized.sorteo;
        }
        if (!sanitized.participacion.fechaSorteo && sanitized.fechaSorteo) {
          sanitized.participacion.fechaSorteo = sanitized.fechaSorteo;
        }
      }
      return {
        ...sanitized,
        formaPago: sanitized.formaPago ?? sanitized.payment_method ?? null,
        sorteo: sanitized.sorteo ?? sanitized.participacion?.sorteo ?? null,
        fechaSorteo: sanitized.fechaSorteo ?? sanitized.participacion?.fechaSorteo ?? null,
      };
    });
  }

  getFormaPagoTexto(forma: string | null | undefined): string {
    if (!forma || forma === 'null' || forma === 'undefined') return 'Efectivo';
    const map: { [key: string]: string } = {
      'efectivo': 'Efectivo',
      'bizum': 'Bizum',
      'transferencia': 'Transferencia',
      'omitir': 'Omitir'
    };
    return map[forma.toLowerCase()] || forma;
  }

  formatearFecha(fecha: string): string {
    const date = new Date(fecha);
    const hoy = new Date();
    const ayer = new Date(hoy);
    ayer.setDate(ayer.getDate() - 1);

    // Comparar solo fecha (sin hora)
    const fechaDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const hoyDate = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
    const ayerDate = new Date(ayer.getFullYear(), ayer.getMonth(), ayer.getDate());

    if (fechaDate.getTime() === hoyDate.getTime()) {
      return 'Hoy';
    } else if (fechaDate.getTime() === ayerDate.getTime()) {
      return 'Ayer';
    } else {
      return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
    }
  }

  /** Icono específico para ventas en el diseño de vendedor */
  getIconoVenta(tipo: string): string {
    if (tipo === 'venta-digital') {
      return 'phone-portrait-outline';
    }
    return 'receipt-outline'; // ticket para venta normal
  }

  /** Título específico para ventas en el diseño de vendedor */
  getTituloVenta(tipo: string): string {
    if (tipo === 'venta-digital') {
      return 'Venta Digital';
    }
    return 'Venta';
  }

  /** Toggle del detalle expandido */
  toggleDetalleVenta(item: any, event?: Event) {
    if (event) {
      event.stopPropagation();
    }
    if (this.itemExpandido === item.id) {
      this.itemExpandido = null;
    } else {
      this.itemExpandido = item.id;
    }
  }

  /** Verificar si un item está expandido */
  estaExpandido(item: any): boolean {
    return this.itemExpandido === item.id;
  }

  /** Manejar error al cargar imagen */
  onImageError(event: any) {
    event.target.src = '/assets/participacion.png';
  }

  getImageUrl(imagePath: string | null | undefined): string {
    if (!imagePath) return '';
    // Si ya es una URL completa, retornarla tal cual
    if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
      return imagePath;
    }
    // Si es una imagen base64, retornarla tal cual
    if (imagePath.startsWith('data:')) {
      return imagePath;
    }
    // Construir URL completa desde la API base (sin /api)
    const apiBaseUrl = environment.apiUrl.replace('/api', '');
    return `${apiBaseUrl}/uploads/${imagePath}`;
  }

  /** URL de imagen de una participación (API devuelve snapshot_path, mock puede usar imagen/snapshotPath) */
  getParticipacionImageUrl(participacion: any): string {
    if (!participacion) return '';
    const path = participacion.snapshot_path ?? participacion.snapshotPath ?? participacion.imagen;
    return path ? (path.startsWith('http') || path.startsWith('data:') ? path : this.getImageUrl(path)) : '';
  }

}
