import { Injectable } from '@angular/core';

import { HttpClient } from '@angular/common/http';

import { Observable, catchError, map, of, shareReplay } from 'rxjs';

import { Capacitor } from '@capacitor/core';

import { environment } from '../../../environments/environment';



export interface LegalDocumentMeta {

  key: string;

  slug: string;

  title: string;

  version: string | null;

  hash: string | null;

  url: string;

}



export interface LegalClientConfig {

  terms_version: string;

  terms_text_hash: string;

  registration: {

    checkbox_label: string;

    version: string;

    text_hash: string;

    documents_url: string;

    privacy_url: string;

    terms_url: string;

  };

  role_intro_sentence: string;

  documents: LegalDocumentMeta[];

  prize_collection?: PrizeCollectionLegalConfig;

  prize_donation?: PrizeDonationLegalConfig;

  account_deletion?: AccountDeletionLegalConfig;

}



export interface PrizeCollectionLegalConfig {

  title: string;

  irreversibility_warning: string;

  confirm_label: string;

  confirm_again_label: string;

  double_confirm_message: string;

  legal_link_label: string;

  version: string;

  text_hash: string;

  legal_document_slug: string;

}



export interface PrizeDonationLegalConfig {

  title: string;

  notice_template: string;

  fiscal_certificate_question: string;

  rgpd_notice_template: string;

  confirm_label: string;

  confirm_again_label: string;

  version: string;

  text_hash: string;

}



export interface AccountDeletionLegalConfig {

  title: string;

  main_warning: string;

  prizes_warning: string;

  blocked_message: string;

  email_confirm_label: string;

  confirm_button: string;

  cancel_button: string;

  scheduled_notice: string;

  version: string;

  text_hash: string;

}



export interface AccountDeletionStatus {

  can_request: boolean;

  pending_prize_count: number;

  deletion_requested_at?: string | null;

  deletion_scheduled_at?: string | null;

  deletion_status?: string | null;

  ui: AccountDeletionLegalConfig;

}



export interface RoleInvitationContext {

  manager_id?: number;

  seller_id?: number;

  entity_id?: number;

  entity_name?: string;

  administration_name?: string;

  invited_at?: string;

  user_name?: string;

  user_nif?: string;

}



export interface RoleInvitationPending {

  key: string;

  type: 'gestor_responsable' | 'gestor' | 'vendedor' | string;

  action: string;

  screen_title: string;

  intro_sentence?: string;

  accept_label: string;

  reject_label: string;

  summary_bullets: string[];

  legal_document_slug: string;

  version: string;

  text_hash: string;

  requires_password_setup?: boolean;

  context: RoleInvitationContext;

}



@Injectable({

  providedIn: 'root',

})

export class LegalService {

  private apiUrl = environment.apiUrl;

  private configCache$?: Observable<LegalClientConfig | null>;



  constructor(private http: HttpClient) {}



  getClientConfig(): Observable<LegalClientConfig | null> {

    if (!this.configCache$) {

      this.configCache$ = this.http

        .get<{ success: boolean; data: LegalClientConfig }>(`${this.apiUrl}/legal/config`, {

          headers: this.channelHeaders(),

        })

        .pipe(

          map((response) => (response?.success ? response.data : null)),

          catchError(() => of(null)),

          shareReplay(1)

        );

    }



    return this.configCache$;

  }



  getPendingAcceptances(): Observable<RoleInvitationPending[]> {

    return this.http

      .get<{ success: boolean; pending: RoleInvitationPending[] }>(

        `${this.apiUrl}/legal/pending-acceptances`,

        { headers: this.channelHeaders() }

      )

      .pipe(

        map((response) => (response?.success ? response.pending ?? [] : [])),

        catchError(() => of([]))

      );

  }



  getRoleInvitation(key: string): Observable<RoleInvitationPending | null> {

    return this.http

      .get<{ success: boolean; invitation: RoleInvitationPending }>(

        `${this.apiUrl}/legal/role-invitations/${encodeURIComponent(key)}`,

        { headers: this.channelHeaders() }

      )

      .pipe(

        map((response) => (response?.success ? response.invitation : null)),

        catchError(() => of(null))

      );

  }



  respondRoleInvitation(

    key: string,

    action: 'accept' | 'reject'

  ): Observable<{ success: boolean; message?: string; requires_password_setup?: boolean }> {

    return this.http

      .post<{ success: boolean; message?: string; requires_password_setup?: boolean }>(

        `${this.apiUrl}/legal/role-invitations/${encodeURIComponent(key)}/respond`,

        { action },

        { headers: this.channelHeaders() }

      )

      .pipe(catchError((err) => of({ success: false, message: err.error?.message || 'Error de conexión.' })));

  }



  getAccountDeletionStatus(): Observable<AccountDeletionStatus | null> {

    return this.http

      .get<{ success: boolean; status: AccountDeletionStatus }>(

        `${this.apiUrl}/account/deletion/status`,

        { headers: this.channelHeaders() }

      )

      .pipe(

        map((response) => (response?.success ? response.status : null)),

        catchError(() => of(null))

      );

  }



  requestAccountDeletion(emailConfirm: string): Observable<{

    success: boolean;

    message?: string;

    status?: AccountDeletionStatus | null;

  }> {

    return this.http

      .post<{ success: boolean; message?: string; status?: AccountDeletionStatus }>(

        `${this.apiUrl}/account/deletion/request`,

        { email_confirm: emailConfirm },

        { headers: this.channelHeaders() }

      )

      .pipe(catchError((err) => of({

        success: false,

        message: err.error?.message || 'Error de conexión.',

        status: err.error?.status ?? null,

      })));

  }



  channelHeaders(): Record<string, string> {

    const platform = Capacitor.getPlatform();

    let channel = 'web';

    if (platform === 'ios') {

      channel = 'app_ios';

    } else if (platform === 'android') {

      channel = 'app_android';

    }

    return { 'X-Partilot-Channel': channel };

  }



  isAllowedDocumentUrl(url: string): boolean {

    if (!url) {

      return false;

    }

    try {

      const parsed = new URL(url);

      const apiOrigin = new URL(this.apiUrl.replace(/\/api\/?$/, '/')).origin;

      const allowedHosts = new Set([

        new URL(apiOrigin).hostname,

        'panel.partilot.es',

        '127.0.0.1',

        'localhost',

      ]);

      return allowedHosts.has(parsed.hostname);

    } catch {

      return false;

    }

  }

}


