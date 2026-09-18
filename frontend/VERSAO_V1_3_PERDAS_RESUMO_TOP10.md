# V1.3 — Perdas no padrão do relatório

- Ordem da tela: Vendas e Perdas por Setor → Top 10 produtos por setor.
- 17 setores fixos no resumo, na ordem canônica do painel.
- Vendas, perdas, % perda e META para atual e ano anterior.
- Metas do Excel: ACOUGUE 1%; EMPORIO 1%; FLORICULTURA 5%; FLV MANIPULADOS 5%; HORTIFRUTI 5%; PADARIA 4%; PERECIVEIS 1%; PIZZARIA 1%; ROTISSERIA 3%.
- Setores sem meta cadastrada exibem "Sem meta".
- PRODUTOS NATURAIS é consolidado em FLV MANIPULADOS.
- Top 10 usa quantidade perdida, por setor, e omite setores sem perda.
- A unidade fica junto da quantidade perdida (ex.: 12,600 KG).
- Para preencher vendas de setores com perda zero é necessário o snapshot de perdas schema_version 3 (backend V8.3.3).
