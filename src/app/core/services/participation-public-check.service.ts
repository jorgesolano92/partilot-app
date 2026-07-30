import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export type ParticipationDrawStatus = 'pending_celebration' | 'pending_results' | 'completed';

export interface ParticipationPublicCheckPrizeInfo {
  has_won: boolean;
  prize_amount: number;
  prize_category?: string | null;
  winning_categories?: Array<{ categoria: string; premio_decimo: number }>;
}

export interface ParticipationPublicCheckTicket {
  data: {
    participation_code: string;
    participation_number: string;
    numbers: number[];
    winning_numbers: number[];
    status?: string;
  };
  set: {
    id: number;
    played_amount: number;
    donation_amount?: number;
    total_played_amount?: number;
    total_amount?: number;
    amount_label?: string | null;
    amount_breakdown?: string | null;
    numbers_count?: number;
  };
  reserve: {
    entity: { name: string | null };
    reservation_numbers: number[];
    played_numbers_label?: string;
    played_numbers_text?: string;
  };
  lottery: {
    name: string | null;
    draw_date: string | null;
    ticket_price: number;
    draw_number?: string | null;
  };
  draw_status?: ParticipationDrawStatus;
  preview_image_url?: string | null;
  prize_info: ParticipationPublicCheckPrizeInfo | null;
}

export interface ParticipationPublicCheckResponse {
  success: boolean;
  error: string | null;
  ticket: ParticipationPublicCheckTicket | null;
}

@Injectable({
  providedIn: 'root',
})
export class ParticipationPublicCheckService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  check(referencia: string, sig?: string | null): Observable<ParticipationPublicCheckResponse> {
    let params = new HttpParams().set('ref', referencia);
    if (sig) {
      params = params.set('sig', sig);
    }

    return this.http.get<ParticipationPublicCheckResponse>(
      `${this.apiUrl}/public/participation-check`,
      { params }
    );
  }
}
