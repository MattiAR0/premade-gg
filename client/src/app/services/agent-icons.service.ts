import { Injectable, signal } from '@angular/core';

const AGENTS_URL = 'https://valorant-api.com/v1/agents?isPlayableCharacter=true';
const CACHE_KEY = 'premadegg:agent-icons:v1';

/**
 * Iconos de agentes desde valorant-api.com (API comunitaria con los assets del juego).
 * Se piden una vez por sesión y se cachean en localStorage; si falla, la UI cae al texto.
 */
@Injectable({ providedIn: 'root' })
export class AgentIconsService {
  /** nombre del agente en minúsculas → URL del icono */
  readonly icons = signal<Record<string, string>>(this.readCache());
  private requested = false;

  load(): void {
    if (this.requested || Object.keys(this.icons()).length) return;
    this.requested = true;

    fetch(AGENTS_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { data?: { displayName: string; displayIcon: string }[] }) => {
        const map: Record<string, string> = {};
        for (const agent of body.data ?? []) {
          map[this.key(agent.displayName)] = agent.displayIcon;
        }
        this.icons.set(map);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(map));
        } catch {
          /* almacenamiento no disponible: solo se pierde la caché */
        }
      })
      .catch(() => {
        this.requested = false;
      });
  }

  iconFor(name: string): string | null {
    return this.icons()[this.key(name)] ?? null;
  }

  private key(name: string): string {
    return name.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private readCache(): Record<string, string> {
    try {
      return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}');
    } catch {
      return {};
    }
  }
}
