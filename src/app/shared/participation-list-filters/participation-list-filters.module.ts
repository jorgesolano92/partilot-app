import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { ParticipationListFiltersComponent } from './participation-list-filters.component';

@NgModule({
  declarations: [ParticipationListFiltersComponent],
  imports: [CommonModule, FormsModule, IonicModule],
  exports: [ParticipationListFiltersComponent],
})
export class ParticipationListFiltersModule {}
