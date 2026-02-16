import { Component, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.component.html',
  styleUrl: './forgot-password.component.scss',
})
export class ForgotPasswordComponent {
  email = '';
  loading = false;
  errorMessage = '';
  successMessage = '';

  private readonly baseUrl = environment.apiUrl;

  constructor(
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  onSubmit(): void {
    if (!this.email) {
      this.errorMessage = 'Por favor ingresa tu email';
      return;
    }

    this.loading = true;
    this.errorMessage = '';
    this.successMessage = '';

    this.http.post<{ message: string }>(`${this.baseUrl}/auth/forgot-password`, {
      email: this.email,
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Error al procesar la solicitud';
        this.cdr.markForCheck();
      },
    });
  }
}
