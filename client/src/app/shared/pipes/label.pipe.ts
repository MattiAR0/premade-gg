import { Pipe, PipeTransform } from '@angular/core';

/**
 * Traduce al español los valores internos que se guardan en inglés (rango, rol, horario).
 * Los valores de la base de datos no cambian: solo lo que se muestra.
 * Uso: {{ user.rank | label: 'rank' }}
 */
const LABELS = {
  rank: {
    unranked: 'Sin rango',
    iron: 'Hierro',
    bronze: 'Bronce',
    silver: 'Plata',
    gold: 'Oro',
    platinum: 'Platino',
    diamond: 'Diamante',
    ascendant: 'Ascendente',
    immortal: 'Inmortal',
    radiant: 'Radiante',
  },
  role: {
    duelist: 'Duelista',
    controller: 'Controlador',
    initiator: 'Iniciador',
    sentinel: 'Centinela',
    flex: 'Flex',
  },
  schedule: {
    weekends: 'Fines de semana',
    evenings: 'Tardes',
    'late night': 'Noches',
    mornings: 'Mañanas',
    flexible: 'Flexible',
  },
} as const;

export type LabelKind = keyof typeof LABELS;

export function translateLabel(value: string | null | undefined, kind: LabelKind): string {
  if (!value) return '';
  const map = LABELS[kind] as Record<string, string>;

  if (kind === 'rank') {
    // "Gold 2" → "Oro 2"
    const [tier, ...rest] = value.trim().split(/\s+/);
    const name = map[tier.toLowerCase()];
    return name ? [name, ...rest].join(' ') : value;
  }
  return map[value.trim().toLowerCase()] ?? value;
}

@Pipe({ name: 'label', standalone: true })
export class LabelPipe implements PipeTransform {
  transform(value: string | null | undefined, kind: LabelKind): string {
    return translateLabel(value, kind);
  }
}
