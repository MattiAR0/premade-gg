import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  token = '';
  email = '';
  password = '';
  confirmPassword = '';
  loading = false;
  errorMessage = '';
  successMessage = '';
  invalidLink = false;

  private readonly baseUrl = environment.apiUrl;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe((params) => {
      this.token = params['token'] || '';
      this.email = params['email'] || '';

      if (!this.token || !this.email) {
        this.invalidLink = true;
      }
    });
  }

  onSubmit(): void {
    this.errorMessage = '';

    if (!this.password || !this.confirmPassword) {
      this.errorMessage = 'Por favor completa todos los campos';
      return;
    }

    if (this.password.length < 6) {
      this.errorMessage = 'La contraseña debe tener al menos 6 caracteres';
      return;
    }

    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Las contraseñas no coinciden';
      return;
    }

    this.loading = true;

    this.http.post<{ message: string }>(`${this.baseUrl}/auth/reset-password`, {
      token: this.token,
      email: this.email,
      password: this.password,
    }).subscribe({
      next: (res) => {
        this.loading = false;
        this.successMessage = res.message;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loading = false;
        this.errorMessage = err.error?.message || 'Error al restablecer la contraseña';
        this.cdr.markForCheck();
      },
    });
  }
}
