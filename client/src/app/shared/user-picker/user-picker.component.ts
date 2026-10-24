import { Component, EventEmitter, Input, Output, ChangeDetectorRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Subject, catchError, debounceTime, distinctUntilChanged, of, switchMap, tap } from 'rxjs';
import { ApiService } from '../../services/api.service';
import { AuthService } from '../../services/auth.service';
import { User } from '../../models/user.model';
import { LabelPipe } from '../pipes/label.pipe';

/**
 * Buscador de jugadores con autocompletado y chips de seleccionados.
 * Se usa al crear grupos LFG y equipos para añadir miembros iniciales.
 */
@Component({
  selector: 'app-user-picker',
  standalone: true,
  imports: [FormsModule, LabelPipe],
  templateUrl: './user-picker.component.html',
  styleUrl: './user-picker.component.scss',
})
export class UserPickerComponent {
  @Input() selected: User[] = [];
  @Output() selectedChange = new EventEmitter<User[]>();
  @Input() max = 9;
  @Input() placeholder = 'Buscar jugador por Riot ID...';

  query = '';
  results: User[] = [];
  searching = false;

  private readonly search$ = new Subject<string>();

  constructor(
    private readonly api: ApiService,
    private readonly auth: AuthService,
    private readonly cdr: ChangeDetectorRef,
  ) {
    this.search$
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        tap((q) => (this.searching = q.trim().length >= 2)),
        switchMap((q) =>
          q.trim().length < 2 ? of([]) : this.api.searchUsers(q.trim()).pipe(catchError(() => of([]))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((users) => {
        const myId = this.auth.currentUser()?._id;
        const selectedIds = new Set(this.selected.map((u) => u._id));
        this.results = users.filter((u) => u._id !== myId && !selectedIds.has(u._id));
        this.searching = false;
        this.cdr.markForCheck();
      });
  }

  get isFull(): boolean {
    return this.selected.length >= this.max;
  }

  onInput(): void {
    this.search$.next(this.query);
  }

  add(user: User): void {
    if (this.isFull) return;
    this.selectedChange.emit([...this.selected, user]);
    this.query = '';
    this.results = [];
    this.search$.next('');
  }

  remove(user: User): void {
    this.selectedChange.emit(this.selected.filter((u) => u._id !== user._id));
  }

  avatarOf(user: User): string | null {
    return user.profileImage || user.cardImage || null;
  }
}
