-- Preserva autoria e classificação do plano de ação ao editar seu status.
create or replace function public.primor_action_plan_audit()
returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if new.created_by is distinct from old.created_by
    or new.created_at is distinct from old.created_at
    or new.department is distinct from old.department
  then
    raise exception 'Autoria, data de criação e departamento não podem ser alterados';
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists store_action_plans_audit_trg on public.store_action_plans;
create trigger store_action_plans_audit_trg
before update on public.store_action_plans
for each row execute function public.primor_action_plan_audit();
revoke execute on function public.primor_action_plan_audit() from public, anon;
