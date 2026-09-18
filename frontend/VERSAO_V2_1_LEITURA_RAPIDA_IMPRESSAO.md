# Painel de Gestão Front-end React — V2.1

## Objetivo
Refinar a leitura rápida do painel e aplicar os ajustes finais solicitados após a revisão QA/UX.

## Correções aplicadas

### Venda Diária / Venda Mensal
- Resultado final alinhado à mesma grade da tabela.
- Adicionada a coluna **Diferença** nas linhas de Setor → Grupo → Subgrupo para que o rodapé tenha exatamente as mesmas métricas do corpo da tabela.
- Mantidos Atual, Anterior, Diferença e Variação no resumo final.

### Perdas
- Separação visual mais forte entre **2026** e **2025**.
- 2026 usa família azul clara; 2025 usa família quente/creme.
- Divisor vertical reforçado entre os anos.
- Coluna Setor permanece visível no scroll horizontal.

### Eventos
- **Segunda da Pizza** é exibida em **UND**, inclusive para snapshots antigos que gravaram o valor nos campos monetários.
- Eventos com snapshot incompleto, mas sem detalhamento por loja, não entram como evento válido na navegação.
- **Terça da Carne** continua visível como referência com selo **Sem dados** quando ainda não estiver sincronizada.
- Cada loja ganhou uma cor de identificação própria e bem transparente, preservando a legibilidade.

### Sidebar
- Logo e textos centralizados no modo expandido.
- No modo recolhido, cada seção exibe uma inicial colorida acima do ícone:
  - E — Eventos
  - D — Venda Diária
  - M — Venda Mensal
  - P — Perdas
- Tooltips continuam informando o nome completo.

### Impressão
- Botão **Imprimir** incluído em Eventos, Venda Diária, Venda Mensal, Perdas e Top Perdas.
- CSS específico para impressão física/PDF:
  - sidebar e controles ocultos;
  - logo Primor no relatório;
  - somente a loja ativa do carrossel é impressa;
  - layout A4 paisagem;
  - cabeçalhos e tabelas com contraste de impressão.

### QA / acessibilidade
- Eventos sem detalhamento não abrem tela vazia.
- Mantido suporte a `prefers-reduced-motion` da V2.0.
- Mantido feedback de atualização sem esconder os dados anteriores.

## Arquivos principais alterados
- `src/components/AppShell.jsx`
- `src/components/EventStoreComparison.jsx`
- `src/components/HierarchyExplorer.jsx`
- `src/components/PageHeader.jsx`
- `src/components/PrintButton.jsx` (novo)
- `src/pages/EventsPage.jsx`
- `src/utils/snapshot.js`
- `src/styles.css`
