update permissions
set
    usage_count = usage_count + 1,
    last_used_at = now(),
    updated_at = now()
where project_id = $1
  and name = $2;
