import { Component, OnInit } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LegalDocumentMeta, LegalService } from '../core/services/legal.service';

@Component({
  selector: 'app-condiciones-legales',
  templateUrl: './condiciones-legales.page.html',
  styleUrls: ['./condiciones-legales.page.scss'],
  standalone: false,
})
export class CondicionesLegalesPage implements OnInit {
  documents: LegalDocumentMeta[] = [];
  selectedSlug = 'terminos-y-condiciones';
  safeUrl: SafeResourceUrl | null = null;
  loading = true;
  error = '';

  constructor(
    private legalService: LegalService,
    private sanitizer: DomSanitizer
  ) {}

  ngOnInit() {
    this.legalService.getClientConfig().subscribe((config) => {
      this.documents = (config?.documents || []).filter((doc) =>
        ['terminos-y-condiciones', 'politica-de-privacidad', 'politica-de-cookies', 'aviso-legal', 'marco-legal'].includes(doc.slug)
      );
      if (this.documents.length === 0) {
        this.error = 'No se pudieron cargar los documentos legales.';
        this.loading = false;
        return;
      }
      if (!this.documents.some((doc) => doc.slug === this.selectedSlug)) {
        this.selectedSlug = this.documents[0].slug;
      }
      this.selectDocument(this.selectedSlug);
    });
  }

  selectDocument(slug: string) {
    this.selectedSlug = slug;
    const doc = this.documents.find((item) => item.slug === slug);
    if (!doc?.url || !this.legalService.isAllowedDocumentUrl(doc.url)) {
      this.error = 'Documento no disponible.';
      this.safeUrl = null;
      this.loading = false;
      return;
    }
    this.error = '';
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(doc.url);
    this.loading = false;
  }
}
