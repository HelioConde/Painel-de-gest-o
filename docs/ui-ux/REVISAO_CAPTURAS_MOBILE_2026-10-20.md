# Revisão visual das 16 capturas de relatórios — 20/10/2026

## Fonte e alcance

Material recebido do teste local `qa-output/report-mobile`: quatro páginas (Venda Diária, Venda Mensal, Eventos e Perdas), em 1366, 768, 390 e 360 CSS pixels, mais `result.json`.

**Resultado automatizado original:** PASS em 16 combinações, sem erros JavaScript e sem overflow de largura do documento. Na captura original, os valores principais da tabela de vendas mediam **9,6px a 1366px**, **11px a 768px** e **12px a 390/360px**.

A análise visual de screenshots **não equivale a uma nova execução** após os ajustes abaixo.

## Achados

| Prioridade | Tela | Evidência visível | Solução aplicada |
|---|---|---|---|
| Média | Diária e Mensal, 1366px | Números da tabela de setores ainda muito pequenos para o espaço disponível, embora legíveis com zoom | Texto dos valores ampliado para 11–11,5px; nomes para 12px, cabeçalho 11px e linhas mínimas de 36px no desktop |
| Alta para QA | Eventos e Perdas, 768px | Sidebar parcialmente aparente nas capturas, apesar de fechada nas páginas anteriores; provável transição CSS sendo capturada durante mudança de viewport | O QA aguarda a sidebar estar completamente fora da tela, antes de capturar, e reprova caso se sobreponha |
| Alta para QA | Mensal, 390px | Faixa vazia com cerca de 270px entre setores em um screenshot completo; ausente em 360px | Captura com animações desativadas, verificação de distância entre setores e screenshot adicional da viewport para diferenciar falha de composição do navegador |
| Baixa | Diária e Mensal, 360/390px | A grade 2×2 apresenta números e percentuais inteiros; lista com 17 setores gera rolagem longa | Layout aprovado como base; futuras melhorias podem incluir localizar/jump to setor, mas exigem definição de produto |
| Baixa | Eventos e Perdas, 360/390px | Cards móveis preservam informação e cores; rótulos auxiliares ainda compactos | Manter tipografia mobile de 10–12px e revisar manualmente hierarquia em próximas alterações |

## Mudanças no repositório

- `frontend/src/styles/report-ui-polish.css`: refinamento da tipografia desktop de Venda Diária e Mensal.
- `frontend/scripts/qa-report-mobile.cjs`: aguarda `document.fonts.ready` e a sidebar sair da viewport após redimensionar; produz capturas `-viewport.png` além das completas, com animação desativada; verifica distância entre setores e sobreposição lateral.
- Nenhuma consulta financeira, comparação, filtro do Supabase ou folha de impressão foi alterada.

## Como confirmar

Mantenha o Vite local ativo na porta 5183; em outro terminal, na pasta `frontend`:

```cmd
npm run build
npm run qa:daily
npm run qa:reports
```

Inspecione especialmente `report-mobile/eventos-768.png`, `perdas-768.png`, `mensal-390.png` e a comparação `*-viewport.png`. Confirme visualmente que não há menu sobreposto ou lacuna no conteúdo.

**Status:** revisão das capturas anteriores concluída e correções pontuais enviadas ao GitHub; nova captura e QA no computador do usuário ainda **pendentes**.
