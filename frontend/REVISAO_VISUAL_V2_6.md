# Revisão Visual v2.6 — Painel de leitura imediata

Objetivo desta revisão: reduzir o máximo possível a altura inicial das páginas sem remover informações importantes e padronizar a experiência entre Venda Diária, Venda Mensal, Perdas, Eventos e Análise com IA.

## Venda Diária e Venda Mensal
- título, período, comparativo, ações e troca de loja agora compartilham um único cabeçalho compacto;
- seletor de loja foi incorporado ao cabeçalho, eliminando uma faixa inteira da página;
- KPIs ficaram mais baixos e sem textos secundários redundantes;
- removido o bloco duplicado de "Resultado da loja" abaixo da tabela;
- tabela ganhou linhas mais compactas para exibir mais setores na primeira dobra;
- gráficos continuam abaixo da tabela, preservando o fluxo de leitura solicitado;
- rodapé redundante de troca de lojas foi removido; as setas e o contador ficam no cabeçalho.

## Perdas
- título, período, comparativo, abas e troca de loja foram reunidos em um único cabeçalho compacto;
- abas Perdas / Top Perdas / Pesquisa ficam na mesma região do cabeçalho;
- KPIs ficaram mais compactos;
- cabeçalho interno da tabela deixou de repetir loja e período;
- linhas da tabela foram reduzidas levemente;
- gráficos inferiores ficaram menores;
- rodapé redundante de seleção de lojas foi removido.

## Eventos
- removida a lista horizontal de todos os eventos no topo;
- navegação entre eventos agora é feita por setas dentro do próprio banner;
- banner mostra posição do evento (ex.: 3/5);
- ações Imprimir / Atualizar ficam sobrepostas ao banner sem consumir uma nova faixa vertical;
- banner foi reduzido em altura;
- KPIs foram compactados;
- tabela de lojas ficou mais densa;
- os três insights (melhor, pior e geral) foram movidos para dentro do card do gráfico;
- removida a seção separada de insights, reduzindo bastante o scroll.

## Análise com IA
- topo remodelado para leitura executiva;
- título e atualização ficaram mais compactos;
- loja, período, comparativo, modo e ação ficam em uma única faixa;
- botões grandes "Analisar Vendas" / "Analisar Perdas" foram substituídos por seletor segmentado Vendas / Perdas;
- existe um único botão "Atualizar análise";
- KPIs ficaram mais compactos e sem subtítulos redundantes;
- resumo da IA foi reduzido em altura;
- espaçamento entre gráficos, alertas e painéis foi reduzido mantendo legibilidade.

## Padronização
- novo componente `CompactReportHeader.jsx` para cabeçalhos compactos;
- espaçamento base de 10px entre blocos;
- cards principais com raio de 12–14px e sombra discreta;
- mesma hierarquia: contexto -> KPIs -> conteúdo principal -> gráficos/insights.

## Validação
Os arquivos JSX alterados foram validados sintaticamente com o compilador TypeScript (`tsc`) em modo `allowJs`/`jsx preserve`.

O build Vite completo não foi executado porque as dependências `node_modules` não fazem parte do pacote enviado e a instalação de dependências no ambiente de trabalho não concluiu em tempo hábil.
