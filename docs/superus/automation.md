# Automação SUPERUS

A automação consolidada está documentada em [`AUTOMACAO_COMPLETA.md`](AUTOMACAO_COMPLETA.md).

O backend usa mensagens Win32 direcionadas por HWND. `pywin32` é usado quando disponível para preservar o comportamento comprovado do menu nativo; há fallback `ctypes` para as primitivas Win32. O fluxo normal não usa mouse físico, teclado global nem chamadas `SetForegroundWindow`, `BringWindowToTop` ou `SetFocus`.

## Diagnóstico

```cmd
python main.py --inspect-environment
python main.py --inspect-superus
python main.py --inspect-sales-report
```

## Vendas

```cmd
python main.py --plan
python main.py --daily-auto --dry-run
python main.py --daily-auto --only-job daily
python main.py --daily-auto
```

## Perdas

```cmd
python main.py --losses-gui
```

ou:

```cmd
python main.py --losses-auto --inicio 01/09/2026 --fim 03/09/2026 --lojas 307,212,600,120,033,018
```

Mapeamento interno: 307→17, 212→15608, 600→63395, 120→66471, 033→72731 e 018→74964.
