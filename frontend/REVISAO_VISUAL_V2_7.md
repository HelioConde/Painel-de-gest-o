# Revisão visual v2.7

## Ajustes aplicados

### Eventos
- Corrigido o banner usando cinco imagens individuais em vez de uma spritesheet única.
- Corrigida a navegação entre eventos com setas dentro do banner e posicionamento isolado do restante da página.
- Removidos os botões genéricos de Imprimir e Atualizar.
- Gráfico por loja refinado com linhas-guia discretas, barras mais legíveis e insights compactos integrados ao próprio card.
- Mantida a página em formato enxuto para caber melhor na primeira dobra.

### Venda Diária e Venda Mensal
- Removidos os botões genéricos de Imprimir e Atualizar dos cabeçalhos.
- Cabeçalhos compactos preservados com título, período e seletor de loja.

### Perdas
- Removidos os botões genéricos de Imprimir e Atualizar.
- Top Perdas ficou mais compacto: removidas repetições de loja/período dentro do painel, reduzidos paddings, gaps e altura dos cabeçalhos de setor.

### Análise com IA
- Loja inicial alterada para 307 (Loja 01).
- Lojas ordenadas na sequência 307, 212, 600, 120, 033, 018.
- Removido o botão genérico Atualizar do topo.
- Mantido apenas o botão operacional Atualizar análise, necessário para executar a IA.
- Adicionado estado inicial compacto para evitar grande área vazia antes da primeira análise.
- Refinados contexto, modo de análise e espaçamentos do topo.

### Geral
- O componente compartilhado de cabeçalho não renderiza mais Imprimir/Atualizar.
- `PageHeader` genérico também foi simplificado para manter o padrão visual.
