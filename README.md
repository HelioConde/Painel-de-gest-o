# Painel de Gestão

Projeto unificado com **frontend React + TypeScript + Vite** e **backend Python**. O frontend e o backend são independentes; a integração futura entre eles é via Supabase.

## Estrutura

- `frontend/` — interface web React.
- `backend/` — planner, automação do SUPERUS, parser/quality gates e integrações.
- `legacy/` — referências, não usadas como fonte de coleta de produção.
- `docs/` — arquitetura, UI/UX e documentação do SUPERUS.

Fluxo arquitetural:

**SUPERUS → Backend Python → Supabase → Frontend React**

O frontend nunca lê arquivos locais do backend.

## Backend — automação já implementada

O backend contém dois fluxos de automação:

- **Vendas:** rotina diária orientada pelo planner (`DAILY`, `MONTHLY`, `EVENT` e `MONTHLY_CLOSE` no dia 1).
- **Perdas:** coleta manual por período e lojas, via GUI ou CLI.

As coletas usam **HTM novo em toda execução**. Nenhum relatório antigo é reutilizado para evitar uma nova automação no SUPERUS.

Documentação completa: `docs/superus/AUTOMACAO_COMPLETA.md`.

## Preparar backend na máquina com SUPERUS

```cmd
cd /d "C:\Painel de gestão\backend"
python -m venv .venv
.venv\Scripts\activate
python -m pip install --upgrade pip
pip install -r requirements.txt
copy .env.example .env
```

Depois configure `backend\.env`.

### Vendas

```cmd
python main.py --plan
python main.py --daily-auto --dry-run
python main.py --daily-auto --only-job daily
python main.py --daily-auto
```

### Perdas

```cmd
python main.py --losses-gui
```

ou:

```cmd
python main.py --losses-auto --inicio 01/09/2026 --fim 03/09/2026 --lojas 307,212,600,120,033,018
```

### Testes

```cmd
python -m pytest
python -m ruff check .
```

## Frontend

Na máquina com Node/npm:

```cmd
cd /d "C:\Painel de gestão\frontend"
npm install
npm run dev
```
