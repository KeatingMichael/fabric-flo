-- Add size column for existing deployments (included in 002 for fresh installs).

alter table public.inventory_items add column if not exists size text;
