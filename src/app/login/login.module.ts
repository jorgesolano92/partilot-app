import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { IonicModule } from '@ionic/angular';

import { LoginPageRoutingModule } from './login-routing.module';
import { AgeResponsibleBadgeModule } from '../shared/age-responsible-badge/age-responsible-badge.module';

import { LoginPage } from './login.page';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    LoginPageRoutingModule,
    AgeResponsibleBadgeModule,
  ],
  declarations: [LoginPage]
})
export class LoginPageModule {}
