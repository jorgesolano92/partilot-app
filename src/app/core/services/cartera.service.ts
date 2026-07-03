import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ParticipationListMeta,
  ParticipationListQuery,
  listQueryToParams,
} from '../models/list-pagination.model';

@Injectable({
  providedIn: 'root'
})
export class CarteraService {
  private apiUrl = environment.apiUrl;
  private participacionesChanged$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  /** Observable para notificar cambios en las participaciones */
  getParticipacionesChanged(): Observable<void> {
    return this.participacionesChanged$.asObservable();
  }

  /** Notificar que las participaciones han cambiado */
  notifyParticipacionesChanged(): void {
    this.participacionesChanged$.next();
  }

  /** Listar participaciones de la cartera del usuario */
  getParticipations(query?: ParticipationListQuery): Observable<{
    success: boolean;
    participations: any[];
    meta?: ParticipationListMeta;
  }> {
    let params = new HttpParams();
    if (query) {
      Object.entries(listQueryToParams(query)).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }

    return this.http.get<{ success: boolean; participations: any[]; meta?: ParticipationListMeta }>(
      `${this.apiUrl}/wallet/participations`,
      { params }
    );
  }

  /** Consultar participación por referencia (antes de vincular) */
  checkByReference(referencia: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/wallet/participations/check`, {
      params: { referencia }
    });
  }

  /** Vincular participación a la cartera (digitalizar) */
  linkToWallet(referencia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/participations/link`, { referencia });
  }

  /** Guardar participación física en almacén (solo consulta) */
  storeInWarehouse(referencia: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/participations/store-warehouse`, { referencia });
  }

  /** Vincular venta digital pendiente por código (email erróneo o registro sin código). */
  claimPendingDigitalByCode(linkCode: string): Observable<{
    success: boolean;
    message?: string;
    quantity?: number;
    entity?: string;
    lottery?: string;
  }> {
    return this.http.post<{
      success: boolean;
      message?: string;
      quantity?: number;
      entity?: string;
      lottery?: string;
    }>(`${this.apiUrl}/wallet/digital-pending/claim`, {
      link_code: linkCode.trim(),
    });
  }

  /** Regalar participación a otro usuario por email */
  gift(participationId: number, email: string, message?: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/participations/gift`, {
      participation_id: participationId,
      email,
      message: message?.trim() || undefined,
    });
  }

  getPendingGifts(): Observable<{ success: boolean; count: number; gifts: any[] }> {
    return this.http.get<{ success: boolean; count: number; gifts: any[] }>(`${this.apiUrl}/wallet/gifts/pending`);
  }

  acceptGift(giftId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/gifts/${giftId}/accept`, {});
  }

  rejectGift(giftId: number): Observable<any> {
    return this.http.post(`${this.apiUrl}/wallet/gifts/${giftId}/reject`, {});
  }

  /** Historial del usuario: digitalizaciones, regalos (cobros pendiente) */
  getHistorial(query?: ParticipationListQuery): Observable<{
    success: boolean;
    historial: any[];
    meta?: ParticipationListMeta;
  }> {
    let params = new HttpParams();
    if (query) {
      Object.entries(listQueryToParams(query)).forEach(([key, value]) => {
        params = params.set(key, value);
      });
    }

    return this.http.get<{ success: boolean; historial: any[]; meta?: ParticipationListMeta }>(
      `${this.apiUrl}/wallet/historial`,
      { params }
    );
  }

  /** Participaciones cobrables (con premio, no regaladas, no cobradas) */
  getCobrables(): Observable<{ success: boolean; participations: any[] }> {
    return this.http.get<{ success: boolean; participations: any[] }>(`${this.apiUrl}/wallet/participations/cobrables`);
  }

  /** Registrar cobro (nombre, apellidos, nif, iban, participation_ids, importe_total) */
  registrarCobro(data: {
    participation_ids: number[];
    nombre: string;
    apellidos: string;
    nif: string;
    iban: string;
    importe_total: number;
    confirmacion_cobro_irreversible: boolean;
  }): Observable<{ success: boolean; message?: string; collected_count?: number; pending_verification?: boolean }> {
    return this.http.post<{ success: boolean; message?: string; collected_count?: number; pending_verification?: boolean }>(`${this.apiUrl}/wallet/cobro`, data);
  }

  /** Registrar donación (participation_ids, importe_donacion, importe_codigo, datos personales opcionales) */
  registrarDonacion(data: {
    participation_ids: number[];
    importe_donacion: number;
    importe_codigo: number;
    nombre?: string;
    apellidos?: string;
    nif?: string;
    confirmacion_operacion_irreversible: boolean;
    confirmacion_donacion_irreversible?: boolean;
    certificado_fiscal?: boolean;
  }): Observable<{
    success: boolean; 
    message?: string; 
    donation_id?: number;
    codigo_recarga?: string;
    importe_donacion?: number;
    importe_codigo?: number;
  }> {
    return this.http.post<{ 
      success: boolean; 
      message?: string; 
      donation_id?: number;
      codigo_recarga?: string;
      importe_donacion?: number;
      importe_codigo?: number;
    }>(`${this.apiUrl}/wallet/donacion`, data);
  }
}
