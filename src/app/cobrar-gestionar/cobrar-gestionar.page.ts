import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertModalService } from '../core/services/alert-modal.service';
import { AuthService } from '../core/services/auth.service';
import { CarteraService } from '../core/services/cartera.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-cobrar-gestionar',
  templateUrl: './cobrar-gestionar.page.html',
  styleUrls: ['./cobrar-gestionar.page.scss'],
  standalone: false,
})
export class CobrarGestionarPage implements OnInit {

  participaciones: any[] = [];
  participacionesBloqueadas: any[] = [];
  participacionesSeleccionadas: Set<number> = new Set();
  modoCobro = true;
  modoDonacion = false;
  loading = false;
  
  // Modales como action sheets
  mostrarModalDatos = false;
  mostrarModalCuenta = false;
  mostrarModalConfigDonacion = false;
  mostrarMensajeExito = false;
  mostrarMensajeCodigo = false; // Segunda alerta para código de recarga
  
  datosPersonales = {
    nombre: '',
    apellidos: '',
    nif: ''
  };
  
  datosGuardados = false; // Flag para saber si los datos fueron guardados
  
  ibanFormateado = '';
  importeTotal = 0;
  
  // Para configuración de donación
  importeDonacion: number = 0;
  importeCodigo: number = 0;
  porcentajeDonacion: number = 50;
  codigoRecargaDisponible = true;
  
  tipoMensaje: 'cobro' | 'donacion' | 'codigo' = 'cobro';
  codigoRecarga: string = '';
  resultadoDonacion: any = null; // Guardar resultado de la donación para mostrar ambas alertas

  constructor(
    private router: Router,
    private alertModal: AlertModalService,
    private authService: AuthService,
    private carteraService: CarteraService
  ) { }

  ngOnInit() {
    this.loadParticipaciones();
  }

  ionViewWillEnter() {
    this.loadParticipaciones();
    this.resetSeleccion();
  }

  loadParticipaciones() {
    this.loading = true;
    this.participacionesBloqueadas = [];
    this.carteraService.getCobrables().subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.participations)) {
          this.participaciones = res.participations;
        } else {
          this.participaciones = [];
        }
        this.carteraService.getParticipations().subscribe({
          next: (walletRes) => {
            this.loading = false;
            const wallet = walletRes.participations || [];
            this.participacionesBloqueadas = wallet.filter((p: any) =>
              (p.premio ?? 0) > 0
              && p.payment_blocked
              && !['cobrada', 'donada', 'caducada', 'regalada'].includes(p.estado)
            );
          },
          error: () => {
            this.loading = false;
          }
        });
      },
      error: () => {
        this.loading = false;
        this.participaciones = [];
      }
    });
  }

  resetSeleccion() {
    this.participacionesSeleccionadas.clear();
    this.importeTotal = 0;
  }

  iniciarCobro() {
    this.modoCobro = true;
    this.modoDonacion = false;
    this.resetSeleccion();
  }

  iniciarDonacion() {
    this.modoDonacion = true;
    this.modoCobro = false;
    this.resetSeleccion();
    // Cargar participaciones al activar el modo donación
    this.loadParticipaciones();
  }

  /** entity_id de las participaciones actualmente seleccionadas (todas deben ser de la misma entidad). */
  get entityIdDeSeleccion(): number | null {
    const firstId = this.participacionesSeleccionadas.values().next().value;
    if (firstId == null) return null;
    const p = this.participaciones.find(x => x.id === firstId);
    return p?.entity_id ?? null;
  }

  /** Nombre de entidad de la selección actual (para mensajes). */
  get entidadDeSeleccion(): string | null {
    const firstId = this.participacionesSeleccionadas.values().next().value;
    if (firstId == null) return null;
    const p = this.participaciones.find(x => x.id === firstId);
    return p?.entidad ?? null;
  }

  /** Comprueba si una participación puede añadirse a la selección. */
  puedeSeleccionarParticipacion(participacion: any): boolean {
    if (this.modoCobro) {
      return true;
    }
    if (this.participacionesSeleccionadas.size === 0) return true;
    const idActual = this.entityIdDeSeleccion;
    if (idActual != null && participacion.entity_id != null) return participacion.entity_id === idActual;
    return (participacion.entidad ?? '') === (this.entidadDeSeleccion ?? '');
  }

  async toggleSeleccion(participacion: any, event?: Event) {
    event?.stopPropagation();
    const id = participacion.id;
    if (this.participacionesSeleccionadas.has(id)) {
      this.participacionesSeleccionadas.delete(id);
    } else {
      if (!this.puedeSeleccionarParticipacion(participacion)) {
        await this.alertModal.show(
          'Misma entidad',
          'Solo puedes donar participaciones de la misma entidad. Las seleccionadas son de «' + (this.entidadDeSeleccion || '') + '». Deselecciona antes de elegir participaciones de otra entidad.'
        );
        return;
      }
      this.participacionesSeleccionadas.add(id);
    }
    this.calcularImporteTotal();
  }

  estaSeleccionada(participacionId: number): boolean {
    return this.participacionesSeleccionadas.has(participacionId);
  }

  calcularImporteTotal() {
    this.importeTotal = Array.from(this.participacionesSeleccionadas)
      .reduce((total, id) => {
        const p = this.participaciones.find(x => x.id === id);
        return total + (p?.premio ?? p?.importeTotal ?? 0);
      }, 0);
  }

  /** True si la administración de las participaciones seleccionadas puede generar códigos prepago. */
  puedeGenerarCodigoRecarga(): boolean {
    const ids = Array.from(this.participacionesSeleccionadas);
    if (ids.length === 0) {
      return false;
    }

    return ids.every((id) => {
      const p = this.participaciones.find((x) => x.id === id);
      return p?.can_generate_recharge_code === true;
    });
  }

  private aplicarDistribucionDonacion(): void {
    this.codigoRecargaDisponible = this.puedeGenerarCodigoRecarga();
    if (this.codigoRecargaDisponible) {
      this.porcentajeDonacion = 50;
      this.importeDonacion = Math.round(this.importeTotal * 0.5 * 100) / 100;
      this.importeCodigo = Math.round((this.importeTotal - this.importeDonacion) * 100) / 100;
      return;
    }

    this.porcentajeDonacion = 100;
    this.importeDonacion = this.importeTotal;
    this.importeCodigo = 0;
  }

  async continuarCobro() {
    if (this.participacionesSeleccionadas.size === 0) {
      await this.alertModal.show('Selección requerida', 'Por favor, selecciona al menos una participación para cobrar.');
      return;
    }

    this.abrirModalDatos();
  }

  async continuarDonacion() {
    if (this.participacionesSeleccionadas.size === 0) {
      await this.alertModal.show('Selección requerida', 'Por favor, selecciona al menos una participación para donar.');
      return;
    }

    // Configurar importes según API de códigos de la administración
    this.aplicarDistribucionDonacion();
    this.mostrarModalConfigDonacion = true;
  }

  /** Abre el modal de datos personales precargando nombre, apellidos y NIF del usuario. */
  private abrirModalDatos(): void {
    this.cargarDatosPersonalesDesdeUsuario();
    this.mostrarModalDatos = true;
    this.authService.refreshToken().subscribe({
      next: (res) => {
        if (res.success && res.user) {
          this.cargarDatosPersonalesDesdeUsuario();
        }
      },
      error: () => {},
    });
  }

  /** Rellena campos vacíos con los datos del perfil (name, last_name, nif_cif). */
  private cargarDatosPersonalesDesdeUsuario(): void {
    const user = this.authService.getUser();
    if (!user) {
      return;
    }

    if (!this.datosPersonales.nombre?.trim()) {
      this.datosPersonales.nombre = String(user.name || user.nombre || '').trim();
    }

    if (!this.datosPersonales.apellidos?.trim()) {
      const apellidos = [user.last_name, user.last_name2, user.apellido]
        .filter((v) => v != null && String(v).trim() !== '')
        .map((v) => String(v).trim());
      this.datosPersonales.apellidos = apellidos.join(' ').trim();
    }

    if (!this.datosPersonales.nif?.trim()) {
      this.datosPersonales.nif = String(user.nif_cif || user.nif || '').trim();
    }
  }

  cerrarModalDatos() {
    this.mostrarModalDatos = false;
    // Solo resetear los datos si NO fueron guardados (se canceló)
    if (!this.datosGuardados) {
      this.datosPersonales = { nombre: '', apellidos: '', nif: '' };
    }
    this.datosGuardados = false; // Resetear el flag
  }

  /** Validar NIF/NIE/DNI/CIF español (misma lógica que backend) */
  validarDocumentoEspanol(documento: string): boolean {
    if (!documento || documento.trim() === '') return false;
    
    const doc = documento.trim().toUpperCase();
    
    // Intentar validar como NIF, NIE, DNI o CIF
    return this.validarNif(doc) 
        || this.validarNie(doc) 
        || this.validarDni(doc)
        || this.validarCif(doc);
  }

  /** Validar NIF (8 dígitos + 1 letra) */
  private validarNif(documento: string): boolean {
    if (!/^[0-9]{8}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(documento)) {
      return false;
    }
    const number = documento.substring(0, 8);
    const letter = documento.substring(8, 9);
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const expectedLetter = letters[parseInt(number) % 23];
    return letter === expectedLetter;
  }

  /** Validar NIE (X/Y/Z + 7 dígitos + 1 letra) */
  private validarNie(documento: string): boolean {
    if (!/^[XYZ][0-9]{7}[TRWAGMYFPDXBNJZSQVHLCKE]$/.test(documento)) {
      return false;
    }
    const firstChar = documento[0];
    const number = documento.substring(1, 8);
    const letter = documento.substring(8, 9);
    const replaceMap: { [key: string]: string } = { 'X': '0', 'Y': '1', 'Z': '2' };
    const fullNumber = replaceMap[firstChar] + number;
    const letters = 'TRWAGMYFPDXBNJZSQVHLCKE';
    const expectedLetter = letters[parseInt(fullNumber) % 23];
    return letter === expectedLetter;
  }

  /** Validar DNI (igual que NIF) */
  private validarDni(documento: string): boolean {
    return this.validarNif(documento);
  }

  /** Validar CIF (1 letra + 7 dígitos + 1 letra/dígito) */
  private validarCif(documento: string): boolean {
    if (!/^[ABCDEFGHJNPQRSUVW][0-9]{7}[0-9A-J]$/.test(documento)) {
      return false;
    }
    const firstChar = documento[0];
    const number = documento.substring(1, 8);
    const control = documento[8];
    const letters = 'JABCDEFGHI';
    
    const checkStandard = this.cifControlDigit(number, [0, 2, 4, 6]);
    const validStandard = control === String(checkStandard) || control === letters[checkStandard];
    
    // A, B, E, H: solo dígito numérico
    if (['A', 'B', 'E', 'H'].includes(firstChar)) {
      return control === String(checkStandard);
    }
    
    // G: número o letra; y variante con doble solo 0,2,4
    if (firstChar === 'G') {
      const checkAlternate = this.cifControlDigit(number, [0, 2, 4]);
      const validAlternate = control === String(checkAlternate) || control === letters[checkAlternate];
      return validStandard || validAlternate;
    }
    
    // Resto: letra de control
    return control === letters[checkStandard];
  }

  /** Calcula el dígito de control CIF */
  private cifControlDigit(number: string, doublePositions: number[]): number {
    let sum = 0;
    for (let i = 0; i < 7; i++) {
      const digit = parseInt(number[i], 10);
      if (doublePositions.includes(i)) {
        const doubled = digit * 2;
        sum += Math.floor(doubled / 10) + (doubled % 10);
      } else {
        sum += digit;
      }
    }
    return (10 - (sum % 10)) % 10;
  }

  async guardarDatos() {
    if (!this.datosPersonales.nombre || !this.datosPersonales.apellidos || !this.datosPersonales.nif) {
      await this.alertModal.show('Datos incompletos', 'Por favor, completa todos los campos requeridos.');
      return;
    }

    // Validar NIF/NIE/DNI/CIF antes de continuar
    const nifLimpio = this.datosPersonales.nif.trim().toUpperCase();
    if (!this.validarDocumentoEspanol(nifLimpio)) {
      await this.alertModal.show('NIF/NIE no válido', 'El campo NIF/NIE no es un NIF, NIE, DNI o CIF válido.');
      return;
    }

    // Marcar que los datos fueron guardados antes de cerrar
    this.datosGuardados = true;
    this.mostrarModalDatos = false;
    
    if (this.modoCobro) {
      this.mostrarModalCuenta = true;
    }
  }

  cerrarModalCuenta() {
    this.mostrarModalCuenta = false;
    this.ibanFormateado = '';
  }

  cerrarModalConfigDonacion() {
    this.mostrarModalConfigDonacion = false;
  }

  /** Formatear IBAN con espacios: 12 1234 1234 12 1234567890 (sin ES, está como addon) */
  formatearIban(val: string): string {
    const digits = val.replace(/\D/g, '').slice(0, 22);
    const parts: string[] = [];
    if (digits.length > 0) parts.push(digits.slice(0, 2));
    if (digits.length > 2) parts.push(digits.slice(2, 6));
    if (digits.length > 6) parts.push(digits.slice(6, 10));
    if (digits.length > 10) parts.push(digits.slice(10, 12));
    if (digits.length > 12) parts.push(digits.slice(12, 22));
    return parts.join(' ');
  }

  onIbanInput(event: any) {
    const raw = event?.detail?.value ?? event?.target?.value ?? this.ibanFormateado ?? '';
    const val = String(raw).replace(/\D/g, '').slice(0, 22);
    this.ibanFormateado = this.formatearIban(val);
  }

  /** Validar IBAN español (24 caracteres ES + 22 dígitos, MOD-97-10) */
  validarIbanEspanol(iban: string): boolean {
    const limpio = iban.toUpperCase().replace(/\s/g, '').trim();
    if (!limpio.startsWith('ES') || limpio.length !== 24) return false;
    const digitos = limpio.slice(2);
    if (!/^\d+$/.test(digitos)) return false;
    const rearranged = limpio.slice(4) + limpio.slice(0, 4);
    let numeric = '';
    for (let i = 0; i < rearranged.length; i++) {
      const c = rearranged[i];
      if (/[A-Z]/.test(c)) numeric += (c.charCodeAt(0) - 55);
      else numeric += c;
    }
    let remainder = 0;
    for (let i = 0; i < numeric.length; i++) {
      remainder = (remainder * 10 + parseInt(numeric[i], 10)) % 97;
    }
    return remainder === 1;
  }

  async procesarCobro() {
    // Añadir "ES" al inicio si no está presente (ya que está como addon visual)
    const ibanSinEspacios = this.ibanFormateado.replace(/\s/g, '').trim();
    const ibanLimpio = ibanSinEspacios.startsWith('ES') ? ibanSinEspacios : 'ES' + ibanSinEspacios;
    if (!ibanLimpio || ibanLimpio.length !== 24) {
      await this.alertModal.show('IBAN incompleto', 'Introduce los 22 dígitos del número de cuenta (ES está incluido).');
      return;
    }
    if (!this.validarIbanEspanol(ibanLimpio)) {
      await this.alertModal.show('IBAN no válido', 'El IBAN no es correcto. Comprueba los dígitos de control.');
      return;
    }

    const ids = Array.from(this.participacionesSeleccionadas);
    this.carteraService.registrarCobro({
      participation_ids: ids,
      nombre: this.datosPersonales.nombre.trim(),
      apellidos: this.datosPersonales.apellidos.trim(),
      nif: this.datosPersonales.nif.trim().toUpperCase(),
      iban: ibanLimpio,
      importe_total: this.importeTotal
    }).subscribe({
      next: (res) => {
        // Cerrar el modal de IBAN
        this.mostrarModalCuenta = false;
        this.ibanFormateado = '';
        this.tipoMensaje = 'cobro';
        this.resetSeleccion();
        this.loadParticipaciones();
        this.carteraService.notifyParticipacionesChanged();
        this.mostrarMensajeExito = true;
      },
      error: async (err) => {
        const msg = err.error?.message || 'No se pudo registrar el cobro.';
        await this.alertModal.show('Error', msg);
      }
    });
  }

  actualizarPorcentajes(event: any) {
    if (!this.codigoRecargaDisponible) {
      this.porcentajeDonacion = 100;
      this.importeDonacion = this.importeTotal;
      this.importeCodigo = 0;
      return;
    }

    const porcentaje = event.detail.value;
    this.porcentajeDonacion = porcentaje;
    // Calcular importe de donación redondeado a 2 decimales
    this.importeDonacion = Math.round((this.importeTotal * porcentaje) / 100 * 100) / 100;
    // Asegurar que la suma sea exactamente igual al total (ajustar el código con la diferencia)
    this.importeCodigo = Math.round((this.importeTotal - this.importeDonacion) * 100) / 100;
    // Ajuste final para garantizar que sumen exactamente el total
    const suma = this.importeDonacion + this.importeCodigo;
    const diferencia = this.importeTotal - suma;
    if (Math.abs(diferencia) > 0.001) {
      this.importeCodigo = Math.round((this.importeCodigo + diferencia) * 100) / 100;
    }
  }

  async procesarDonacion() {
    this.mostrarModalConfigDonacion = false;
    
    // Si se dona algo, pedir datos personales (opcionales)
    if (this.importeDonacion > 0) {
      this.abrirModalDatos();
      return;
    }
    
    // Si solo se genera código, procesar directamente sin pedir datos
    await this.procesarDonacionAPI();
  }

  async omitirDatos() {
    this.mostrarModalDatos = false;
    await this.procesarDonacionAPI();
  }

  async enviarDatos() {
    // Validar NIF/NIE si se proporciona
    if (this.datosPersonales.nif && this.datosPersonales.nif.trim()) {
      const nifLimpio = this.datosPersonales.nif.trim().toUpperCase();
      if (!this.validarDocumentoEspanol(nifLimpio)) {
        await this.alertModal.show('NIF/NIE no válido', 'El campo NIF/NIE no es un NIF, NIE, DNI o CIF válido.');
        return;
      }
    }

    this.mostrarModalDatos = false;
    await this.procesarDonacionAPI();
  }

  async procesarDonacionAPI() {
    const ids = Array.from(this.participacionesSeleccionadas);
    
    // Asegurar que los importes sumen exactamente el total antes de enviar
    const suma = this.importeDonacion + this.importeCodigo;
    const diferencia = this.importeTotal - suma;
    if (Math.abs(diferencia) > 0.001) {
      // Ajustar el código con la diferencia para que sumen exactamente el total
      this.importeCodigo = Math.round((this.importeCodigo + diferencia) * 100) / 100;
    }
    
    // Preparar datos para la API con valores redondeados a 2 decimales
    const datosDonacion: any = {
      participation_ids: ids,
      importe_donacion: Math.round(this.importeDonacion * 100) / 100,
      importe_codigo: Math.round(this.importeCodigo * 100) / 100
    };

    // Añadir datos personales solo si se proporcionaron
    if (this.datosPersonales.nombre && this.datosPersonales.nombre.trim()) {
      datosDonacion.nombre = this.datosPersonales.nombre.trim();
    }
    if (this.datosPersonales.apellidos && this.datosPersonales.apellidos.trim()) {
      datosDonacion.apellidos = this.datosPersonales.apellidos.trim();
    }
    if (this.datosPersonales.nif && this.datosPersonales.nif.trim()) {
      datosDonacion.nif = this.datosPersonales.nif.trim().toUpperCase();
    }

    this.carteraService.registrarDonacion(datosDonacion).subscribe({
      next: (res) => {
        this.resultadoDonacion = res;
        this.codigoRecarga = res.codigo_recarga || '';
        
        // Recargar participaciones para reflejar el nuevo estado
        this.loadParticipaciones();
        // Notificar a la cartera principal para que recargue
        this.carteraService.notifyParticipacionesChanged();
        
        // Mostrar alertas de éxito
        // Si hay donación y código, mostrar primero la de donación, luego la de código
        if (this.importeDonacion > 0 && this.importeCodigo > 0 && this.codigoRecarga) {
          this.tipoMensaje = 'donacion';
          this.mostrarMensajeExito = true;
        } else if (this.importeDonacion > 0) {
          // Solo donación
          this.tipoMensaje = 'donacion';
          this.mostrarMensajeExito = true;
        } else if (this.importeCodigo > 0 && this.codigoRecarga) {
          // Solo código
          this.tipoMensaje = 'codigo';
          this.mostrarMensajeExito = true;
        }
        
        this.resetSeleccion();
      },
      error: async (err) => {
        const msg = err.error?.message || 'No se pudo registrar la donación.';
        await this.alertModal.show('Error', msg);
      }
    });
  }

  cerrarMensajeExito() {
    this.mostrarMensajeExito = false;
    
    // Si hay código de recarga y se mostró la alerta de donación, mostrar ahora la de código
    if (this.tipoMensaje === 'donacion' && this.importeCodigo > 0 && this.codigoRecarga) {
      this.tipoMensaje = 'codigo';
      this.mostrarMensajeExito = true;
      return;
    }
    
    // Si ya se mostraron ambas o solo una, limpiar todo
    this.datosPersonales = { nombre: '', apellidos: '', nif: '' };
    this.ibanFormateado = '';
    this.codigoRecarga = '';
    this.datosGuardados = false;
    this.resultadoDonacion = null;
    // Recargar participaciones para asegurar que se refleje el nuevo estado
    this.loadParticipaciones();
  }

  getImageUrl(path: string | null | undefined): string {
    if (!path) return '';
    if (path.startsWith('http')) return path;
    const base = environment.apiUrl.replace(/\/api\/?$/, '');
    const normalized = path.replace(/^storage\/?/, '');
    return `${base}/uploads/${normalized}`;
  }

  volver() {
    this.resetSeleccion();
  }

  manejarErrorImagen(event: any) {
    // Evitar bucle infinito verificando si ya es el placeholder
    if (event.target.src && !event.target.src.includes('data:image')) {
      // Si falla la imagen, usar un placeholder base64 o simplemente ocultar
      event.target.style.display = 'none';
      event.target.parentElement.classList.add('image-error');
    }
  }

  obtenerImagenSegura(imagen: string | undefined): string {
    // Si la imagen es base64, devolverla directamente
    if (imagen && imagen.startsWith('data:image')) {
      return imagen;
    }
    // Si no hay imagen o no es válida, devolver null para usar el placeholder CSS
    return imagen || '';
  }

}
