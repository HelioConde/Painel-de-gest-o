# Painel de Gestão — Indicadores e automação para o varejo

**Projeto com interface React e serviços Python para consolidar informações operacionais e apoiar análises de vendas e perdas.**

![React](https://img.shields.io/badge/React-frontend-149ECA?logo=react&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white) ![Python](https://img.shields.io/badge/Python-backend-3776AB?logo=python&logoColor=white) ![Status](https://img.shields.io/badge/status-em%20desenvolvimento-64748b)

## Arquitetura resumida

```text
SUPERUS → automação Python → Supabase → interface React
```

O frontend e o backend ficam em pastas separadas; a automação depende de configuração e acesso ao ambiente autorizado de origem. **Não há promessa de integração automática completa fora do ambiente configurado.**

| Área | Caminho | Foco |
| --- | --- | --- |
| Frontend | `frontend/` | Painéis e relatórios |
| Backend | `backend/` | Coleta, planejamento e validação |
| Documentação | `docs/` | Arquitetura, automação e UX |
| Histórico | `legacy/` | Referências preservadas |

**Desenvolvimento:** entre em `frontend/`, execute `npm install` e `npm run dev`. A preparação do backend e os testes estão detalhados abaixo.

---

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
