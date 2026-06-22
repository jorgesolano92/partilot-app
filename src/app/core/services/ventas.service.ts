import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface BuyerNotifyConfigResponse {
  success: boolean;
  historial?: any[];
  sms_enabled?: boolean;
  /** Siempre false: ya no se usa Twilio WhatsApp. */
  whatsapp_enabled?: boolean;
  buyer_notify_channel?: 'sms' | 'manual';
  notify_auto_enabled?: boolean;
  buyer_sms_max_resends?: number;
  buyer_sms_sent_count?: number;
  buyer_sms_can_send?: boolean;
  buyer_sms_sends_remaining?: number;
}

@Injectable({
  providedIn: 'root'
})
export class VentasService {
  private apiUrl = environment.apiUrl;
  private ventasChanged$ = new Subject<void>();

  /** Emitir cuando hay ventas/participaciones que requieren recargar pantallas */
  notifyVentasChanged(): void {
    this.ventasChanged$.next();
  }

  /** Observable para suscribirse y recargar participaciones e historial */
  getVentasChanged(): Observable<void> {
    return this.ventasChanged$.asObservable();
  }

  constructor(private http: HttpClient) {}

  getReserves(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sellers/me/reserves`);
  }

  validateSale(setId: number, desde: number, hasta: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/sellers/me/validate-sale`, {
      set_id: setId,
      desde,
      hasta
    });
  }

  sellManual(setId: number, desde: number, hasta: number, paymentMethod?: string | null): Observable<any> {
    const body: any = { set_id: setId, desde, hasta };
    if (paymentMethod) {
      body.payment_method = paymentMethod;
    }
    return this.http.post(`${this.apiUrl}/sales/manual`, body);
  }

  /**
   * Verificar si un usuario existe por email (para venta digital)
   */
  checkUserExists(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/users/check-exists`, { email });
  }

  /**
   * Participaciones digitales disponibles: por set (asignadas al vendedor) o pool entidad+sorteo.
   */
  getTotalDigitalAvailable(
    params: { set_id: number } | { entity_id: number; lottery_id: number }
  ): Observable<any> {
    if ('set_id' in params) {
      return this.http.get(`${this.apiUrl}/sellers/me/digital-available?set_id=${params.set_id}`);
    }
    return this.http.get(
      `${this.apiUrl}/sellers/me/digital-available?entity_id=${params.entity_id}&lottery_id=${params.lottery_id}`
    );
  }

  /**
   * Vender participaciones digitales. Con set_id (por set) o entity_id+lottery_id (pool de la entidad).
   */
  sellDigital(
    params:
      | { set_id: number; quantity: number; buyer_email: string; payment_method?: string | null }
      | { entity_id: number; lottery_id: number; quantity: number; buyer_email: string; payment_method?: string | null }
  ): Observable<any> {
    const body: any = {
      quantity: params.quantity,
      buyer_email: params.buyer_email,
      ...(params.payment_method != null && { payment_method: params.payment_method }),
    };
    if ('set_id' in params) {
      body.set_id = params.set_id;
    } else {
      body.entity_id = params.entity_id;
      body.lottery_id = params.lottery_id;
    }
    return this.http.post(`${this.apiUrl}/sales/digital`, body);
  }

  /**
   * Reservar venta digital y enviar email de registro al comprador no registrado.
   */
  sellDigitalPending(
    params:
      | {
          set_id: number;
          quantity: number;
          buyer_email?: string;
          buyer_phone?: string;
          notify_channel?: 'email' | 'sms' | 'whatsapp';
          payment_method?: string | null;
        }
      | {
          entity_id: number;
          lottery_id: number;
          quantity: number;
          buyer_email?: string;
          buyer_phone?: string;
          notify_channel?: 'email' | 'sms' | 'whatsapp';
          payment_method?: string | null;
        }
  ): Observable<any> {
    const body: any = {
      quantity: params.quantity,
      ...(params.buyer_email != null && params.buyer_email !== '' && { buyer_email: params.buyer_email }),
      ...(params.buyer_phone != null && params.buyer_phone !== '' && { buyer_phone: params.buyer_phone }),
      ...(params.notify_channel != null && { notify_channel: params.notify_channel }),
      ...(params.payment_method != null && { payment_method: params.payment_method }),
    };
    if ('set_id' in params) {
      body.set_id = params.set_id;
    } else {
      body.entity_id = params.entity_id;
      body.lottery_id = params.lottery_id;
    }
    return this.http.post(`${this.apiUrl}/sales/digital/pending`, body);
  }

  sellByQr(referencia: string, desde?: number, hasta?: number, paymentMethod?: string | null): Observable<any> {
    const body: any = { referencia };
    if (desde !== undefined && hasta !== undefined) {
      body.desde = desde;
      body.hasta = hasta;
    }
    if (paymentMethod) {
      body.payment_method = paymentMethod;
    }
    return this.http.post(`${this.apiUrl}/sales/qr`, body);
  }

  getMyEntities(): Observable<any> {
    return this.http.get(`${this.apiUrl}/sellers/me/entities`);
  }

  getMyLotteries(entityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sellers/me/lotteries?entity_id=${entityId}`);
  }

  getMyTacos(entityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sellers/me/tacos?entity_id=${entityId}`);
  }

  getTacoParticipations(setId: number, bookNumber: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/sellers/me/tacos/${setId}/${bookNumber}/participations`);
  }

  /** Gestor: entidades que gestiona (tabla managers) */
  getManagerEntities(): Observable<any> {
    return this.http.get(`${this.apiUrl}/managers/me/entities`);
  }

  /** Gestor: sorteos para asignación (permiso vendedores). */
  getManagerAssignmentLotteries(entityId: number): Observable<{ success: boolean; lotteries: any[]; message?: string }> {
    return this.http.get<{ success: boolean; lotteries: any[]; message?: string }>(
      `${this.apiUrl}/managers/me/entities/${entityId}/assignment/lotteries`
    );
  }

  /** Gestor: sets con participaciones disponibles para asignar. */
  getManagerAssignmentSets(
    entityId: number,
    lotteryId: number
  ): Observable<{ success: boolean; sets: any[]; message?: string }> {
    return this.http.get<{ success: boolean; sets: any[]; message?: string }>(
      `${this.apiUrl}/managers/me/entities/${entityId}/assignment/sets`,
      { params: { lottery_id: String(lotteryId) } }
    );
  }

  /** Gestor: resolver referencia QR para campo desde/hasta en asignación. */
  validateManagerAssignmentReference(
    entityId: number,
    lotteryId: number,
    referencia: string
  ): Observable<{ success: boolean; participations?: any[]; message?: string }> {
    return this.http.post<{ success: boolean; participations?: any[]; message?: string }>(
      `${this.apiUrl}/managers/me/entities/${entityId}/assignment/validate-reference`,
      { lottery_id: lotteryId, referencia }
    );
  }

  /** Gestor: vendedores de una entidad (listado con participaciones y monto por liquidar) */
  getManagerEntitySellers(entityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/managers/me/entities/${entityId}/sellers`);
  }

  /** Gestor: detalle de un vendedor (participaciones + liquidación + lotteries_with_pending) */
  getManagerSellerDetail(entityId: number, sellerId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/managers/me/entities/${entityId}/sellers/${sellerId}/detail`);
  }

  /** Gestor: registrar liquidación de un vendedor (solo seller_settlements) */
  storeManagerSettlement(
    entityId: number,
    sellerId: number,
    data: { lottery_id: number; pagos: Array<{ payment_method: string; amount: number }> }
  ): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/managers/me/entities/${entityId}/sellers/${sellerId}/settlement`,
      data
    );
  }

  /** Gestor: tacos de una entidad (con seller_id y seller_name en cada taco) */
  getManagerTacos(entityId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/managers/me/tacos`, { params: { entity_id: entityId } });
  }

  /**
   * Gestor: leer QR del taco (portada) para asignación — devuelve sorteo, set y rangos de participaciones libres en el libro.
   * GET /api/managers/me/taco-for-assign?entity_id=&seller_id=&taco_ref=
   */
  getManagerTacoForAssign(entityId: number, sellerId: number, tacoRef: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/managers/me/taco-for-assign`, {
      params: {
        entity_id: String(entityId),
        seller_id: String(sellerId),
        taco_ref: tacoRef,
      },
    });
  }

  /** Gestor: participaciones de un taco (set + book + seller) */
  getManagerTacoParticipations(setId: number, bookNumber: number, sellerId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/managers/me/tacos/${setId}/${bookNumber}/participations`, {
      params: { seller_id: sellerId }
    });
  }

  /** Gestor: comprobar si existe usuario por email (flujo Añadir Vendedor SIPART) */
  checkManagerUserEmail(email: string): Observable<{ exists: boolean }> {
    return this.http.post<{ exists: boolean }>(`${this.apiUrl}/managers/me/check-user-email`, { email });
  }

  /** Gestor: añadir vendedor PARTILOT (usuario existente) */
  storeManagerExistingUser(entityId: number, email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/managers/me/store-existing-user`, { entity_id: entityId, email });
  }

  /** Gestor: invitar vendedor (0 coincidencias) */
  storeManagerNewUser(entityId: number, email: string, name?: string, last_name?: string): Observable<any> {
    const body: any = { entity_id: entityId, email };
    if (name != null) body.name = name;
    if (last_name != null) body.last_name = last_name;
    return this.http.post(`${this.apiUrl}/managers/me/store-new-user`, body);
  }

  /** Gestor: crear vendedor externo (formulario completo) */
  storeManagerExternalSeller(entityId: number, data: {
    name?: string; last_name?: string; last_name2?: string;
    email: string; phone?: string; birthday?: string; nif_cif?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/managers/me/store-external-seller`, { entity_id: entityId, ...data });
  }

  /**
   * Resolver QR del taco (portada): devuelve rangos disponibles para el vendedor.
   * Solo vendedores. GET /api/sellers/me/taco-by-qr?taco_ref=...
   */
  getTacoByQr(tacoRef: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/sellers/me/taco-by-qr`, {
      params: { taco_ref: tacoRef }
    });
  }

  /**
   * Obtener historial de ventas del vendedor autenticado desde la API Partilot.
   */
  getHistorial(): Observable<BuyerNotifyConfigResponse> {
    return this.http.get<BuyerNotifyConfigResponse>(`${this.apiUrl}/sales/me`);
  }

  /**
   * SMS o WhatsApp al comprador (prioridad SMS en servidor; código + enlace).
   */
  sendPendingDigitalNotify(
    pendingId: number,
    phone?: string
  ): Observable<{
    success: boolean;
    message: string;
    channel?: string;
    message_sid?: string;
    buyer_sms_sent_count?: number;
    buyer_sms_sends_remaining?: number;
  }> {
    return this.http.post<{
      success: boolean;
      message: string;
      channel?: string;
      message_sid?: string;
      buyer_sms_sent_count?: number;
      buyer_sms_sends_remaining?: number;
    }>(
      `${this.apiUrl}/sales/digital/pending/${pendingId}/notify`,
      phone ? { phone } : {}
    );
  }

  resendPendingDigitalEmail(pendingId: number): Observable<{
    success: boolean;
    message: string;
    masked_buyer_contact?: string;
  }> {
    return this.http.post<{
      success: boolean;
      message: string;
      masked_buyer_contact?: string;
    }>(`${this.apiUrl}/sales/digital/pending/${pendingId}/resend-email`, {});
  }

  /** @deprecated Usar sendPendingDigitalNotify */
  sendPendingDigitalWhatsApp(pendingId: number, phone: string) {
    return this.sendPendingDigitalNotify(pendingId, phone);
  }

  getPendingDigitalWhatsAppLink(pendingId: number): Observable<{
    success: boolean;
    whatsapp_url?: string;
    masked_buyer_contact?: string;
    message?: string;
  }> {
    return this.http.get<{
      success: boolean;
      whatsapp_url?: string;
      masked_buyer_contact?: string;
      message?: string;
    }>(`${this.apiUrl}/sales/digital/pending/${pendingId}/whatsapp-link`);
  }

  getBuyerNotifyConfig(): Observable<BuyerNotifyConfigResponse> {
    return this.http.get<BuyerNotifyConfigResponse>(`${this.apiUrl}/sales/notify/config`);
  }

  /** @deprecated Usar getBuyerNotifyConfig */
  getWhatsAppConfig(): Observable<BuyerNotifyConfigResponse> {
    return this.getBuyerNotifyConfig();
  }

  /**
   * Digitalizar participación escaneando QR
   */
  digitalizeParticipation(referencia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/participations/digitalize`, { referencia });
  }

  /**
   * Gestor: rangos de participaciones disponibles en un set (para mostrar "Disponibles: de la X a la Y").
   * GET /api/sellers/available-ranges-set?set_id=
   */
  getAvailableRangesForSet(setId: number): Observable<{ success: boolean; available_ranges: number[][] }> {
    return this.http.get<{ success: boolean; available_ranges: number[][] }>(
      `${this.apiUrl}/sellers/available-ranges-set`,
      { params: { set_id: setId.toString() } }
    );
  }

  /**
   * Gestor: validar participaciones disponibles para asignar a un vendedor.
   * POST /api/sellers/validate-participations
   * Para unidad: desde === hasta.
   */
  validateAssignments(
    sellerId: number,
    setId: number,
    desde: number,
    hasta: number
  ): Observable<{ success: boolean; participations?: any[]; message?: string }> {
    return this.http.post<{ success: boolean; participations?: any[]; message?: string }>(
      `${this.apiUrl}/sellers/validate-participations`,
      { seller_id: sellerId, set_id: setId, desde, hasta }
    );
  }

  /**
   * Gestor: validar/asignar por cantidad (solo sets digitales).
   * cantidad=0 solo devuelve disponibles_restantes; cantidad>0 devuelve participaciones y disponibles_restantes.
   */
  validateAssignmentsByCantidad(
    sellerId: number,
    setId: number,
    cantidad: number
  ): Observable<{ success: boolean; participations?: any[]; disponibles_restantes?: number; message?: string }> {
    return this.http.post<{ success: boolean; participations?: any[]; disponibles_restantes?: number; message?: string }>(
      `${this.apiUrl}/sellers/validate-participations`,
      { seller_id: sellerId, set_id: setId, cantidad }
    );
  }

  /**
   * Gestor: guardar asignación de participaciones a un vendedor.
   * POST /api/sellers/save-assignments
   * Body: { seller_id, participations_json: JSON.stringify([{ id, number, set_id }]) }
   */
  saveAssignments(
    sellerId: number,
    participations: Array<{ id: number; number: number; set_id: number }>
  ): Observable<{ success: boolean; message?: string; assigned_count?: number }> {
    const participationsJson = JSON.stringify(
      participations.map(p => ({ id: p.id, number: p.number, set_id: p.set_id }))
    );
    return this.http.post<{ success: boolean; message?: string; assigned_count?: number }>(
      `${this.apiUrl}/sellers/save-assignments`,
      { seller_id: sellerId, participations_json: participationsJson }
    );
  }
}
