import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { CarteraPageRoutingModule } from './cartera-routing.module';

import { CarteraPage } from './cartera.page';

import { ParticipationListFiltersModule } from '../shared/participation-list-filters/participation-list-filters.module';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    CarteraPageRoutingModule,
    ParticipationListFiltersModule,
  ],
  declarations: [CarteraPage]
})
export class CarteraPageModule {}
