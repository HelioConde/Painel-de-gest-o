# Automação SUPERUS — fase 2

A automação usa somente `ctypes` e mensagens Win32 direcionadas por HWND. O fluxo normal não contém mouse físico, teclado global nem chamadas de foreground; os três contadores de auditoria permanecem zero.

Janelas iniciais: `TFormMenuPrincipal`, `TFormPedidos`, `TFormRelPedidos`, `TFormPreview`, `TFormMensagem` e `TFormRelEstMin_ProdEstrategico`. Classes, captions e instances devem ser confirmadas por `python main.py --inspect-superus`, que cria `data/diagnostics/<run_id>/controls.json`.

Comandos:

```powershell
python main.py --inspect-superus
python main.py --collect-one --loja 307 --inicio 01/09/2026 --fim 01/09/2026 --stop-before-generate
python main.py --collect-one --loja 307 --inicio 01/09/2026 --fim 01/09/2026
```

O HTM é o formato alvo. `wait_file_stable` exige arquivo existente, não vazio, legível e com tamanho estável. A coleta falha fechada enquanto o inspect não comprovar: o comando do menu Pedidos, a aba Produtos, os campos de loja/data, o botão de gerar e o controle de exportação do preview.

## Descoberta do ambiente

As lojas possuem mapeamento canônico no código: 307→17, 212→15608, 600→63395, 120→66471, 033→72731 e 018→74964. Esses valores não são segredos e não pertencem ao `.env`.

Use `python main.py --inspect-environment` antes de qualquer coleta. A prioridade é uma sessão existente, seguida por `SUPERUS_LAUNCHER_PATH`, `C:\Superus\Launcher.exe`, `SUPERUS_EXECUTABLE_PATH` e `C:\Superus\Superus.exe`. Paths vazios são aceitos; nenhum candidato ambíguo é executado.
