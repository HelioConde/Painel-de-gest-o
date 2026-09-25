# Configuração de autenticação

## 1. Aplicar a migration

Execute a migration `supabase/migrations/20260925015047_create_profiles_access_control.sql` no projeto Supabase de produção. Ela cria `public.profiles`, ativa RLS e adiciona a função segura `public.current_user_role()`.

## 2. Criar usuários no Supabase Auth

No Dashboard Supabase, em **Authentication > Users**, crie os seguintes e-mails e marque cada um como confirmado:

| Usuário exibido | E-mail interno | Perfil |
| --- | --- | --- |
| gerencia | gerencia@primor.local | gerencia |
| prevencao | prevencao@primor.local | prevencao |
| admin | admin@primor.local | admin |

Defina a senha de cada conta diretamente no Dashboard. Senhas não pertencem a este repositório nem ao frontend.

## 3. Criar perfis

Copie o UUID de cada usuário em Authentication > Users e execute, substituindo os UUIDs:

```sql
insert into public.profiles (user_id, username, display_name, role)
values
  ('<uuid-gerencia>', 'gerencia', 'Gerência', 'gerencia'),
  ('<uuid-prevencao>', 'prevencao', 'Prevenção', 'prevencao'),
  ('<uuid-admin>', 'admin', 'Administrador', 'admin');
```

## 4. Publicar Functions

Publique `ai-analysis` e `ai-question` com verificação JWT habilitada. As duas Functions consultam `public.profiles` com o JWT do usuário e recusam o tipo de análise não autorizado.

## 5. Verificação manual

- Gerência: Eventos, Diária, Mensal, Cartazes e IA de vendas.
- Prevenção: Perdas e IA de perdas.
- Admin: todas as áreas.
- Teste URLs diretas de cada rota com cada conta.
- Desative um perfil (`active = false`) e confirme que a sessão é encerrada.
