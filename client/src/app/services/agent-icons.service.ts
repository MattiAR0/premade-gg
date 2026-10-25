import { Injectable, computed, signal } from '@angular/core';

const AGENTS_URL = 'https://valorant-api.com/v1/agents?isPlayableCharacter=true';
const CACHE_KEY = 'premadegg:agents:v2';

/** Agente jugable: nombre del juego (en inglés), icono y rol (Duelist, Controller…) */
export interface AgentInfo {
  name: string;
  role: string | null;
  icon: string;
}

/**
 * Respaldo si valorant-api.com no responde y no hay caché: los 29 agentes a 2026-10-25.
 * Los agentes nuevos llegan solos desde la API; esta lista solo evita una pantalla vacía.
 */
const FALLBACK_AGENTS: AgentInfo[] = [
  { name: 'Astra', role: 'Controller', icon: 'https://media.valorant-api.com/agents/41fb69c1-4189-7b37-f117-bcaf1e96f1bf/displayicon.png' },
  { name: 'Breach', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/5f8d3a7f-467b-97f3-062c-13acf203c006/displayicon.png' },
  { name: 'Brimstone', role: 'Controller', icon: 'https://media.valorant-api.com/agents/9f0d8ba9-4140-b941-57d3-a7ad57c6b417/displayicon.png' },
  { name: 'Chamber', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/22697a3d-45bf-8dd7-4fec-84a9e28c69d7/displayicon.png' },
  { name: 'Clove', role: 'Controller', icon: 'https://media.valorant-api.com/agents/1dbf2edd-4729-0984-3115-daa5eed44993/displayicon.png' },
  { name: 'Cypher', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/117ed9e3-49f3-6512-3ccf-0cada7e3823b/displayicon.png' },
  { name: 'Deadlock', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/cc8b64c8-4b25-4ff9-6e7f-37b4da43d235/displayicon.png' },
  { name: 'Fade', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/dade69b4-4f5a-8528-247b-219e5a1facd6/displayicon.png' },
  { name: 'Gekko', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/e370fa57-4757-3604-3648-499e1f642d3f/displayicon.png' },
  { name: 'Harbor', role: 'Controller', icon: 'https://media.valorant-api.com/agents/95b78ed7-4637-86d9-7e41-71ba8c293152/displayicon.png' },
  { name: 'Iso', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/0e38b510-41a8-5780-5e8f-568b2a4f2d6c/displayicon.png' },
  { name: 'Jett', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/add6443a-41bd-e414-f6ad-e58d267f4e95/displayicon.png' },
  { name: 'KAY/O', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/601dbbe7-43ce-be57-2a40-4abd24953621/displayicon.png' },
  { name: 'Killjoy', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/1e58de9c-4950-5125-93e9-a0aee9f98746/displayicon.png' },
  { name: 'Miks', role: 'Controller', icon: 'https://media.valorant-api.com/agents/7c8a4701-4de6-9355-b254-e09bc2a34b72/displayicon.png' },
  { name: 'Neon', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/bb2a4828-46eb-8cd1-e765-15848195d751/displayicon.png' },
  { name: 'Omen', role: 'Controller', icon: 'https://media.valorant-api.com/agents/8e253930-4c05-31dd-1b6c-968525494517/displayicon.png' },
  { name: 'Phoenix', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/eb93336a-449b-9c1b-0a54-a891f7921d69/displayicon.png' },
  { name: 'Raze', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/f94c3b30-42be-e959-889c-5aa313dba261/displayicon.png' },
  { name: 'Reyna', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/a3bfb853-43b2-7238-a4f1-ad90e9e46bcc/displayicon.png' },
  { name: 'Sage', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/569fdd95-4d10-43ab-ca70-79becc718b46/displayicon.png' },
  { name: 'Skye', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/6f2a04ca-43e0-be17-7f36-b3908627744d/displayicon.png' },
  { name: 'Sova', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/320b2a48-4d9b-a075-30f1-1f93a9b638fa/displayicon.png' },
  { name: 'Tejo', role: 'Initiator', icon: 'https://media.valorant-api.com/agents/b444168c-4e35-8076-db47-ef9bf368f384/displayicon.png' },
  { name: 'Veto', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/92eeef5d-43b5-1d4a-8d03-b3927a09034b/displayicon.png' },
  { name: 'Viper', role: 'Controller', icon: 'https://media.valorant-api.com/agents/707eab51-4836-f488-046a-cda6bf494859/displayicon.png' },
  { name: 'Vyse', role: 'Sentinel', icon: 'https://media.valorant-api.com/agents/efba5359-4016-a1e5-7626-b1ae76895940/displayicon.png' },
  { name: 'Waylay', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/df1cb487-4902-002e-5c17-d28e83e78588/displayicon.png' },
  { name: 'Yoru', role: 'Duelist', icon: 'https://media.valorant-api.com/agents/7f94d92c-4234-0a36-9646-3a87eb8b5c89/displayicon.png' },
];

/**
 * Catálogo de agentes desde valorant-api.com (API comunitaria con los assets del juego).
 * Se pide una vez por sesión y se cachea en localStorage; si falla, se usa la lista de respaldo.
 * De aquí salen los avatares de perfil, los agentes favoritos y sus iconos.
 */
@Injectable({ providedIn: 'root' })
export class AgentIconsService {
  /** Agentes jugables por orden alfabético */
  readonly agents = signal<AgentInfo[]>(this.readCache() ?? FALLBACK_AGENTS);
  /** nombre del agente normalizado → URL del icono */
  readonly icons = computed(() => {
    const map: Record<string, string> = {};
    for (const agent of this.agents()) map[this.key(agent.name)] = agent.icon;
    return map;
  });
  private requested = false;

  load(): void {
    if (this.requested) return;
    this.requested = true;

    fetch(AGENTS_URL)
      .then((res) => (res.ok ? res.json() : Promise.reject(res.status)))
      .then((body: { data?: { displayName: string; displayIcon: string; role?: { displayName: string } | null }[] }) => {
        const agents = (body.data ?? [])
          .filter((a) => a.displayName && a.displayIcon)
          .map((a) => ({ name: a.displayName, role: a.role?.displayName ?? null, icon: a.displayIcon }))
          .sort((a, b) => a.name.localeCompare(b.name));
        if (!agents.length) return;
        this.agents.set(agents);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(agents));
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

  private readCache(): AgentInfo[] | null {
    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) ?? 'null');
      return Array.isArray(cached) && cached.length ? cached : null;
    } catch {
      return null;
    }
  }
}
