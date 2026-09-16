-- Parallel page loads before the day-cookie lands can log the same visit several times: keep one per user, day, event, device and address.
alter table public.access_logs add column if not exists day date generated always as ((created_at at time zone 'utc')::date) stored;
delete from public.access_logs a using public.access_logs b
  where a.user_id = b.user_id and a.event = b.event and a.day = b.day
    and coalesce(a.ip,'') = coalesce(b.ip,'') and coalesce(a.device_os,'') = coalesce(b.device_os,'') and coalesce(a.device_browser,'') = coalesce(b.device_browser,'')
    and a.ctid > b.ctid;
create unique index if not exists access_logs_once_per_day_idx on public.access_logs (user_id, day, event, coalesce(ip,''), coalesce(device_os,''), coalesce(device_browser,''));
