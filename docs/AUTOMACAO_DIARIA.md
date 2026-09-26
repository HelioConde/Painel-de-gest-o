# Automação diária de Vendas e Perdas

## O que executa

`backend/main.py --daily-sync` é o único orquestrador. Ele calcula o período de
**primeiro dia do mês de ontem até ontem**, consulta o Supabase e coleta apenas o
que estiver ausente ou inválido:

- Vendas: consolidado `MONTHLY/monthly` com as seis lojas;
- Perdas: um snapshot válido para cada uma das seis lojas;
- ambos ausentes: executa Vendas e, depois, Perdas;
- ambos válidos: encerra sem abrir o SUPERUS.

No dia 1, o período calculado corretamente é o mês anterior completo. Por
exemplo, em `01/10/2026`, o período é `01/09/2026` a `30/09/2026`.

O orquestrador usa os coletores existentes, portanto não altera cálculos,
parsers, filtros de perdas ou regras de Vendas. O ciclo é sequencial; cada
coletor já encerra os processos SUPERUS que abriu. A sincronização existente já
faz upsert idempotente e read-back; o orquestrador faz uma segunda validação
final do período.

## Execução manual

No PowerShell, a partir da raiz do projeto:

```powershell
.\scripts\run-daily-sync.ps1
.\scripts\check-sync-status.ps1
```

Para testar um período sem depender do relógio do computador:

```powershell
.\scripts\check-sync-status.ps1 --today 2026-09-24
.\scripts\run-daily-sync.ps1 --today 2026-09-24
```

O segundo comando abre o SUPERUS apenas quando a verificação apontar algo
pendente. A checagem e a execução retornam código diferente de zero em falhas.

## Agendador do Windows

Instale ou atualize a tarefa uma vez, em PowerShell aberto como o usuário que
usa o SUPERUS:

```powershell
.\scripts\install-daily-sync-task.ps1
```

O horário padrão é 06:30 (horário local). Para mudar sem editar código:

```powershell
.\scripts\install-daily-sync-task.ps1 -Hour 5 -Minute 0
```

A tarefa criada é `Primor - Sincronizacao Diaria`, com gatilho diário e ao
iniciar o Windows. Ela ignora uma segunda instância, reinicia em falhas do
Agendador e também usa o lock local `backend/tmp/daily-sync.lock`.

O SUPERUS é uma aplicação desktop: a tarefa usa o logon interativo do usuário,
portanto a sessão Windows deve estar conectada. Ela funciona sem abrir o painel
web. Depois da primeira validação bem-sucedida da nova tarefa, desative a
tarefa legada `Painel de Gestao - Vendas 05h` para não manter dois gatilhos.

## Logs, auditoria e diagnóstico

- Log local: `backend/logs/sync/AAAA-MM-DD/sync.log`.
- Auditoria Supabase: tabela `public.sync_runs` (migração
  `20260925022345_create_sync_runs_audit.sql`).
- O lock é removido ao fim. Se o computador desligar durante a execução, o
  próximo ciclo identifica o PID órfão e recria o lock.
- As rotinas faltantes têm até três tentativas, com espera de 10 e 30 segundos
  entre as tentativas. A falha final fica no log e na auditoria.

Antes da primeira execução, aplique a migração em `supabase/migrations` no
projeto Supabase. O worker nunca imprime nem grava chaves em logs; continue
mantendo credenciais e `SUPABASE_SECRET_KEY` somente em `backend/.env`.
