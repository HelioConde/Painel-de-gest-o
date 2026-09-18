# Diagnósticos isolados do SUPERUS

Esses scripts foram usados para validar cada etapa na máquina real sem alterar o cursor físico nem usar teclado global.

- `teste_login_superus.py`: valida `TFormLogonUsuario`, usuário, senha e OK.
- `teste_abrir_vendas.py`: valida `TFormMenuPrincipal -> Vendas > Vendas -> TFormVendas`.
- `teste_configurar_vendas.py`: configura Setorização, Por Loja, Todas Vendas, SubGrupo e período, parando antes de gerar.
- `teste_botao_htm_local.py`: valida o ícone HTM do `TPanel INSTANCE 1` usando coordenada local `437,16`.
- `teste_salvar_htm.py`: salva um diálogo HTM já aberto e valida o arquivo.

O fluxo de produção está em `src/superus/` e deve ser executado por `main.py`.
