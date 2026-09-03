# Backend

Estrutura modular Python para o Painel de Gestão.

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python main.py
pytest
```

Os módulos `superus/` e `supabase/` são apenas contratos de arquitetura nesta fase: não iniciam automação nem fazem conexões externas.
