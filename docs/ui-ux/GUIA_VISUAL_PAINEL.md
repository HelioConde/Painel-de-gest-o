# Painel de Gestão — guia visual e de interação

**Referência de implementação:** `frontend/src/styles.css` e `frontend/src/styles/report-layout.css`. O arquivo `frontend/src/styles/global.css` pertence a uma estrutura alternativa e **não é importado** pelo ponto de entrada `frontend/src/main.jsx`; não o utilize como fonte de tokens até unificar as duas bases.

## 1. Personalidade visual (Taste Skill)

Sistema operacional comercial de leitura imediata: limpo, sóbrio, profissional, alto contraste e informação em primeiro lugar. Evitar decoração que aumente a altura antes dos indicadores.

- **Cor principal de interação:** `--primary: #2563eb`; **superfície:** `--surface: #fff`; **borda:** `--line: #e5eaf2`; **texto secundário:** `--muted: #667085` (conforme `styles.css`).
- **Semântica financeira:** positivo `--positive: #0f9f6e`, negativo `--negative: #dc3545`; nunca indicar situação apenas por cor — incluir sinal, texto e valor.
- **Tipografia:** Inter com fallback para fontes de sistema; títulos de página 24–34px, títulos de seção 16–20px, corpo de conteúdo 13–15px, metadados no mínimo 11–12px sempre que o espaço permitir.
- **Espaçamento:** escala 4 / 8 / 12 / 16 / 24 / 32px; distância entre blocos relacionados menor que entre seções. Componentes compactos não devem sacrificar leitura para caber em uma só dobra.
- **Superfícies:** raio usual 10–14px, bordas suaves, sombras discretas. Evitar estilos inline para escolhas recorrentes.

## 2. Hierarquia do relatório

Ordem visual consistente para Venda Diária, Mensal e Perdas:

1. **Contexto:** título, período atual, comparativo e loja.
2. **Filtros e ações:** data, loja, atualização/impressão quando disponíveis; filtros claros e rotulados.
3. **Indicadores-chave:** vendido atual, anterior, diferença e variação.
4. **Detalhamento:** setores e respectivos grupos/subgrupos ou produtos.
5. **Gráficos/insights:** apoio à leitura, sem repetir textos extensos.

**Componente compartilhado de título:** `CompactReportHeader.jsx`. **Dados:** `SnapshotView.jsx`, `StoreTableCarousel.jsx`, `HierarchyExplorer.jsx`. O filtro histórico da Venda Diária fica na `DailyPage.jsx` e se identifica por `daily-history-*`.

## 3. Requisitos de experiência e acessibilidade (Web Design Guidelines)

- Todos os formulários devem ter `label` visível associado por `htmlFor/id`, nome acessível e, se preciso, descrição via `aria-describedby`.
- Alterações assíncronas importantes (data/período, erro e ausência de dados) precisam ser anunciadas e não devem exibir dados de um dia como se fossem de outro.
- Inputs e botões usados no celular: **alvo preferencial de pelo menos 44×44 CSS px**. Mínimo WCAG 2.2 depende do critério e exceções; 44px é a meta ergonômica do painel, não uma afirmação de conformidade automática.
- Contraste: textos comuns mínimo **4,5:1**, títulos grandes **3:1**, indicador visual de foco e limites relevantes **3:1** conforme critérios aplicáveis.
- `:focus-visible` deve ser claramente percebido; não remover outline sem alternativa contrastante.
- A navegação e filtros devem funcionar com `Tab`, `Shift+Tab`, `Enter` e teclas de direção quando o padrão ARIA exigir.
- Estado ativo sempre identificável por texto/ícone/estado sem depender apenas da cor.
- Testar largura de 360, 390, 768, 1366 e 1440px, zoom de 200%, impressão e orientação móvel.

## 4. Datas da Venda Diária

O seletor deve listar **apenas dias sincronizados**: `snapshot_type = DAILY`, `slug = daily`, usando `current_end` (data efetiva da venda). `reference_date` representa a execução da coleta, normalmente posterior ao dia vendido. A opção padrão é o relatório mais recente.

Para qualquer data selecionada, o **mesmo snapshot** precisa alimentar todos os componentes (loja, totais, grupos, gráficos, comparativo e impressão). A troca deve ter estado de carregamento/erro e permitir voltar ao relatório mais recente. Não permitir que a interface invente resultados de datas ainda não enviadas.

## 5. Image to Code: fluxo de comparação

Sem referência gráfica do usuário, não é legítimo afirmar equivalência de pixels. Fluxo previsto:

1. Gerar capturas reais das telas desktop e mobile por Playwright.
2. Receber o screenshot de referência ou imagem marcada com correções.
3. Localizar o elemento React e sua regra CSS, preservando a identidade atual.
4. Modificar componente/estilo real, nunca só uma imagem promocional.
5. Repetir capturas e comparar alinhamento, fonte, espaçamento, overflow e navegação antes de integrar.

Salvar capturas de QA em `frontend/qa-output/` (**ignorado pelo Git**). Evitar publicar dados de vendas nos commits.

## 6. Automação visual e funcional

O script `frontend/scripts/qa-daily-history.cjs` utiliza Playwright para conferir dias disponíveis, consulta por data real, cabeçalho correspondente, navegação, foco, overflow responsivo e impressão. O legado `qa-layout.cjs` cobre várias páginas, usando `QA_BASE_URL` e instalação local do Playwright.

Comandos a partir de `frontend/`:

```powershell
npm ci
npm install --save-dev --save-exact playwright@1.56.0
npx playwright install chromium
npm run dev -- --host 127.0.0.1 --port 5183
# Em outro terminal:
npm run qa:daily
```

Sem `QA_STORAGE_STATE`, o script abre um Chromium visível para login **manual**, sem gravar tokens. Se possuir estado autenticado armazenado de forma segura, forneça `QA_STORAGE_STATE` pelo ambiente (nunca envie esse arquivo ao Git).

`QA_BASE_URL` substitui a URL local padrão e `QA_CHROMIUM_PATH` permite usar um Chromium específico. O script produz `qa-output/daily-history/result.json` e PNGs; saída **PASS** só vale após execução real em ambiente autenticado.

## 7. Critério para aprovação de mudança visual

Revisão humana do antes/depois, comportamento de teclado, 360px e 1366px, nenhum texto essencial cortado, nenhum overflow da página, períodos financeiros coerentes e CSS de impressão sem filtros interativos. Check visual não substitui testes sobre dados reais.


## 8. Padrão responsivo de relatórios — revisão de outubro/2026

A folha `frontend/src/styles/report-ui-polish.css` concentra os refinamentos compartilhados de **Venda Diária, Venda Mensal, Eventos e Perdas** e é importada por último no `main.jsx`. Evite acrescentar novas exceções no `styles.css` gigante: prefira seletores com escopo da página e documente a razão de cada breakpoint.

**Token de refinamento:** `--report-ui-text` (texto principal), `--report-ui-muted` (texto secundário), `--report-ui-line` (bordas), `--report-ui-radius` (raios), `--report-ui-focus` (foco) e `--report-ui-gap` (espaçamento). A paleta principal do painel continua vindo de `frontend/src/styles.css`.

- **Acima de 820px:** cards compactos, KPIs com hierarquia clara e textos de apoio legíveis.
- **820px ou menos:** controles de loja com áreas mínimas de 44px; filtros horizontais com rolagem própria; cartões de Eventos/Perdas com valores de fonte maior.
- **480px ou menos:** nomes de setores completos e ordenação mais visível, mantendo a estrutura em duas linhas já aplicada.
- **420px ou menos:** quatro métricas de Setores exibidas em uma matriz **2 × 2**, incluindo seus rótulos, sem cortar percentuais. Também vale para totais e detalhamentos de Venda Diária/Mensal.
- **Impressão:** nenhuma nova regra altera páginas A4; todas as alterações ficam em `@media screen`.
- **Movimento reduzido:** respeitar `prefers-reduced-motion`.

Os filtros de Setores, Perdas e Eventos comunicam estado ativo por `aria-pressed`. Novos botões de filtro devem seguir o mesmo padrão e manter seus nomes acessíveis.

### QA da rodada (obrigatório antes de declarar aprovação visual)

```cmd
cd /d "C:\Painel de gestão\frontend"
npm run build
npm run qa:daily
npm run qa:reports
```

`qa:reports` abre um navegador para login manual, visita Diária/Mensal/Eventos/Perdas, testa 1366/768/390/360px, verifica corte de valores e filtros, e grava capturas em `frontend/qa-output/report-mobile/`.

**Atenção:** análises estáticas e commits não equivalem a screenshots verificadas em produção; os relatórios só estarão visualmente aprovados após conferir os PNGs gerados pela rotina no computador com acesso aos dados.
