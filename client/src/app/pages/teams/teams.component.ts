import { Component, OnInit, OnDestroy, AfterViewInit, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { TeamCardComponent } from '../../shared/team-card/team-card.component';
import { Team } from '../../models/team.model';
import { User } from '../../models/user.model';
import { Subject, debounceTime, distinctUntilChanged, switchMap } from 'rxjs';

@Component({
  selector: 'app-teams',
  standalone: true,
  imports: [FormsModule, TeamCardComponent],
  templateUrl: './teams.component.html',
  styleUrl: './teams.component.scss',
})
export class TeamsComponent implements OnInit, AfterViewInit, OnDestroy {
  teams: Team[] = [];
  initialLoading = true;
  loadingMore = false;
  errorMessage = '';

  private nextCursor: string | null = null;
  totalTeams = 0;
  readonly pageSize = 12;

  // Filtros
  filterRegion = '';
  filterRank = '';
  filterRecruiting = false;
  searchQuery = '';

  readonly regions = ['eu', 'na', 'ap', 'kr'];
  readonly regionLabels: Record<string, string> = {
    eu: 'Europa', na: 'Norteamérica', ap: 'Asia Pacífico', kr: 'Corea',
  };
  readonly ranks = [
    'Iron', 'Bronze', 'Silver', 'Gold', 'Platinum',
    'Diamond', 'Ascendant', 'Immortal', 'Radiant',
  ];

  // ── Crear equipo ──────────────────────────────────────
  showCreateModal = false;
  creatingTeam = false;
  createError = '';
  newTeam = {
    name: '',
    tag: '',
    description: '',
    region: 'eu',
    targetRank: 'Gold',
    recruiting: false,
  };

  // Búsqueda de usuarios iniciales
  memberSearchQuery = '';
  memberSearchResults: User[] = [];
  selectedInitialMembers: User[] = [];
  private readonly searchSubject = new Subject<string>();

  @ViewChild('scrollSentinel') scrollSentinel!: ElementRef<HTMLDivElement>;
  private observer: IntersectionObserver | null = null;

  constructor(
    private readonly api: ApiService,
    private readonly cdr: ChangeDetectorRef,
    private readonly router: Router,
    readonly auth: AuthService,
  ) {
    this.searchSubject.pipe(
      debounceTime(300),
      distinctUntilChanged(),
      switchMap(query => {
        if (!query.trim()) {
          return [[]]; // empty array as observable
        }
        return this.api.searchUsers(query);
      })
    ).subscribe(results => {
      const myId = this.auth.currentUser()?._id;
      this.memberSearchResults = results.filter(u =>
        u._id !== myId && !this.selectedInitialMembers.some(sm => sm._id === u._id)
      );
      this.cdr.markForCheck();
    });
  }

  ngOnInit(): void {
    this.loadTeams();
  }

  ngAfterViewInit(): void {
    this.setupIntersectionObserver();
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }

  loadTeams(): void {
    this.initialLoading = true;
    this.errorMessage = '';
    this.teams = [];
    this.nextCursor = null;
    this.fetchPage();
  }

  private loadMore(): void {
    if (this.loadingMore || !this.nextCursor) return;
    this.loadingMore = true;
    this.fetchPage();
  }

  private fetchPage(): void {
    const filters: Record<string, string | number | boolean> = {
      limit: this.pageSize,
    };
    if (this.nextCursor) filters['cursor'] = this.nextCursor;
    if (this.filterRegion) filters['region'] = this.filterRegion;
    if (this.filterRank) filters['targetRank'] = this.filterRank;
    if (this.filterRecruiting) filters['recruiting'] = true;
    if (this.searchQuery.trim()) filters['search'] = this.searchQuery.trim();

    this.api.getTeams(filters).subscribe({
      next: (res) => {
        this.teams = [...this.teams, ...res.data];
        if (res.total >= 0) this.totalTeams = res.total;
        this.nextCursor = res.nextCursor;
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
        this.checkAutoFill();
      },
      error: (err) => {
        this.errorMessage = 'Error al cargar los equipos.';
        console.error('Error loading teams:', err);
        this.initialLoading = false;
        this.loadingMore = false;
        this.cdr.markForCheck();
      },
    });
  }

  private setupIntersectionObserver(): void {
    this.observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !this.initialLoading) {
          this.loadMore();
          this.cdr.markForCheck();
        }
      },
      { rootMargin: '200px' },
    );
    if (this.scrollSentinel) {
      this.observer.observe(this.scrollSentinel.nativeElement);
    }
  }

  private checkAutoFill(): void {
    if (!this.scrollSentinel || !this.nextCursor) return;
    setTimeout(() => {
      const rect = this.scrollSentinel.nativeElement.getBoundingClientRect();
      const inViewport = rect.top < window.innerHeight + 200;
      if (inViewport) this.loadMore();
    });
  }

  get hasMore(): boolean {
    return this.nextCursor !== null;
  }

  clearFilters(): void {
    this.filterRegion = '';
    this.filterRank = '';
    this.filterRecruiting = false;
    this.searchQuery = '';
    this.loadTeams();
  }

  // ── Create team modal ─────────────────────────────────
  openCreateModal(): void {
    this.showCreateModal = true;
    this.createError = '';
    this.memberSearchQuery = '';
    this.memberSearchResults = [];
    this.selectedInitialMembers = [];
    this.newTeam = {
      name: '',
      tag: '',
      description: '',
      region: 'eu',
      targetRank: 'Gold',
      recruiting: false,
    };
  }

  closeCreateModal(): void {
    this.showCreateModal = false;
  }

  onMemberSearchChange(query: string): void {
    this.memberSearchQuery = query;
    this.searchSubject.next(query);
  }

  selectInitialMember(user: User): void {
    if (this.selectedInitialMembers.length >= 9) {
      return; // Max 9 additional members limits
    }
    if (!this.selectedInitialMembers.some(u => u._id === user._id)) {
      this.selectedInitialMembers.push(user);
    }
    this.memberSearchQuery = '';
    this.memberSearchResults = [];
    this.searchSubject.next('');
  }

  removeInitialMember(user: User): void {
    this.selectedInitialMembers = this.selectedInitialMembers.filter(u => u._id !== user._id);
  }

  submitNewTeam(): void {
    if (!this.newTeam.name.trim()) {
      this.createError = 'El nombre del equipo es obligatorio.';
      return;
    }
    if (!this.newTeam.tag.trim()) {
      this.createError = 'El tag del equipo es obligatorio.';
      return;
    }
    this.creatingTeam = true;
    this.createError = '';

    const payload: Record<string, unknown> = {
      name: this.newTeam.name.trim(),
      tag: this.newTeam.tag.trim().toUpperCase(),
      region: this.newTeam.region,
      targetRank: this.newTeam.targetRank,
      recruiting: this.newTeam.recruiting,
    };
    if (this.newTeam.description.trim()) {
      payload['description'] = this.newTeam.description.trim();
    }
    if (this.selectedInitialMembers.length > 0) {
      payload['initialPlayers'] = this.selectedInitialMembers.map(u => u._id);
    }

    this.api.createTeam(payload as any).subscribe({
      next: (team) => {
        this.creatingTeam = false;
        this.showCreateModal = false;
        this.cdr.markForCheck();
        this.router.navigate(['/teams', team._id]);
      },
      error: (err) => {
        this.creatingTeam = false;
        this.createError = err.error?.message || 'Error al crear el equipo.';
        this.cdr.markForCheck();
      },
    });
  }
}
