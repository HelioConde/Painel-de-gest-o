# Auditoria de acesso a dados

## Consultas atuais

| Tabela | Módulo consumidor | Dados | Perfis previstos |
| --- | --- | --- | --- |
| `superus_period_snapshots` | `frontend/src/services/sales.js` | vendas diárias, mensais e eventos | gerencia, admin |
| `loss_period_snapshots` | `frontend/src/services/losses.js` | perdas, ranking e pesquisa | prevencao, admin |
| `profiles` | `frontend/src/auth/AuthProvider.jsx` | perfil autenticado | apenas o próprio usuário |

Cartazes usa estado local do navegador e imagens estáticas; não há tabela Supabase consultada pelo módulo atual.

## RLS aplicado

`profiles` recebe RLS na migration de autenticação. O usuário autenticado consegue selecionar exclusivamente a própria linha; não há policy de escrita para usuários finais.

## RLS pendente para dados operacionais

As tabelas de snapshots possuem payloads estruturados em `details` e são consumidas por mais de uma tela. O repositório não contém as migrations/origem dessas tabelas nem o estado atual das policies em produção. Aplicar uma policy agora sem inspecionar o Dashboard poderia interromper as sincronizações SUPERUS ou as consultas existentes.

Política recomendada após inspeção do schema e dos jobs de ingestão:

- `superus_period_snapshots`: `select` apenas para `gerencia` e `admin`.
- `loss_period_snapshots`: `select` apenas para `prevencao` e `admin`.
- contas de automação: escrita por chave de servidor, sem exposição por `anon`.

Use `public.current_user_role()` da migration nas políticas e valide primeiro em ambiente de desenvolvimento. Não aplicar RLS dessas tabelas é uma pendência explícita até que as policies e o processo de ingestão atuais sejam inventariados no projeto Supabase correto.
