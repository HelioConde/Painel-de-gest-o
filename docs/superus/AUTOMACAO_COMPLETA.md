# Automação completa do SUPERUS — Painel de Gestão

Esta versão consolida a automação de **Vendas** e **Perdas** no backend Python do novo Painel de Gestão. A implementação foi reorganizada, mas a parte Win32 foi reconstruída a partir do fluxo que já havia sido comprovado no projeto anterior, em vez de redescobrir o SUPERUS do zero.

## Regras que não podem ser quebradas

- O fluxo normal usa HWND e mensagens locais do Windows.
- Não usa `pyautogui`, mouse físico, teclado global, `SetForegroundWindow`, `BringWindowToTop` ou `SetFocus`.
- Cada execução cria um `run_id` novo e exporta arquivos novos.
- Arquivos HTM/XLS/TXT/PDF de execuções anteriores nunca substituem uma nova coleta no SUPERUS.
- Uma sessão SUPERUS já aberta pode ser reaproveitada; os dados/relatórios não.
- O formato técnico principal de exportação é HTM.

## Vendas — rotina diária

O planner define os jobs. A automação Win32 apenas executa os períodos recebidos.

- `DAILY`: sempre.
- `MONTHLY`: sempre.
- `EVENT`: conforme o calendário do planner.
- `MONTHLY_CLOSE`: adicionalmente no dia 1.

Cada job gera **CURRENT** e **PREVIOUS** de forma independente. Inclusive `MONTHLY` e `MONTHLY_CLOSE` são coletados novamente quando coincidem no dia 1.

Fluxo Win32 de vendas:

1. inicia ou reutiliza sessão do SUPERUS;
2. trata login, se necessário;
3. cancela `TFormRelEstMin_ProdEstrategico`, se aparecer;
4. aguarda `TFormMenuPrincipal` e o menu nativo ficar realmente populado;
5. abre `Vendas > Vendas` por comando do menu, sem ativar a janela;
6. aguarda `TFormVendas`;
7. configura `TRadioButton 16` = Setorização;
8. configura `TCheckBox 8` = Por Loja;
9. seleciona `Todas Vendas`;
10. seleciona `SubGrupo`, preservando a hierarquia Loja → Setor → Grupo → SubGrupo;
11. configura `TSimusDateTimePicker 2` e `1`;
12. gera com `TBitBtn 2`;
13. aguarda um `TFormPreview` novo;
14. exporta um HTM novo;
15. valida período, seis lojas, setor, grupo e detalhes.

### Eventos

A coleta bruta do evento usa o mesmo relatório completo de SubGrupo para manter a automação estável. A semântica fica declarada em `src/business/event_config.py`:

- `fim_semana`: todas as vendas, monetário;
- `segunda_pizza`: bruto completo; pós-filtro de setor `PIZZARIA`; métrica `quantity`, unidade `QTD`;
- `terca_carne`: todas as vendas, monetário;
- `quarta_quinta_verde`: todas as vendas, monetário;
- `sexta_pao`: bruto completo; pós-filtro de setor `PADARIA`, monetário.

Isto evita reintroduzir filtros frágeis na tela e mantém uma única automação de vendas. O parser/regra de negócio é responsável pelos pós-filtros declarados.

## Perdas — coleta manual por período/lojas

A coleta de perdas permanece acionada pelo operador, porque o período e as lojas são escolhidos manualmente.

Fluxo Win32:

1. inicia/reutiliza SUPERUS;
2. trata login e popup de estoque;
3. `Faturamento > Pedidos`;
4. aguarda `TFormPedidos`;
5. envia F11 diretamente ao HWND de `TFormPedidos`;
6. aguarda `TFormRelPedidos`;
7. seleciona a aba `Produtos`;
8. confirma os estados obrigatórios:
   - `TRadioButton 3` marcado;
   - `TCheckBox 5` marcado;
   - `TCheckBox 3` marcado;
   - `TCheckBox 4` marcado;
   - `TCheckBox 28` marcado;
   - `TCheckBox 1` desmarcado;
   - `TCheckBox 40` marcado;
   - `TGroupButton 18` acionado;
9. configura origem `TComboEdit 3` e destino `TComboEdit 2` com a mesma loja;
10. configura datas `TSimusDateTimePicker 2` e `1`;
11. gera com `TBitBtn 2`;
12. aguarda preview novo;
13. exporta HTM novo;
14. repete para o período equivalente do ano anterior;
15. repete para cada loja selecionada.

Mapeamento interno das lojas:

- 307 → 17
- 212 → 15608
- 600 → 63395
- 120 → 66471
- 033 → 72731
- 018 → 74964

## Instalação na máquina com SUPERUS

```cmd
cd /d "C:\Painel de gestão\backend"
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Preencha no `.env` somente as credenciais/paths locais necessários.

## Comandos

Planejamento sem abrir o SUPERUS:

```cmd
python main.py --plan
python main.py --plan --today 2026-09-04
```

Teste sem automação:

```cmd
python main.py --daily-auto --dry-run
```

Primeiro teste real recomendado de Vendas:

```cmd
python main.py --daily-auto --today 2026-09-04 --only-job daily
```

Rotina diária de Vendas:

```cmd
python main.py --daily-auto
```

Perdas via interface:

```cmd
python main.py --losses-gui
```

Perdas via CLI:

```cmd
python main.py --losses-auto --inicio 01/09/2026 --fim 03/09/2026 --lojas 307,212,600,120,033,018
```

## Exportação HTM

A coordenada padrão do ícone HTM na barra do `TFormPreview` está configurada como `x=437`, `y=16`, imediatamente ao lado do antigo botão Excel. Ela pode ser ajustada no `.env` sem alterar código:

```env
SUPERUS_EXPORT_HTML_X=437
SUPERUS_EXPORT_HTML_Y=16
```

O arquivo precisa existir, ter tamanho maior que zero, permanecer estável em leituras consecutivas e passar pelos quality gates.

## Validação antes de produção

Os testes unitários podem ser executados em qualquer máquina:

```cmd
python -m pytest
python -m ruff check .
```

A validação da interação real com o SUPERUS precisa ser executada na máquina Windows onde o sistema está instalado. O pacote não considera uma automação real como validada apenas porque os testes unitários passaram.
