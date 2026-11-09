-- Tipos de notificación de la verificación del Riot ID (ver 20261109000002_verificacion_riot_id.sql).
-- Van aparte porque un valor nuevo de un enum no se puede usar en la misma transacción.

-- Quien pierde un Riot ID sin verificar porque otra cuenta ha demostrado que es suyo
alter type public.notification_type add value if not exists 'riot_id_claimed';
-- Quien vincula un Riot ID y recupera el karma o la suspensión de una cuenta borrada
alter type public.notification_type add value if not exists 'riot_history_restored';
