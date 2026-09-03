# Arquitetura

```text
SUPERUS
  ↓
Backend Python
  ↓
Supabase (fase futura)
  ↓
Frontend React
```

O backend concentra automação do SUPERUS, leitura de relatórios, regras de negócio, validações e persistência. O frontend consome contratos de API/dados publicados; ele nunca lê diretamente arquivos locais do backend.

HTML/HTM será o formato técnico preferencial para futuras exportações do SUPERUS, pois tende a preservar a separação dos campos. TXT e XLS são fallbacks; PDF não será fonte primária de dados.
