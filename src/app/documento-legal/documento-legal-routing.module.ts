import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { DocumentoLegalPage } from './documento-legal.page';

const routes: Routes = [
  {
    path: '',
    component: DocumentoLegalPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class DocumentoLegalPageRoutingModule {}
