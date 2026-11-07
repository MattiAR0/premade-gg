-- ════════════════════════════════════════════════════════════
-- Tipos para denuncias y moderación (fase 3).
-- Van en su propia migración: un valor nuevo de un enum no se
-- puede usar en la misma transacción en la que se añade.
-- ════════════════════════════════════════════════════════════

create type public.report_target as enum ('profile', 'review', 'message', 'team', 'lfg_post');

create type public.report_reason as enum (
  'harassment',     -- acoso o insultos
  'hate',           -- odio o discriminación
  'cheating',       -- trampas en Valorant
  'impersonation',  -- suplantación (Riot ID de otra persona)
  'fake_review',    -- valoración falsa o de alguien que no jugó contigo
  'spam',           -- spam o publicidad
  'personal_data',  -- publica datos personales de otra persona
  'sexual',         -- contenido sexual
  'other'
);

create type public.report_status as enum ('open', 'actioned', 'dismissed');
create type public.appeal_status as enum ('pending', 'upheld', 'reversed');

-- Notificaciones de moderación
alter type public.notification_type add value if not exists 'report_update';     -- al denunciante (y a los moderadores, denuncia nueva)
alter type public.notification_type add value if not exists 'moderation_notice'; -- al denunciado: decisión motivada y recurso
alter type public.notification_type add value if not exists 'appeal_update';     -- al denunciado: resultado del recurso
