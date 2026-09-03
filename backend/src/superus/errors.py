class SuperusError(RuntimeError):
    """Falha base da automação do SUPERUS."""


class WindowNotFoundError(SuperusError):
    """A janela esperada não apareceu no tempo limite."""


class ControlNotFoundError(SuperusError):
    """O controle esperado não foi encontrado."""


class ControlStateError(SuperusError):
    """Um controle não atingiu o estado obrigatório."""


class ReportTimeoutError(SuperusError):
    """O preview do relatório não apareceu no tempo limite."""


class ExportError(SuperusError):
    """A exportação HTM falhou."""


class ReportValidationError(SuperusError):
    """O HTM exportado não passou na validação mínima."""
