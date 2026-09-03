# Painel de Gestão

Base inicial do novo **Painel de Gestão**, preparada sem migrar código ou dados de projetos anteriores.

## Stack

- Frontend: React + TypeScript + Vite
- Backend: Python
- Banco futuro: Supabase
- Fonte futura: SUPERUS

## Estrutura

- `frontend/`: interface web independente
- `backend/`: automação, parsing e regras futuras, independente do frontend
- `legacy/`: espaços de referência vazios; nenhum legado foi copiado
- `docs/`: decisões de arquitetura e UI/UX

O contrato planejado é: **SUPERUS → Backend Python → Supabase → Frontend React**. O frontend não lê arquivos locais do backend.

## Executar

### Frontend

```powershell
Set-Location 'C:\Painel de gestão\frontend'
npm install
npm run dev
```

### Backend

```powershell
Set-Location 'C:\Painel de gestão\backend'
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
pytest
```

Nesta fase não há automação do SUPERUS, integração Supabase, SQL de produção, dados reais ou geração de Excel.
