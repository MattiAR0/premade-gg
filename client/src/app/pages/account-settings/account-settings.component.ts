import { ChangeDetectorRef, Component, ElementRef, OnInit, ViewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AccountInfo } from '../../models/auth.model';
import { DialogDirective } from '../../shared/dialog/dialog.directive';
import { DatePipe } from '@angular/common';
import { ApiService } from '../../services/api.service';
import { MyModerationDecision } from '../../models/report.model';
import { RiotVerifyComponent } from '../../shared/riot-verify/riot-verify.component';

const PROVIDER_LABELS: Record<string, string> = { google: 'Google', discord: 'Discord' };

/** Palabra alternativa al Riot ID para confirmar el borrado (la Edge Function acepta la misma) */
export const DELETE_CONFIRM_WORD = 'BORRAR';

/**
 * Ajustes de cuenta: email, contraseña y borrado. Lo que se ve de cara a los demás
 * (bio, avatar, roles…) está en /settings/profile.
 */
@Component({
  selector: 'app-account-settings',
  standalone: true,
  imports: [FormsModule, RouterLink, DialogDirective, DatePipe, RiotVerifyComponent],
  templateUrl: './account-settings.component.html',
  styleUrl: './account-settings.component.scss',
})
export class AccountSettingsComponent implements OnInit {
  account: AccountInfo | null = null;
  loadError = '';

  /** Decisiones de moderación sobre la cuenta (para verlas y recurrirlas sin depender de la notificación) */
  decisions: MyModerationDecision[] = [];

  // Email
  newEmail = '';
  emailSaving = false;
  emailError = '';
  emailSuccess = '';

  // Contraseña
  currentPassword = '';
  newPassword = '';
  confirmPassword = '';
  passwordSaving = false;
  passwordError = '';
  passwordSuccess = '';

  // Borrar cuenta
  showDeleteModal = false;
  deleteConfirmation = '';
  deleting = false;
  deleteError = '';
  readonly confirmWord = DELETE_CONFIRM_WORD;

  @ViewChild('emailInput') private emailInput?: ElementRef<HTMLInputElement>;
  @ViewChild('currentPasswordInput') private currentPasswordInput?: ElementRef<HTMLInputElement>;
  @ViewChild('newPasswordInput') private newPasswordInput?: ElementRef<HTMLInputElement>;

  constructor(
    readonly authService: AuthService,
    private readonly api: ApiService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) {}

  /** El servicio ya ha actualizado el usuario (riotVerified); solo hay que repintar */
  onRiotVerified(): void {
    this.cdr.markForCheck();
  }

  ngOnInit(): void {
    this.loadAccount();
    this.api.getMyModerationDecisions().subscribe({
      next: (decisions) => {
        this.decisions = decisions;
        this.cdr.markForCheck();
      },
    });
  }

  private loadAccount(): void {
    this.authService.getAccountInfo().subscribe({
      next: (account) => {
        this.account = account;
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.loadError = err.error?.message || 'No se pudieron cargar los datos de la cuenta';
        this.cdr.markForCheck();
      },
    });
  }

  /** "Google", "Google y Discord" */
  get providerNames(): string {
    const names = (this.account?.oauthProviders ?? []).map((p) => PROVIDER_LABELS[p] ?? p);
    return names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0] ?? '';
  }

  get riotId(): string {
    return this.authService.currentUser()?.riotId ?? '';
  }

  // ── Email ────────────────────────────────────────────
  changeEmail(): void {
    this.emailError = '';
    this.emailSuccess = '';
    const email = this.newEmail.trim();

    if (!email) {
      this.emailError = 'Escribe el email nuevo';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      this.emailError = 'El email no es válido';
    } else if (email.toLowerCase() === this.account?.email.toLowerCase()) {
      this.emailError = 'Ese ya es tu email actual';
    }
    if (this.emailError) {
      this.emailInput?.nativeElement.focus();
      return;
    }

    this.emailSaving = true;
    this.authService.changeEmail(email).subscribe({
      next: (res) => {
        this.emailSaving = false;
        this.emailSuccess = res.message;
        this.newEmail = '';
        if (this.account) this.account = { ...this.account, pendingEmail: email };
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.emailSaving = false;
        this.emailError = err.error?.message || 'No se pudo cambiar el email';
        this.cdr.markForCheck();
        this.emailInput?.nativeElement.focus();
      },
    });
  }

  // ── Contraseña ───────────────────────────────────────
  changePassword(): void {
    this.passwordError = '';
    this.passwordSuccess = '';

    if (!this.currentPassword || !this.newPassword || !this.confirmPassword) {
      this.passwordError = 'Completa los tres campos';
    } else if (this.newPassword.length < 6) {
      this.passwordError = 'La contraseña nueva debe tener al menos 6 caracteres';
    } else if (this.newPassword !== this.confirmPassword) {
      this.passwordError = 'Las contraseñas nuevas no coinciden';
    } else if (this.newPassword === this.currentPassword) {
      this.passwordError = 'La contraseña nueva debe ser distinta a la actual';
    }
    if (this.passwordError) {
      (this.currentPassword ? this.newPasswordInput : this.currentPasswordInput)?.nativeElement.focus();
      return;
    }

    this.passwordSaving = true;
    this.authService.changePassword(this.currentPassword, this.newPassword).subscribe({
      next: (res) => {
        this.passwordSaving = false;
        this.passwordSuccess = res.message;
        this.currentPassword = this.newPassword = this.confirmPassword = '';
        this.cdr.markForCheck();
      },
      error: (err) => {
        this.passwordSaving = false;
        this.passwordError = err.error?.message || 'No se pudo cambiar la contraseña';
        this.cdr.markForCheck();
        const wrongCurrent = err.error?.code === 'invalid_credentials';
        (wrongCurrent ? this.currentPasswordInput : this.newPasswordInput)?.nativeElement.focus();
      },
    });
  }

  // ── Borrar cuenta ────────────────────────────────────
  /** "BORRAR" tal cual o el Riot ID sin distinguir mayúsculas (Riot tampoco las distingue) */
  get deleteConfirmed(): boolean {
    const value = this.deleteConfirmation.trim();
    return value === this.confirmWord || (!!this.riotId && value.toLowerCase() === this.riotId.toLowerCase());
  }

  openDeleteModal(): void {
    this.deleteConfirmation = '';
    this.deleteError = '';
    this.showDeleteModal = true;
  }

  closeDeleteModal(): void {
    if (this.deleting) return;
    this.showDeleteModal = false;
  }

  deleteAccount(): void {
    if (!this.deleteConfirmed || this.deleting) return;
    this.deleting = true;
    this.deleteError = '';

    this.authService.deleteAccount(this.deleteConfirmation.trim()).subscribe({
      next: () => {
        this.deleting = false;
        this.showDeleteModal = false;
        this.router.navigate(['/'], { replaceUrl: true });
      },
      error: (err) => {
        this.deleting = false;
        this.deleteError = err.error?.message || 'No se pudo borrar la cuenta. Inténtalo de nuevo.';
        this.cdr.markForCheck();
      },
    });
  }
}
