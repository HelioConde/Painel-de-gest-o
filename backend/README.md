# Backend — Painel de Gestão

Backend Python do **Painel de Gestão**, responsável pelo planner diário, automação Win32 do SUPERUS, exportação HTM, quality gates e pipeline de Perdas.

## Estado desta versão

Validado na máquina real do SUPERUS em 04/09/2026:

- `TFormLogonUsuario` localizado corretamente;
- `TEdit INSTANCE 2` = usuário;
- `TEdit INSTANCE 1` = senha;
- botão `TBitBtn "&OK"`;
- `TFormMenuPrincipal -> Vendas > Vendas -> TFormVendas` por `WM_COMMAND`;
- `Setorização`;
- `Por Loja`;
- `Todas Vendas`;
- quebra `SubGrupo`;
- `TSimusDateTimePicker INSTANCE 2/1` para período;
- `TBitBtn INSTANCE 2` para gerar;
- `TFormPreview`;
- exportação HTM pelo `TPanel INSTANCE 1`, coordenada local `x=437, y=16`;
- diálogo `#32770` com título `Salva o relatório`;
- arquivo HTM criado e estabilizado;
- parser corrigido para ler o período real do elemento `ID="Periodo"` do QuickReport;
- 47 testes unitários passando neste pacote.

O fluxo de **Perdas** está incluído com os controles canônicos já mapeados. Ele usa o mesmo núcleo Win32 e a mesma exportação HTM. A primeira execução real completa de Perdas deve continuar sendo tratada como teste de integração, porque ela ainda não foi validada ponta a ponta nesta nova máquina da mesma forma que Vendas.

## Instalação

```cmd
cd /d "C:\Painel de gestão\backend"
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Preencha somente o `.env` local. Nunca coloque credenciais no código.

## Vendas — planner

```cmd
python main.py --plan
python main.py --plan --today 2026-09-04
```

## Vendas — rotina diária

Teste seguro:

```cmd
python main.py --daily-auto --dry-run
```

Somente Venda Diária:

```cmd
python main.py --daily-auto --today 2026-09-04 --only-job daily
```

Rotina completa da data do sistema:

```cmd
python main.py --daily-auto
```

A rotina diária planeja:

1. Venda Diária — sempre;
2. Venda Mensal — sempre;
3. Evento — conforme o calendário;
4. Fechamento Mensal — adicionalmente no dia 1.

Cada execução cria `data/runs/<run_id>/` e **sempre gera relatórios novos no SUPERUS**. Arquivos de execuções anteriores nunca substituem uma nova coleta.

## Perdas

GUI:

```cmd
python main.py --losses-gui
```

CLI:

```cmd
python main.py --losses-auto --inicio 01/09/2026 --fim 03/09/2026 --lojas 307,212,600,120,033,018
```

## Diagnósticos

```cmd
python main.py --inspect-environment
python main.py --inspect-superus
python main.py --inspect-sales-report
```

Scripts isolados usados durante a validação estão em `tools/`.

## Política de background

O fluxo normal não usa:

- `pyautogui`;
- mouse físico;
- teclado global;
- `SetForegroundWindow`;
- `BringWindowToTop`;
- `SetFocus`.

Os contadores proibidos devem permanecer em zero:

- `physical_mouse_moves`;
- `global_keyboard_uses`;
- `foreground_calls`.

`observed_focus_changes` e `observed_cursor_changes` são apenas observações do usuário trabalhando durante a automação e não são tratados como violação por si só.

## Supabase — Perdas

A integração HTM → parser → quality gates → UPSERT/read-back está documentada em `docs/supabase/losses.md`. O schema está em `sql/loss_period_snapshots.sql`.
