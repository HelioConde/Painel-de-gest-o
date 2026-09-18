# Painel de Gestão Front-end React — V2.0 QA/UX Final

Esta versão aplica a revisão final orientada a leitura rápida e diagnóstico operacional.

## Objetivo
O usuário deve conseguir identificar rapidamente:
1. qual página/período está analisando;
2. qual loja está selecionada;
3. se o resultado está melhor ou pior;
4. quais setores/produtos explicam o resultado.

## Mudanças principais

### Sidebar / identidade Primor
- Sidebar aberta usa a logo horizontal do Primor.
- Sidebar recolhida usa apenas o símbolo compacto.
- Botão de recolher/expandir foi movido para a borda da sidebar.
- Navegação recolhida ficou mais limpa e consistente.

### Venda Diária / Venda Mensal
- Mantido o layout compacto de 17 setores.
- Resultado final permanece integrado ao rodapé da tabela.
- Atualização não esconde mais o dado que já está na tela.
- Se uma atualização falhar, o último dado carregado continua visível com aviso discreto.

### Eventos
- Abas horizontais ganharam indicação visual de continuidade/scroll.
- Evento sem snapshot mostra badge `Sem dados` em vez de parecer simplesmente desabilitado.
- `Todas as lojas` continua sendo exibido no rodapé.
- Segunda da Pizza usa quantidade quando os campos de quantidade estiverem presentes no snapshot; caso contrário preserva a métrica disponível.
- Total de rede pode ser reconstruído pela soma das lojas quando necessário.

### Perdas
- Primeira coluna (Setor) permanece visível durante scroll horizontal da tabela.
- Semântica de cores preservada: abaixo/dentro da meta = bom; acima da meta = ruim.
- Atualização mantém os dados existentes na tela.

### Top Perdas
- Refeito em duas colunas independentes balanceadas, evitando grandes espaços vazios.
- Removido scroll horizontal da tabela inteira.
- Apenas o nome do produto pode rolar horizontalmente quando for grande.
- Todas as métricas principais permanecem visíveis: perda, venda e % perda.
- Adicionada busca rápida por nome do produto ou código.
- Em mobile, POS e código são ocultados para priorizar produto e indicadores.

### Motion / acessibilidade
- Troca de conteúdo: 160–200 ms.
- Carrossel de loja: ~230 ms.
- Expansão Setor → Grupo → Subgrupo: ~170 ms.
- Animações discretas, voltadas à orientação e não ao efeito visual.
- `prefers-reduced-motion` respeitado.
- Foco visível para navegação por teclado.

## QA estático executado
- 33 arquivos JS/JSX analisados pelo parser TypeScript: 0 erros de sintaxe.
- Verificação de imports relativos: 0 imports ausentes.
- Assets das duas logos Primor presentes no pacote.

## Observação de build
A instalação das dependências via npm no ambiente de geração excedeu o timeout de acesso ao registry. O pacote foi validado estruturalmente; o build de produção deve ser executado no PC 2 com `npm install` e `npm run build`.
