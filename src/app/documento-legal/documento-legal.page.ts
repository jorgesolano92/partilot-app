import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { LegalService } from '../core/services/legal.service';

@Component({
  selector: 'app-documento-legal',
  templateUrl: './documento-legal.page.html',
  styleUrls: ['./documento-legal.page.scss'],
  standalone: false,
})
export class DocumentoLegalPage implements OnInit {
  title = 'Documento legal';
  safeUrl: SafeResourceUrl | null = null;
  loading = true;
  error = '';

  constructor(
    private route: ActivatedRoute,
    private sanitizer: DomSanitizer,
    private legalService: LegalService
  ) {}

  ngOnInit() {
    const slug = this.route.snapshot.queryParamMap.get('slug');
    const directUrl = this.route.snapshot.queryParamMap.get('url');

    if (directUrl && this.legalService.isAllowedDocumentUrl(directUrl)) {
      const embedUrl = this.legalService.embedDocumentUrl(directUrl);
      this.applyUrl(embedUrl, this.route.snapshot.queryParamMap.get('title') || 'Documento legal');
      return;
    }

    if (!slug) {
      this.error = 'No se ha indicado qué documento mostrar.';
      this.loading = false;
      return;
    }

    this.legalService.getClientConfig().subscribe((config) => {
      const doc = config?.documents?.find((item) => item.slug === slug);
      if (!doc?.url || !this.legalService.isAllowedDocumentUrl(doc.url)) {
        this.error = 'No se pudo cargar el documento legal.';
        this.loading = false;
        return;
      }
      const embedUrl = this.legalService.embedDocumentUrl(doc.url);
      this.applyUrl(embedUrl, doc.title);
    });
  }

  private applyUrl(url: string, title: string) {
    this.title = title;
    this.safeUrl = this.sanitizer.bypassSecurityTrustResourceUrl(url);
    this.loading = false;
  }
}
