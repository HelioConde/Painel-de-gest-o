# Auditoria e correcoes de desempenho — 05/11/2026

## Problemas identificados por revisao de codigo

1. Todas as paginas React eram importadas na entrada, mesmo sem serem acessadas.
2. CSS de cartazes e impressao era importado globalmente.
3. O carrossel de vendas montava ate sete HierarchyExplorer completos, embora somente uma loja estivesse visivel.
4. Eventos consultava ate 100 snapshots completos com JSONB details apenas para filtrar os cinco eventos atuais no navegador.
5. O historico diario deduplicava datas no navegador, percorrendo o historico de vendas em paginas de 500 linhas.
6. O service worker armazenava indiscriminadamente respostas GET da propria origem, incluindo verificacoes version.json com query timestamp. A checagem de versao ocorria a cada 15 segundos.

## Alteracoes

- React.lazy e Suspense em todas as rotas; CSS exclusivo de cartazes e de impressao no modulo responsavel.
- Hierarquia do carrossel montada somente na loja atual (impressao mantida para essa loja).
- Eventos: cinco consultas paralelas, limitadas a um snapshot por evento, mantendo a ordenacao por reference_date e updated_at.
- Historico de datas: consulta view DISTINCT no banco; fallback seguro para consulta anterior se a view ainda nao existir. Todas as datas permanecem acessiveis.
- Service Worker: restringe cache a recursos estaticos e HTML do proprio aplicativo, limita itens estaticos e exclui version.json e Supabase. Limpeza somente dos caches com prefixo deste app.
- Verificacao periodica da versao a cada 120 segundos, alem dos eventos de foco, visibilidade e online.

## Acao manual necessaria no Supabase

A migracao em \`supabase/migrations/20261105090000_optimize_panel_read_queries.sql\` esta versionada, **mas nao foi executada no Supabase remoto** (projeto do Primor nao esta disponivel na conexao atual). Antes de aplicar:

1. Confirmar que o projeto correto e o do Primor e que as tabelas existem.
2. Realizar backup ou verificar o ponto de recuperacao.
3. Executar a migracao em horario de baixo movimento.
4. Testar a view e confirmar os indices com consultas somente de leitura:

\`\`\`sql
select current_end
from public.daily_sales_available_dates
order by current_end desc
limit 10;

select tablename, indexname
from pg_indexes
where schemaname = 'public'
  and tablename in ('superus_period_snapshots', 'loss_period_snapshots')
order by tablename, indexname;
\`\`\`

A view usa \`security_invoker = true\` e respeita a RLS. Nao foi criada politica que expande acesso aos snapshots.

## QA de publicacao

Executar \`cd frontend && npm ci && npm run build\`. Conferir login dos quatro papeis, telas de Eventos, Vendas (incluindo data antiga e todas as lojas), Perdas, Tabloide, Analise IA, Cartazes e impressao. Acompanhar DevTools Network e Performance para confirmar transferencias e tempos, pois a revisao estatica nao substitui benchmark de navegador autenticado. O CI executa o build para pull requests.

## Limites

Nao houve acesso ao projeto Supabase do Primor para executar migracao ou EXPLAIN ANALYZE. Nao ha porcentagem de ganho medida. O frontend funciona com a implementacao de datas anterior ate a view ser instalada.
