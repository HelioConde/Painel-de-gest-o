# Versão corrigida — Automação Vendas + Perdas

Data da preparação: 04/09/2026.

## O que foi corrigido

- Removida a dependência do experimento incompleto que aguardava `TFormVendas` sem executar o fluxo comprovado.
- Consolidada a camada Win32 a partir da automação do SUPERUS que já havia funcionado no projeto anterior.
- Abertura de `Vendas > Vendas` e `Faturamento > Pedidos` por comando do menu nativo, sem mouse físico/teclado global.
- O sistema agora aguarda o `TFormMenuPrincipal` **e o menu nativo possuir itens** antes de navegar; isso corrige o caso observado em que `GetMenu` existia mas `GetMenuItemCount` ainda retornava 0.
- Implementados login, popup de estoque mínimo, `TFormVendas`, `TFormPedidos`, F11 direcionado, `TFormRelPedidos`, aba Produtos, controles, datas, preview e Save As.
- Exportação principal migrada para HTM.
- Planner diário preservado e separado da automação.
- Fresh collection preservado: todo run gera arquivos novos.
- Implementada automação de Perdas por período/lojas com current e ano anterior.
- Adicionada GUI simples para Perdas.
- Reforçado quality gate das seis lojas no HTM de vendas usando os cabeçalhos completos das lojas, não apenas códigos de três dígitos.

## Validação executada neste pacote

- `pytest`: **43/43 PASS**.
- `compileall`: PASS.
- `--plan --today 2026-09-04`: PASS.
- `--daily-auto --today 2026-09-04 --dry-run`: PASS.

A interação real com o SUPERUS não pode ser executada neste ambiente Linux. O primeiro teste real deve ser realizado no PC Windows do SUPERUS com `--only-job daily` antes de liberar a rotina diária inteira.

## Primeiro teste na máquina do SUPERUS

```cmd
cd /d "C:\Painel de gestão\backend"
.venv\Scripts\activate
pip install -r requirements.txt
python main.py --daily-auto --today 2026-09-04 --only-job daily
```

Depois, se DAILY current/previous gerar e validar os dois HTMs:

```cmd
python main.py --daily-auto
```

Para Perdas:

```cmd
python main.py --losses-gui
```

## Correção 2026-09-04 — login SUPERUS

Corrigido o readback dos controles Delphi `TEdit` do login. `GetWindowTextW` não é confiável para ler texto de controles filhos pertencentes a outro processo; o wrapper Win32 agora usa `WM_GETTEXT/WM_GETTEXTLENGTH` como fallback. O usuário continua validado por readback, enquanto a senha é escrita sem tentar relê-la (campos de senha podem bloquear readback por segurança) e é validada pela transição para o menu do SUPERUS.
