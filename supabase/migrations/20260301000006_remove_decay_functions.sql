-- Remove unused decay functions (handled in app code for env-configurable decay)

drop function if exists apply_memory_decay(uuid);
drop function if exists calculate_memory_decay(uuid);
