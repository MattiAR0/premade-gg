-- ════════════════════════════════════════════════════════════
-- Tipos para las invitaciones (fase 2 anti-abuso).
-- Van en su propia migración: un valor nuevo de un enum no se
-- puede usar en la misma transacción en la que se añade.
-- ════════════════════════════════════════════════════════════

-- Miembro de un grupo LFG añadido por el creador que aún no ha aceptado.
-- No cuenta como miembro ni como "habéis jugado juntos" hasta que acepta.
alter type public.member_status add value if not exists 'invited';

-- Notificaciones de invitación (con botones Aceptar / Rechazar en la campana)
alter type public.notification_type add value if not exists 'lfg_invite';
alter type public.notification_type add value if not exists 'team_invite';
