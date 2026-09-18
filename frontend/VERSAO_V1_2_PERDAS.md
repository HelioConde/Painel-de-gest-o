# V1.2 — Perdas no front-end

Incluída a quarta área principal **Perdas**, consumindo diretamente `public.loss_period_snapshots`.

## Tela Perdas

- período atual e comparativo do ano anterior;
- consolidado das 6 lojas;
- perda atual, perda anterior, diferença e variação;
- indicador **Perda / Venda**, usando o faturamento real enviado pela V8.2+;
- comparativo por loja 01–06;
- clique na loja para detalhar;
- hierarquia **Setor → MIP → Produtos**;
- maior perda de cada setor destacada;
- semântica de cores própria: aumento de perda = vermelho; redução = verde;
- responsivo para desktop e celular.

A página consulta apenas o Supabase. Não acessa arquivos locais do backend.
