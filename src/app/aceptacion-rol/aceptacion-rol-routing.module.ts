import { NgModule } from '@angular/core';
import { Routes, RouterModule } from '@angular/router';
import { AceptacionRolPage } from './aceptacion-rol.page';

const routes: Routes = [
  {
    path: '',
    component: AceptacionRolPage,
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class AceptacionRolPageRoutingModule {}
