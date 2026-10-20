# Auditoria de UX e qualidade — Painel de Gestão

**Data:** 20/10/2026  
**Escopo:** código React/CSS de Venda Diária, Venda Mensal, Perdas, navegação, documentação visual e automação de screenshots; revisão especial do filtro histórico da Venda Diária.

## Método e limitações

Inspeção estática do repositório `HelioConde/Painel-de-gest-o`, analisando componentes React, estilos, consultas ao Supabase e scripts existentes. Foram criados ajustes e uma rotina Playwright executável. **Não foi possível executar o painel autenticado, conferir dados reais do Supabase, realizar captura real de tela ou concluir testes Playwright nesta sessão.** Portanto, os riscos abaixo são **evidências do código**, e não falhas reproduzidas em produção. Não há screenshot de referência para efetuar comparação Image to Code.

## Resultado por disciplina

| Disciplina | Avaliação | Evidência / encaminhamento |
| --- | --- | --- |
| **Taste Skill** | Parcialmente padronizado | Layout compacto, cards e títulos consistentes; parte da tipografia de metadados permanece em 9–11px, pequena para uso comercial. Filtro histórico recebeu revisão de contraste, tamanho de toque e hierarquia. |
| **Web Design Guidelines** | Melhorar estados e navegação | Filtro agora usa `label`, `aria-describedby` e status; ainda é preciso testar foco real, zoom 200%, navegação de tabs e menús móveis. |
| **Awesome Design** | Guia criado | `GUIA_VISUAL_PAINEL.md` fixa paleta, tipografia, espaçamento, padrões de relatório, ações e responsabilidade dos componentes. |
| **Image to Code** | Não concluído sem referência | Processo definido: capturar imagens reais via QA, receber referência visual, implementar diferenças diretamente em React/CSS, repetir capturas. |
| **Playwright CLI** | Preparado; não executado | `qa-daily-history.cjs` automatiza critérios da Venda Diária; `qa-layout.cjs` perdeu o caminho absoluto de outro PC; requer execução local/autenticada. |

## Achados priorizados

### P1 — Alta: falta prova de regressão com dados históricos

O antigo `DailyPage.jsx` usava exclusivamente `getLatestSnapshot`; o novo serviço em `frontend/src/services/sales.js` lista datas de `current_end` e consulta por dia. Não há evidência de execução real contra o projeto Supabase do painel nesta sessão.

**Critério de encerramento:** escolher pelo menos uma data antiga, conferir `current_end`, intervalo comparativo, total da rede, loja individual, setores e relatório impresso. Os demais períodos e dias sem dados não podem retornar resultados inventados.

### P1 — Alta: QA antigo não era portável

O `frontend/scripts/qa-layout.cjs` carregava `playwright` de um caminho absoluto `C:/Users/Usuario/...`, inexistente em outros computadores. A dependência foi trocada para `require('playwright')`; o endereço local pode ser configurado por `QA_BASE_URL`, e estado de sessão por `QA_STORAGE_STATE`.

Outros scripts antigos de cartazes ainda merecem padronização equivalente e verificação de dependências, sem mudanças cegas no módulo de impressão.

### P2 — Média: tokens visuais em arquivos distintos

O arquivo `frontend/src/styles/global.css` define primário **verde**, enquanto a aplicação principal importa `frontend/src/styles.css`, com `--primary: #2563eb` (**azul**). Isso indica duas gerações de estilo e cria risco de regressão caso alguém importe ambas.

**Ação:** manter `styles.css` como referência operacional por ora e consolidar tokens em futura refatoração controlada — não substituir cores de toda a aplicação sem revisão visual.

### P2 — Média: tipografia muito compacta em alguns relatórios

Há declarações de 9px, 10px e 11px em tabelas, indicadores e textos auxiliares em `frontend/src/styles.css` e estilos de relatório. Em telas pequenas, podem prejudicar leitura de valores.

**Ação:** testar 360/390/768/1366px e zoom 200%, ajustar por hierarquia e espaço real. Aumentar metadados prioritários sem sacrificar quantidade/colunas de informações essenciais.

### P2 — Média: persistência do contexto ao trocar a data

O carrossel de lojas mantém seu estado internamente em `StoreTableCarousel.jsx` e reinicia o índice quando o snapshot muda; `DailyPage.jsx` recria o relatório ao escolher outro dia. O usuário pode ser movido para a primeira loja ao consultar o histórico.

**Ação recomendada:** manter a loja selecionada entre datas quando ela também existir no novo snapshot, explicitando quando a loja deixou de existir. Implementar junto a teste funcional específico.

### P2 — Média: eventos acessíveis por teclado além do básico

Os botões da área de Perdas estão marcados como `role="tab"` dentro de `role="tablist"` em `LossesPage.jsx`. Esse padrão exige verificar comportamento de setas, foco e associação com os painéis, não apenas clique. O filtro histórico usa seletor nativo e está mais alinhado à semântica de formulário.

### P3 — Baixa: manutenção e informação de estado

A lista de datas da Venda Diária é buscada na montagem e na ação de tentar novamente após erro. Sem recarregar a página, uma nova coleta pode não aparecer imediatamente no seletor. Um botão de atualização de histórico pode completar o fluxo.

A nova seleção já apresenta estado contextual e mensagens ao usuário; confirmar no navegador se a mudança foi anunciada e se o layout não salta em redes lentas.

## Mudanças realizadas nesta rodada

- `frontend/src/pages/DailyPage.jsx`: quantidade de dias disponíveis, associação `aria-describedby`, anúncio do período ao mudar a seleção.
- `frontend/src/pages/DailyPage.css`: alvo de toque de 44px, tipografia ligeiramente maior, foco em azul mais contrastante (substituição do foco azul-claro).
- `frontend/scripts/qa-layout.cjs`: remove import local de máquina específica; base da URL e browser configuráveis.
- `frontend/scripts/qa-daily-history.cjs`: cria diagnóstico do histórico, screenshots em cinco larguras, validação de período, foco, impressão e overflow; login manual quando estado não é fornecido.
- `frontend/package.json`: adiciona `npm run qa:daily` e `npm run qa:layout` (instale Playwright antes de executar).
- `docs/ui-ux/GUIA_VISUAL_PAINEL.md`: define padrão visual e fluxo Image to Code.

## Checklist para validação real

- [ ] `npm ci`, instalação do Playwright e `npm run build` concluídos.
- [ ] `npm run qa:daily` em navegador autenticado, `result.json` com PASS.
- [ ] Conferência manual das capturas de 1440, 1366, 768, 390 e 360px.
- [ ] Venda antiga e data mais recente mostram dias e comparativos corretos.
- [ ] Troca de loja, filtros, navegação por teclado e print permanecem funcionais.
- [ ] Nenhum token, arquivo de sessão ou screenshot contendo dados comerciais foi incluído no Git.

**Situação:** análise estática concluída; correções iniciais feitas; validação real de navegador **pendente**.
