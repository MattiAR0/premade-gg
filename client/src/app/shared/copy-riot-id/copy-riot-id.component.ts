import { Component, Input, OnDestroy, computed, signal } from '@angular/core';

type CopyState = 'idle' | 'copied' | 'error';

/**
 * Copia el Riot ID (Nombre#TAG) al portapapeles para agregar al jugador en el juego.
 * Riot no tiene API de amigos, así que esto es lo más cerca que se puede llegar.
 */
@Component({
  selector: 'app-copy-riot-id',
  standalone: true,
  templateUrl: './copy-riot-id.component.html',
  styleUrl: './copy-riot-id.component.scss',
})
export class CopyRiotIdComponent implements OnDestroy {
  @Input({ required: true }) riotId!: string;
  /** button: botón con texto (perfil) · icon: solo icono (tarjetas y filas) */
  @Input() variant: 'button' | 'icon' = 'button';

  readonly state = signal<CopyState>('idle');

  /** Texto del aviso (visible y para lectores de pantalla) */
  readonly message = computed(() => {
    switch (this.state()) {
      case 'copied': return 'Riot ID copiado';
      case 'error': return 'No se pudo copiar';
      default: return '';
    }
  });

  private resetTimer?: ReturnType<typeof setTimeout>;

  async copy(event: Event): Promise<void> {
    // En las tarjetas el botón está dentro de un enlace a todo el bloque
    event.stopPropagation();
    event.preventDefault();

    const trigger = event.currentTarget as HTMLElement | null;
    const ok = await this.writeToClipboard(this.riotId);
    trigger?.focus();

    this.state.set(ok ? 'copied' : 'error');
    clearTimeout(this.resetTimer);
    this.resetTimer = setTimeout(() => this.state.set('idle'), ok ? 2500 : 6000);
  }

  ngOnDestroy(): void {
    clearTimeout(this.resetTimer);
  }

  private async writeToClipboard(text: string): Promise<boolean> {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        return true;
      }
    } catch {
      // Sin permiso o fuera de un contexto seguro (http en la red local): se prueba el método antiguo
    }
    return this.legacyCopy(text);
  }

  /** Respaldo para navegadores sin Clipboard API: textarea oculto + execCommand */
  private legacyCopy(text: string): boolean {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '0';
    textarea.style.left = '0';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();

    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    textarea.remove();
    return ok;
  }
}
