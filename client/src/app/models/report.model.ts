import { User } from './user.model';

export type ReportTarget = 'profile' | 'review' | 'message' | 'team' | 'lfg_post';

export type ReportReason =
  | 'harassment'
  | 'hate'
  | 'cheating'
  | 'impersonation'
  | 'fake_review'
  | 'spam'
  | 'personal_data'
  | 'sexual'
  | 'other';

/** Motivos en el orden en que se ofrecen, con su texto en la UI */
export const REPORT_REASONS: { value: ReportReason; label: string }[] = [
  { value: 'harassment', label: 'Acoso o insultos' },
  { value: 'hate', label: 'Odio o discriminación' },
  { value: 'fake_review', label: 'Valoración falsa o de alguien que no jugó conmigo' },
  { value: 'impersonation', label: 'Suplanta a otra persona (Riot ID ajeno)' },
  { value: 'cheating', label: 'Trampas en Valorant' },
  { value: 'personal_data', label: 'Publica datos personales de otra persona' },
  { value: 'sexual', label: 'Contenido sexual' },
  { value: 'spam', label: 'Spam o publicidad' },
  { value: 'other', label: 'Otro motivo' },
];

export const REPORT_REASON_LABEL: Record<ReportReason, string> = Object.fromEntries(
  REPORT_REASONS.map((r) => [r.value, r.label]),
) as Record<ReportReason, string>;

export const REPORT_TARGET_LABEL: Record<ReportTarget, string> = {
  profile: 'Perfil',
  review: 'Valoración',
  message: 'Mensaje',
  team: 'Equipo',
  lfg_post: 'Grupo LFG',
};

export type ReportAction = 'none' | 'content_removed' | 'user_suspended' | 'content_removed_user_suspended';

/** Denuncia tal como la ve un moderador */
export interface Report {
  _id: string;
  reporter: User | null;
  targetType: ReportTarget;
  targetId: string;
  targetUser: User | null;
  reason: ReportReason;
  details: string;
  snapshot: string;
  status: 'open' | 'actioned' | 'dismissed';
  action: ReportAction | null;
  resolutionNote: string | null;
  resolvedAt: string | null;
  suspendedUntil: string | null;
  appealText: string | null;
  appealStatus: 'pending' | 'upheld' | 'reversed' | null;
  appealedAt: string | null;
  appealNote: string | null;
  createdAt: string;
}

/** Resumen de una decisión sobre el usuario actual (Ajustes de cuenta) */
export interface MyModerationDecision {
  _id: string;
  actionText: string;
  resolvedAt: string;
  appealStatus: 'pending' | 'upheld' | 'reversed' | null;
  canAppeal: boolean;
}

/** Decisión tal como la ve el afectado */
export interface ModerationDecision {
  _id: string;
  targetType: ReportTarget;
  reason: ReportReason;
  snapshot: string;
  action: ReportAction;
  actionText: string;
  resolutionNote: string;
  resolvedAt: string;
  suspendedUntil: string | null;
  appealStatus: 'pending' | 'upheld' | 'reversed' | null;
  appealText: string | null;
  appealNote: string | null;
  canAppeal: boolean;
}
