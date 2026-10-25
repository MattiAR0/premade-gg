-- ════════════════════════════════════════════════════════════
-- PremadeGG · Triggers y tareas programadas
-- ════════════════════════════════════════════════════════════

-- ── Alta de usuario → fila en profiles ───────────────────────
-- Email, Google o Discord: todos empiezan con onboarded = false hasta vincular su Riot ID.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Reputación → recalcula karma del objetivo ────────────────
-- Media de ratings redondeada a 1 decimal; 5 si no tiene reviews.
create function public.recalculate_karma()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target uuid := coalesce(new.target_id, old.target_id);
begin
  update public.profiles p
  set karma = coalesce((
    select round(avg(r.rating), 1) from public.reputations r where r.target_id = v_target
  ), 5)
  where p.id = v_target;

  if tg_op = 'UPDATE' and old.target_id <> new.target_id then
    update public.profiles p
    set karma = coalesce((
      select round(avg(r.rating), 1) from public.reputations r where r.target_id = old.target_id
    ), 5)
    where p.id = old.target_id;
  end if;

  return null;
end;
$$;

create trigger on_reputation_change
  after insert or update or delete on public.reputations
  for each row execute function public.recalculate_karma();

-- ── Notificación nueva → evento Realtime ─────────────────────
create function public.broadcast_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.emit_to_user(new.recipient_id, 'notification:new', public.notification_json(new));
  return null;
end;
$$;

create trigger on_notification_created
  after insert on public.notifications
  for each row execute function public.broadcast_notification();

-- ── Limpieza periódica (sustituye a los índices TTL de Mongo) ─
--   · Posts LFG: 24 h · Notificaciones: 30 días · Mensajes: 90 días
create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule(
  'premadegg-cleanup',
  '*/15 * * * *',
  $$
    delete from public.lfg_posts where expires_at < now();
    delete from public.notifications where expires_at < now();
    delete from public.messages where created_at < now() - interval '90 days';
  $$
);
