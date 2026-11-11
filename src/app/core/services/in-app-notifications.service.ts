import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface ApiNotificationRow {
  id: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  fecha: string;
  leida: boolean;
  detalle?: string | null;
  rolContext: string;
  entidadNombre?: string | null;
  invitadorTexto?: string | null;
  entity_image?: string | null;
  roleInvitationKey?: string | null;
  assignmentState?: string | null;
  actionable?: boolean;
  proposalId?: number | null;
  deepLink?: string | null;
}

@Injectable({ providedIn: 'root' })
export class InAppNotificationsService {
  private readonly base = `${environment.apiUrl.replace(/\/$/, '')}/notifications`;

  constructor(private http: HttpClient) {}

  list(): Observable<{ success: boolean; notifications: ApiNotificationRow[] }> {
    return this.http.get<{ success: boolean; notifications: ApiNotificationRow[] }>(this.base);
  }

  getOne(id: number): Observable<{ success: boolean; notification: ApiNotificationRow }> {
    return this.http.get<{ success: boolean; notification: ApiNotificationRow }>(`${this.base}/${id}`);
  }

  markRead(id: number): Observable<{ success: boolean }> {
    return this.http.put<{ success: boolean }>(`${this.base}/${id}/read`, {});
  }

  markAllRead(): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.base}/mark-all-read`, {});
  }

  unreadCount(): Observable<{ success: boolean; count: number }> {
    return this.http.get<{ success: boolean; count: number }>(`${this.base}/unread/count`);
  }
}
