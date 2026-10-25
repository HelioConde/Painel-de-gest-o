<div align="center">
  <h1>📊 Painel de Gestão</h1>
  <p><strong>Indicadores de vendas, perdas e operação para apoiar decisões no varejo.</strong></p>
  <p>Interface React com backend Python e integração de dados planejada por meio do Supabase.</p>
  <p>
    <img alt="React e TypeScript" src="https://img.shields.io/badge/React%20%2B%20TypeScript-Frontend-149ECA">
    <img alt="Python" src="https://img.shields.io/badge/Python-Automa%C3%A7%C3%A3o-3776AB?logo=python&logoColor=white">
    <img alt="Status" src="https://img.shields.io/badge/status-em%20evolu%C3%A7%C3%A3o-64748b">
  </p>
</div>

## O que é

Um projeto com **dois módulos independentes**: um frontend para visualizar indicadores e emitir relatórios; e um backend que planeja, extrai e valida informações do sistema autorizado **SUPERUS**.

> **Acesso controlado:** as rotinas de coleta são específicas de um ambiente com SUPERUS instalado e permissão de uso. O repositório não fornece acesso ao sistema, credenciais, dados privados nem conexão automática a qualquer supermercado.

## Arquitetura

```text
SUPERUS (ambiente autorizado)
          │
          ▼
Backend Python — planner, coleta e validação
          │
          ▼
Supabase — integração e persistência conforme ambiente
          │
          ▼
Frontend React — indicadores, relatórios e visualização
```

Os componentes podem evoluir separadamente; o frontend **não lê arquivos locais** do backend.

| Pasta | Conteúdo |
| --- | --- |
| `frontend/` | React, TypeScript, Vite, relatórios e interfaces |
| `backend/` | Python, automação e validação de dados |
| `docs/` | Arquitetura, UX e operação com SUPERUS |
| `supabase/` | Configurações e integração do banco |
| `legacy/` | Referências históricas preservadas |

## Funcionalidades documentadas

**Frontend:** relatórios, indicadores e consulta de vendas por datas, com rotinas de QA para histórico diário, layout, versão mobile e impressão de eventos.

**Backend:** planejamento das coletas diárias, mensais, de eventos e de fechamento; extração de perdas por períodos e lojas. Os jobs de coleta trabalham com **relatórios HTM novos** para não confundir dados antigos com extração recente.

## Executar o frontend

Requer Node.js e npm compatíveis com a versão do Vite.

```bash
git clone https://github.com/HelioConde/Painel-de-gest-o.git
cd Painel-de-gest-o/frontend
npm install
npm run dev
```

Scripts adicionais definidos no `frontend/package.json`:

```bash
npm run build
npm run qa:daily
npm run qa:layout
npm run qa:reports
npm run qa:print-events
```

As verificações que abrem navegadores podem exigir autenticação ou Playwright configurado; a existência dos scripts **não significa que os testes foram executados nesta documentação**.

## Preparar o backend (ambiente autorizado)

Na pasta `backend/` do projeto, usando Python:

```cmd
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
```

Configure o arquivo `.env` com dados adequados ao ambiente **sem incluí-lo no Git**.

### Exemplos de comandos

```cmd
python main.py --plan
python main.py --daily-auto --dry-run
python main.py --losses-gui
```

Para os fluxos reais e seus pré-requisitos, consulte [AUTOMACAO_COMPLETA.md](docs/superus/AUTOMACAO_COMPLETA.md). A execução de coletas deve ser feita apenas onde houver autorização e acesso legítimo.

## Qualidade, segurança e limites

- Não publique relatórios, dados de funcionários, clientes ou números internos sem permissão.
- Mantenha segredos e URLs privadas em arquivos de ambiente ou mecanismos próprios de deploy.
- Verifique a origem, a data e a loja de cada relatório antes de interpretar resultados.
- Revise manualmente impressão, responsividade e integridade de gráficos nos relatórios mais importantes.
- Teste permissões do banco e perfis de acesso antes de hospedar dados operacionais.

**Documentos relacionados:** [Configurar autenticação](SETUP_AUTH.md) · [Auditoria de acesso](AUTH_DATA_ACCESS_AUDIT.md) · [Testes de acesso](AUTH_ACCESS_TESTS.md).

## Situação atual

**Em evolução.** O repositório reúne interface, automação e documentação, mas a implantação integrada depende da infraestrutura disponível e das permissões sobre os dados do sistema de origem.

Criado por [Hélio Conde](https://github.com/HelioConde).
