from __future__ import annotations

import time
from pathlib import Path

from src.config.settings import Settings
from src.superus.errors import ControlNotFoundError, ExportError
from src.superus.windows import IDOK, WM_COMMAND, Win32, comparable_text

# CONFIRMADO em teste real no TFormPreview em 04/09/2026.
# O HTM é um botão gráfico Delphi sem HWND próprio. A forma correta de acioná-lo
# em background é enviar WM_LBUTTONDOWN/UP LOCAL ao TPanel INSTANCE 1.
DEFAULT_HTML_X = 437
DEFAULT_HTML_Y = 16


def wait_file_stable(
    path: Path,
    poll_seconds: float = 0.15,
    stable_reads: int = 3,
    timeout: float = 60.0,
) -> Path:
    stable = 0
    previous_size = -1
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        if path.exists():
            size = path.stat().st_size
            try:
                with path.open('rb') as handle:
                    handle.read(8)
            except OSError:
                stable = 0
            else:
                if size > 0 and size == previous_size:
                    stable += 1
                    if stable >= stable_reads:
                        return path
                else:
                    stable = 0
                    previous_size = size
        time.sleep(poll_seconds)
    raise ExportError(f'Arquivo não ficou estável: {path}')


def wait_export_panel(win32: Win32, preview: int, x: int, y: int, timeout: float = 10.0) -> int:
    panel = win32.control_by_instance(preview, 'TPanel', 1)
    deadline = time.monotonic() + timeout
    previous = (-1, -1)
    stable = 0
    while time.monotonic() < deadline:
        current = next(item for item in win32.children(preview) if item.hwnd == panel.hwnd)
        if current.width > x + 15 and current.height > y + 5:
            dims = (current.width, current.height)
            if dims == previous:
                stable += 1
                if stable >= 3:
                    return panel.hwnd
            else:
                stable = 0
                previous = dims
        time.sleep(0.1)
    raise ExportError('Painel de exportação do preview não ficou pronto.')


def _find_save_dialog(win32: Win32) -> int | None:
    # O diálogo real desta instalação aparece como "Salva o relatório".
    # Não usar fallback para qualquer #32770: o Windows e outros aplicativos
    # também usam essa classe e a automação não pode capturar/fechar um diálogo
    # alheio ao SUPERUS.
    for expected in ('Salva o relatório', 'Salvar Como', 'Save As'):
        dialog = win32.find_window('#32770', title_contains=expected)
        if dialog:
            return dialog
    return None


def _filename_edit(win32: Win32, dialog: int):
    # No Common Dialog observado existe um Edit visível para "Nome:". O legado
    # também usava Edit INSTANCE 1, portanto essa é a primeira opção.
    try:
        return win32.control_by_instance(dialog, 'Edit', 1)
    except ControlNotFoundError:
        edits = [
            item for item in win32.children(dialog)
            if item.class_name == 'Edit' and item.visible and item.enabled
        ]
        if not edits:
            raise ExportError('Campo Nome do diálogo de salvamento não foi encontrado.')
        edits.sort(key=lambda item: item.top, reverse=True)
        return edits[0]


def _save_button(win32: Win32, dialog: int):
    for item in win32.children(dialog):
        if item.class_name != 'Button' or not item.visible or not item.enabled:
            continue
        if comparable_text(item.text) in {'salvar', 'save'}:
            return item
    # Compatibilidade com a automação antiga: Button INSTANCE 2.
    try:
        return win32.control_by_instance(dialog, 'Button', 2)
    except ControlNotFoundError:
        return None


def save_as(win32: Win32, destination: Path, timeout: float = 20.0) -> None:
    dialog = win32.wait(lambda: _find_save_dialog(win32), timeout, 'Salva o relatório')
    edit = _filename_edit(win32, dialog)
    win32.set_text(edit.hwnd, str(destination), verify=False)

    button = _save_button(win32, dialog)
    if button is not None:
        win32.click(button.hwnd)
    else:
        win32.post(dialog, WM_COMMAND, IDOK, 0)

    if not win32.wait_hidden(dialog, timeout):
        raise ExportError('Diálogo de salvamento não fechou após acionar Salvar.')


def export_preview_as_htm(
    win32: Win32,
    preview: int,
    destination: Path,
    settings: Settings | None = None,
) -> Path:
    if destination.exists():
        raise ExportError(f'Arquivo alvo já existe; fresh collection exige caminho novo: {destination}')
    destination.parent.mkdir(parents=True, exist_ok=True)

    x = settings.superus_export_html_x if settings else DEFAULT_HTML_X
    y = settings.superus_export_html_y if settings else DEFAULT_HTML_Y
    panel = wait_export_panel(win32, preview, x, y)

    # Confirmado no teste real: o HTM não possui HWND/menu/command_id próprio.
    # Clique local no TPanel não movimenta o cursor físico.
    for _attempt in range(2):
        win32.virtual_click(panel, x, y)
        deadline = time.monotonic() + 2.5
        while time.monotonic() < deadline:
            if _find_save_dialog(win32):
                break
            time.sleep(0.1)
        if _find_save_dialog(win32):
            break

    if not _find_save_dialog(win32):
        raise ExportError('Salva o relatório não abriu após acionar o ícone HTM do TFormPreview.')

    save_as(win32, destination, timeout=settings.superus_save_timeout if settings else 20.0)
    return wait_file_stable(
        destination,
        timeout=settings.superus_file_timeout if settings else 60.0,
    )
