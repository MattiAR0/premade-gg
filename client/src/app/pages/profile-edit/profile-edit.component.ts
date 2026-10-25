import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import {
  User, VALORANT_AGENTS, VALORANT_ROLES,
  DAYS_OF_WEEK, DAYS_LABELS, DAY_SLOTS, DAY_SLOT_LABELS, DaySlot, Availability, normalizeAvailability,
} from '../../models/user.model';
import { LabelPipe } from '../../shared/pipes/label.pipe';

/** Avatares predefinidos basados en agentes de Valorant */
const PRESET_AVATARS = [
  { name: 'Brimstone', url: 'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/displayicon.png' },
  { name: 'Phoenix', url: 'https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/displayicon.png' },
  { name: 'Sage', url: 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png' },
  { name: 'Sova', url: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png' },
  { name: 'Viper', url: 'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/displayicon.png' },
  { name: 'Cypher', url: 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png' },
  { name: 'Reyna', url: 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png' },
  { name: 'Killjoy', url: 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png' },
  { name: 'Breach', url: 'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png' },
  { name: 'Omen', url: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png' },
  { name: 'Jett', url: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png' },
  { name: 'Raze', url: 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png' },
  { name: 'Skye', url: 'https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/displayicon.png' },
  { name: 'Yoru', url: 'https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png' },
  { name: 'Astra', url: 'https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/displayicon.png' },
  { name: 'KAY/O', url: 'https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/displayicon.png' },
  { name: 'Chamber', url: 'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/displayicon.png' },
  { name: 'Neon', url: 'https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/displayicon.png' },
  { name: 'Fade', url: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png' },
  { name: 'Harbor', url: 'https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/displayicon.png' },
  { name: 'Gekko', url: 'https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/displayicon.png' },
  { name: 'Deadlock', url: 'https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/displayicon.png' },
  { name: 'Iso', url: 'https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/displayicon.png' },
  { name: 'Clove', url: 'https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/displayicon.png' },
  { name: 'Vyse', url: 'https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/displayicon.png' },
  { name: 'Tejo', url: 'https://media.valorant-api.com/agents/b444168c-4e35-8076-db47-ef9bf368f384/displayicon.png' },
  { name: 'Waylay', url: 'https://media.valorant-api.com/agents/df1cb487-4902-002e-5c17-d28e83e78588/displayicon.png' },
  { name: 'Veto', url: 'https://media.valorant-api.com/agents/92eeef5d-43b5-1d4a-8d03-b3927a09034b/displayicon.png' },
];

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
  readonly agents = VALORANT_AGENTS;
  readonly roles = VALORANT_ROLES;
  readonly daysOfWeek = DAYS_OF_WEEK;
  readonly daysLabels = DAYS_LABELS;
  readonly daySlots = DAY_SLOTS;
  readonly daySlotLabels = DAY_SLOT_LABELS;
  readonly presetAvatars = PRESET_AVATARS;
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
    this.loadFromUser(user);
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
