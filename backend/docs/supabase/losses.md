# Perdas → Supabase

## O que é enviado

Os arquivos `loss_<loja>_current.htm` e `loss_<loja>_previous.htm` continuam sendo a
fonte auditável local. O backend lê os HTMs, valida e envia **dados estruturados**
para `public.loss_period_snapshots`.

Não é necessário gravar o HTML bruto dentro de uma coluna do banco.

Cada linha da tabela representa uma loja + par de períodos:

- `307`, `212`, `600`, `120`, `033` ou `018`;
- período current;
- período previous;
- totais do relatório;
- SHA-256 dos dois HTMs;
- `details` com Setor → MIP → Produtos;
- Top 10 perdas de cada setor;
- `quality` com as validações do parser;
- `run_id` que gerou os arquivos.

## Primeira configuração

1. Execute `sql/loss_period_snapshots.sql` no SQL Editor do Supabase.
2. Configure `backend/.env`:

```env
SUPABASE_URL=https://SEU-PROJETO.supabase.co
SUPABASE_SECRET_KEY=SEU_SECRET_KEY
SUPABASE_LOSS_TABLE=loss_period_snapshots
SUPABASE_TIMEOUT=30
```

A secret/service-role key é somente do backend. Nunca colocar no React.

## Conferir um run sem enviar

```cmd
python main.py --build-loss-payload SEU_RUN_ID
```

Gera:

```text
data\loss_runs\<run_id>\payload_preview.json
```

## Enviar um run já coletado

```cmd
python main.py --sync-loss-run SEU_RUN_ID
```

Ou o run PASS mais recente:

```cmd
python main.py --sync-latest-loss-run
```

O sync faz:

1. parser dos pares current/previous;
2. quality gates;
3. UPSERT por loja/período;
4. SELECT de read-back;
5. comparação de `run_id`, SHA-256 e quantidade de registros;
6. grava `supabase_sync.json`.

## Coletar e enviar automaticamente

```cmd
python main.py --losses-auto --inicio 01/09/2026 --fim 05/09/2026 --lojas 307,212,600,120,033,018 --sync
```

`rodar_perdas.bat` foi configurado para abrir a GUI com `--sync`, portanto uma
coleta PASS é seguida automaticamente pela sincronização.

Sem `--sync`, a coleta continua funcionando normalmente e apenas cria
`payload_preview.json`.

## Idempotência

A chave lógica é:

```text
store_code
+ current_start
+ current_end
+ previous_start
+ previous_end
```

Rodar novamente o mesmo período faz nova coleta do SUPERUS e depois UPSERT na
mesma linha lógica. O backend nunca usa a existência da linha no Supabase para
pular a automação.
