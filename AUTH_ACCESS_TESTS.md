# Checklist manual de acesso

## Gerência

- [ ] `#/eventos` permite acesso.
- [ ] `#/diaria` permite acesso.
- [ ] `#/mensal` permite acesso.
- [ ] `#/cartazes` e `#/cartazes/admin-layout` permitem acesso.
- [ ] `#/analise-ia` abre somente o modo Vendas.
- [ ] `#/perdas` redireciona para `#/eventos`.
- [ ] Solicitação de IA com `analysisType: losses` recebe `403 FORBIDDEN`.

## Prevenção

- [ ] `#/perdas` permite acesso, incluindo Top Perdas e Pesquisa.
- [ ] `#/analise-ia` abre somente o modo Perdas.
- [ ] `#/eventos`, `#/diaria`, `#/mensal` e `#/cartazes` redirecionam para `#/perdas`.
- [ ] Solicitação de IA com `analysisType: sales` recebe `403 FORBIDDEN`.

## Administrador

- [ ] Todas as rotas permitem acesso.
- [ ] `#/analise-ia` exibe Vendas e Perdas.
- [ ] Ambas as chamadas de IA retornam sucesso quando Gemini está disponível.

## Sessão

- [ ] Atualizar a página mantém a sessão.
- [ ] Abrir outra aba mantém a sessão.
- [ ] `Sair` volta para `#/login`.
- [ ] Perfil com `active = false` é encerrado e exibe a mensagem de desativação.
