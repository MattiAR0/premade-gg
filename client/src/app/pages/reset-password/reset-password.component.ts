import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';

/**
 * Llega desde el enlace del email de recuperación. Supabase procesa el token de la
 * URL al arrancar y deja al usuario con una sesión temporal para cambiar la contraseña.
 */
@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './reset-password.component.html',
  styleUrl: './reset-password.component.scss',
})
export class ResetPasswordComponent implements OnInit {
  password = '';
  confirmPassword = '';
  loading = false;
  errorMessage = '';
  successMessage = '';
  invalidLink = false;

  constructor(
    private readonly authService: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  async ngOnInit(): Promise<void> {
    await this.authService.whenSessionRestored;

    // Enlace caducado o ya usado: Supabase deja el error en el hash de la URL
    const linkError = new URLSearchParams(window.location.hash.slice(1)).get('error_code');
    this.invalidLink = !!linkError || !this.authService.session();
    this.cdr.markForCheck();
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

    this.authService.updatePassword(this.password).subscribe({
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
