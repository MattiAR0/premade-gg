import { Component, OnInit, ChangeDetectorRef, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { AgentIconsService, AgentInfo } from '../../services/agent-icons.service';
import {
  User, VALORANT_ROLES,
  DAYS_OF_WEEK, DAYS_LABELS, DAY_SLOTS, DAY_SLOT_LABELS, DaySlot, Availability, normalizeAvailability,
} from '../../models/user.model';
import { LabelPipe } from '../../shared/pipes/label.pipe';

@Component({
  selector: 'app-profile-edit',
  standalone: true,
  imports: [FormsModule, RouterLink, LabelPipe],
  templateUrl: './profile-edit.component.html',
  styleUrl: './profile-edit.component.scss',
})
export class ProfileEditComponent implements OnInit {
  // Profile data
  bio = '';
  profileImageType: 'upload' | 'avatar' | 'riot_card' = 'riot_card';
  profileImage: string | null = null;
  favoriteAgents: string[] = [];
  favoriteRole = '';
  schedule = '';
  socialLinks = { discord: '', twitter: '', twitch: '' };
  availability: Availability = {};
  lookingForTeam = false;
  lftDetails = '';
  isCoach = false;
  coachDetails = '';

  // UI state
  saving = false;
  saved = false;
  errorMessage = '';
  uploadingAvatar = false;
  selectedFile: File | null = null;
  previewUrl: string | null = null;

  // Constants
  readonly roles = VALORANT_ROLES;
  readonly daysOfWeek = DAYS_OF_WEEK;
  readonly daysLabels = DAYS_LABELS;
  readonly daySlots = DAY_SLOTS;
  readonly daySlotLabels = DAY_SLOT_LABELS;
  /** Roles de agente para filtrar avatares y favoritos (Flex no es un rol de agente) */
  readonly agentRoles = ['Duelist', 'Controller', 'Initiator', 'Sentinel'] as const;
  readonly agentCatalog = inject(AgentIconsService);

  // Filtros del selector de avatar y de favoritos
  avatarRole = '';
  avatarQuery = '';
  favoriteFilterRole = '';
  readonly schedules = ['Weekends', 'Evenings', 'Late Night', 'Mornings', 'Flexible'];

  constructor(
    readonly authService: AuthService,
    private readonly router: Router,
    private readonly cdr: ChangeDetectorRef,
  ) { }

  ngOnInit(): void {
    const user = this.authService.currentUser();
    if (!user) {
      this.router.navigate(['/login']);
      return;
    }
    this.agentCatalog.load();
    this.loadFromUser(user);
  }

  /** Agentes del selector de avatar según rol y búsqueda */
  get avatarAgents(): AgentInfo[] {
    return this.filterAgents(this.avatarRole, this.avatarQuery);
  }

  /** Agentes de la lista de favoritos según rol */
  get favoriteCandidates(): AgentInfo[] {
    return this.filterAgents(this.favoriteFilterRole, '');
  }

  private filterAgents(role: string, query: string): AgentInfo[] {
    const q = query.trim().toLowerCase();
    return this.agentCatalog
      .agents()
      .filter((a) => (!role || a.role === role) && (!q || a.name.toLowerCase().includes(q)));
  }

  private loadFromUser(user: User): void {
    this.bio = user.bio || '';
    this.profileImageType = user.profileImageType || 'riot_card';
    this.profileImage = user.profileImage;
    this.favoriteAgents = [...(user.favoriteAgents || [])];
    this.favoriteRole = user.favoriteRole || '';
    this.schedule = user.schedule || '';
    this.socialLinks = {
      discord: user.socialLinks?.discord || '',
      twitter: user.socialLinks?.twitter || '',
      twitch: user.socialLinks?.twitch || '',
    };
    this.lookingForTeam = user.lookingForTeam || false;
    this.lftDetails = user.lftDetails || '';
    this.isCoach = user.isCoach || false;
    this.coachDetails = user.coachDetails || '';

    this.availability = normalizeAvailability(user.availability);
  }

  hasSlot(day: string, slot: DaySlot): boolean {
    return this.availability[day]?.includes(slot) ?? false;
  }

  /** Marca o desmarca una franja; un día sin franjas deja de estar disponible */
  toggleSlot(day: string, slot: DaySlot): void {
    const current = this.availability[day] ?? [];
    const next = current.includes(slot) ? current.filter((s) => s !== slot) : [...current, slot];
    const ordered = this.daySlots.filter((s) => next.includes(s));
    const updated: Availability = { ...this.availability };
    if (ordered.length) {
      updated[day] = ordered;
    } else {
      delete updated[day];
    }
    this.availability = updated;
  }

  /** Toggle un agente en favoritos (max 3) */
  toggleAgent(agent: string): void {
    const idx = this.favoriteAgents.indexOf(agent);
    if (idx >= 0) {
      this.favoriteAgents.splice(idx, 1);
    } else if (this.favoriteAgents.length < 3) {
      this.favoriteAgents.push(agent);
      this.favoriteAgents.sort((a, b) => a.localeCompare(b));
    }
  }

  isAgentSelected(agent: string): boolean {
    return this.favoriteAgents.includes(agent);
  }

  /** Seleccionar un avatar predefinido */
  selectPresetAvatar(url: string): void {
    this.profileImageType = 'avatar';
    this.profileImage = url;
    this.previewUrl = url;
  }

  /** Usar la card de Valorant */
  useRiotCard(): void {
    this.profileImageType = 'riot_card';
    this.profileImage = null;
    this.previewUrl = this.authService.currentUser()?.cardImage || null;
  }

  /** Manejar selección de archivo */
  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files?.length) return;

    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.errorMessage = 'La imagen no puede superar 2MB';
      return;
    }

    this.selectedFile = file;
    this.profileImageType = 'upload';

    // Preview local
    const reader = new FileReader();
    reader.onload = (e) => {
      this.previewUrl = e.target?.result as string;
      this.cdr.markForCheck();
    };
    reader.readAsDataURL(file);
  }

  /** Obtener la URL de preview actual */
  get currentPreview(): string | null {
    if (this.previewUrl) return this.previewUrl;
    if (this.profileImageType === 'riot_card') {
      return this.authService.currentUser()?.cardImage || null;
    }
    return this.profileImage;
  }

  /** Guardar perfil */
  save(): void {
    this.saving = true;
    this.saved = false;
    this.errorMessage = '';

    const doSave = (imageUrl?: string) => {
      const data: Partial<User> = {
        bio: this.bio,
        profileImageType: this.profileImageType,
        profileImage: imageUrl || this.profileImage,
        favoriteAgents: this.favoriteAgents,
        favoriteRole: this.favoriteRole || null,
        schedule: this.schedule,
        socialLinks: this.socialLinks,
        availability: this.availability,
        lookingForTeam: this.lookingForTeam,
        lftDetails: this.lftDetails,
        isCoach: this.isCoach,
        coachDetails: this.coachDetails,
      };

      this.authService.updateProfile(data).subscribe({
        next: () => {
          this.saving = false;
          this.saved = true;
          this.selectedFile = null;
          this.cdr.markForCheck();
          window.scrollTo({ top: 0, behavior: 'smooth' });
          setTimeout(() => { this.saved = false; this.cdr.markForCheck(); }, 3000);
        },
        error: (err) => {
          this.saving = false;
          this.errorMessage = err.error?.message || 'Error al guardar el perfil';
          this.cdr.markForCheck();
        },
      });
    };

    // Si hay un archivo seleccionado, subirlo primero
    if (this.selectedFile && this.profileImageType === 'upload') {
      this.uploadingAvatar = true;
      this.authService.uploadAvatar(this.selectedFile).subscribe({
        next: (res) => {
          this.uploadingAvatar = false;
          this.cdr.markForCheck();
          doSave(res.url);
        },
        error: (err) => {
          this.uploadingAvatar = false;
          this.saving = false;
          this.errorMessage = err.error?.message || 'Error al subir la imagen';
          this.cdr.markForCheck();
        },
      });
    } else {
      doSave();
    }
  }
}
