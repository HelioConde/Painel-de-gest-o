# Painel de Gestão — Front-end React

Front-end separado do backend do SUPERUS. Este projeto **não lê arquivos locais** do computador do backend: os dados vêm exclusivamente do Supabase, pelas tabelas `public.superus_period_snapshots` (vendas/eventos) e `public.loss_period_snapshots` (perdas).

## Stack

- React + Vite
- Supabase JS
- React Router com `HashRouter` (compatível com GitHub Pages)
- Lucide React
- CSS responsivo sem framework visual

## Funcionalidades da primeira versão

- Venda Diária
- Venda Mensal
- Eventos
- Perdas
- Seleção `Todas as lojas` ou uma das 6 lojas
- Cards de atual, anterior, diferença e variação
- Drill-down Setor → Grupo → Subgrupo
- 17 setores no nível principal
- Eventos com cores próprias
- Métrica em quantidade para `Segunda da Pizza`
- Filtro de setor respeitado para eventos como `Segunda da Pizza` e `Sexta do Pão`
- Layout desktop e mobile
- Perdas consolidadas das 6 lojas
- Indicador Perda/Venda
- Drill-down de perdas Setor → MIP → Produtos

## 1. Configurar no PC 2

Requer Node.js compatível com o Vite atual (Node 22 recomendado).

```bat
npm install
copy .env.example .env
```

Edite `.env`:

```env
VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
VITE_SUPABASE_ANON_KEY=SUA_CHAVE_ANON_PUBLICA
```

Use **somente a chave pública/anon** no front-end. Nunca coloque a `service_role` no site.

## 2. Rodar localmente

```bat
npm run dev
```

## 3. Gerar build

```bat
npm run build
```

## 4. GitHub Pages

O projeto já inclui `.github/workflows/deploy.yml`.

No repositório GitHub:

1. Settings → Secrets and variables → Actions.
2. Crie `VITE_SUPABASE_URL`.
3. Crie `VITE_SUPABASE_ANON_KEY`.
4. Settings → Pages → Source: **GitHub Actions**.
5. Faça push para `main`.

A configuração `base: './'` e o `HashRouter` evitam problema de rota ao publicar em um subdiretório do GitHub Pages.

## Contrato Supabase usado

Tabelas: `superus_period_snapshots` e `loss_period_snapshots`.

O front lê a coluna `details`, produzida pela V8.3.2, que contém:

```text
network
  └─ sectors[17]
      └─ groups[]
          └─ subgroups[]

stores[6]
  └─ sectors[17]
      └─ groups[]
          └─ subgroups[]
```

Isso mantém a regra importante do painel: **subgrupos nunca aparecem como setores de primeiro nível**.

## Segurança

O SQL V8.3 habilita RLS e permite somente `SELECT` para `anon`/`authenticated`. A gravação continua sendo responsabilidade exclusiva do backend usando a chave secreta/service role.

## Contrato de Perdas

A página **Perdas** lê uma linha por loja de `loss_period_snapshots`, agrupa o run mais recente e exibe o consolidado da rede. O campo `details` é usado para o detalhamento **Setor → MIP → Produtos**, enquanto `current_sales_value` e `current_loss_sales_percent` sustentam o indicador Perda/Venda.

## Perdas V1.3

A tela de Perdas segue o relatório operacional:

1. Vendas e Perdas por Setor — 17 setores fixos, atual x ano anterior, % perda e meta.
2. Top 10 Produtos por Setor — somente setores com perda; unidade exibida junto da quantidade perdida.

Para preencher corretamente vendas de setores que tiveram perda zero, use o backend V8.3.3 e ressincronize o run de perdas. O front detecta snapshots antigos e mostra um aviso em vez de inventar vendas zeradas.


## Histórico da Venda Diária

Na página **Venda Diária**, o seletor **Data da venda** permite acessar qualquer dia já sincronizado no Supabase. A opção **Relatório mais recente** continua sendo a seleção padrão.

- A lista é consultada na tabela `public.superus_period_snapshots`, filtrando `snapshot_type = 'DAILY'` e `slug = 'daily'`, sem modificar o backend ou os dados armazenados.
- O dia escolhido corresponde a `current_end` (data efetiva da venda), **não** a `reference_date` (data da execução). O backend normalmente coleta a venda do dia anterior.
- Datas sem relatório sincronizado não são oferecidas na lista.
- Selecionar outra data recarrega todos os comparativos e detalhamentos do snapshot daquela data, mantendo a navegação por loja.
- A listagem é paginada para incluir históricos superiores ao limite padrão de linhas do PostgREST.

Se uma data não aparecer, confirme que a coleta diária daquele dia foi sincronizada e está acessível à conta no Supabase. O seletor é somente leitura e não cria nem recupera relatórios que não foram enviados.

## Auditoria de interface e QA

A linguagem visual documentada está em [Guia Visual do Painel](../docs/ui-ux/GUIA_VISUAL_PAINEL.md). A avaliação por Taste Skill, Web Design Guidelines, Awesome Design, Image to Code e Playwright está em [Auditoria 20/10/2026](../docs/ui-ux/AUDITORIA_2026-10-20.md).

Para executar a verificação automática do histórico em ambiente local:

```powershell
npm ci
npm install --save-dev --save-exact playwright@1.56.0
npx playwright install chromium
npm run dev -- --host 127.0.0.1 --port 5183
# Em outro terminal:
npm run qa:daily
```

A execução sem `QA_STORAGE_STATE` abre navegador visível para fazer login manual. Os screenshots e o relatório da auditoria ficam em `frontend/qa-output/daily-history/` (ignorado pelo Git). **Nunca adicione tokens ou sessões autenticadas ao repositório.**

Também há `npm run qa:layout` para inspecionar as demais telas após disponibilizar uma sessão autenticada. Esses scripts não substituem build/QA manual.


### QA responsivo dos relatórios

As quatro páginas de relatório agora compartilham `src/styles/report-ui-polish.css`, com regras exclusivas de tela e sem mudar o layout de impressão. Para validar as alterações em dados reais:

```cmd
npm run build
npm run qa:daily
npm run qa:reports
```

`qa:reports` faz login manual no Chromium, percorre **Venda Diária, Venda Mensal, Eventos e Perdas**, salva capturas nas larguras **1366, 768, 390 e 360px** e confere overflow, corte de valores, layout 2x2 dos indicadores de vendas no celular e estados dos filtros. Resultados e PNGs ficam em `qa-output/report-mobile/` (fora do versionamento).

Os testes exigem a aplicação local no ar em `http://127.0.0.1:5183`, ou `QA_BASE_URL` configurado. Sem uma sessão do painel, a auditoria visual não pode ser considerada aprovada.


### Testar a impressão dos eventos (A4)

A impressão do **Comparativo de vendas por loja** usa regras próprias em `src/styles/event-print-chart.css` para preservar a altura das barras e seus percentuais em todos os eventos (incluindo *Segunda da Pizza*).

Para testar com os snapshots reais, mantenha `npm run dev -- --host 127.0.0.1 --port 5183` ativo e execute em outro terminal:

```cmd
npm run qa:print-events
```

O Playwright percorre os eventos disponíveis, simula CSS de impressão, valida se a maior barra ocupa pelo menos 75% do eixo e gera `qa-output/event-print/*-a4.pdf` e `*-print.png`. Esses arquivos não são enviados ao Git. Reabra a prévia de impressão do Chrome para verificar a folha A4 e as configurações da impressora física.

O teste não altera dados nem configurações de impressão do Windows.
