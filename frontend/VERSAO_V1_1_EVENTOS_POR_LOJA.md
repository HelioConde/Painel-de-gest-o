# Front-end React v1.1 — Eventos por loja

Correção do painel de Eventos:

- Eventos deixam de usar Setor → Grupo → Subgrupo como visualização principal.
- O evento mostra as seis lojas (01 a 06) em comparação com o ano anterior.
- Colunas: Loja, ano atual, ano anterior, Diferença e Variação.
- Sexta do Pão usa o setor PADARIA de cada loja, respeitando `details.event_filter_sector`.
- Segunda da Pizza usa a métrica de quantidade da PIZZARIA.
- Eventos sem filtro setorial usam o total da loja conforme o contrato do backend.
- Venda Diária e Venda Mensal continuam com drill-down Setor → Grupo → Subgrupo.
- No mobile, cada loja vira um card comparativo legível.
