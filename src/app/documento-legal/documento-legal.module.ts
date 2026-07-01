import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { DocumentoLegalPageRoutingModule } from './documento-legal-routing.module';
import { DocumentoLegalPage } from './documento-legal.page';

@NgModule({
  imports: [CommonModule, FormsModule, IonicModule, DocumentoLegalPageRoutingModule],
  declarations: [DocumentoLegalPage],
})
export class DocumentoLegalPageModule {}
