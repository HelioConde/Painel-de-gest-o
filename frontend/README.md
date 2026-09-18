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
