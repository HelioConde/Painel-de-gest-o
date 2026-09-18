from __future__ import annotations

import time
from dataclasses import dataclass

from src.superus.errors import ReportTimeoutError
from src.superus.windows import WM_CLOSE, Win32, comparable_text


@dataclass(frozen=True)
class PreviewResult:
    hwnd: int | None
    no_data: bool
    message: str | None = None


def preview_hwnds(win32: Win32) -> set[int]:
    return {hwnd for hwnd in win32.enum_top_windows() if win32.class_name(hwnd) == 'TFormPreview'}


def _export_save_dialog_hwnds(win32: Win32) -> list[int]:
    """Retorna somente diálogos de exportação conhecidos do SUPERUS.

    Não fecha qualquer #32770 global do Windows: isso poderia atingir diálogos
    de outros aplicativos (ou mensagens de segurança) enquanto o usuário
    trabalha.
    """
    allowed = {'salva o relatorio', 'salvar como', 'save as'}
    result: list[int] = []
    for hwnd in win32.enum_top_windows():
        if win32.class_name(hwnd) != '#32770':
            continue
        if comparable_text(win32.text(hwnd)) in allowed:
            result.append(hwnd)
    return result


def _close_best_effort(win32: Win32, hwnd: int, timeout: float) -> None:
    """Fecha uma janela de cleanup tolerando race de HWND já destruído."""
    if not win32.is_visible(hwnd):
        return
    sent = win32.post_if_present(hwnd, WM_CLOSE, 0, 0)
    if not sent:
        return
    # Se o VCL aceitou WM_CLOSE mas a janela ainda está processando o fechamento,
    # aguardamos; timeout aqui continua sendo erro real.
    if not win32.wait_hidden(hwnd, timeout):
        raise ReportTimeoutError(f'Janela hwnd={hwnd} não fechou durante cleanup.')


def close_preview(win32: Win32) -> None:
    for hwnd in list(preview_hwnds(win32)):
        _close_best_effort(win32, hwnd, 10)


def close_save_dialogs(win32: Win32) -> None:
    # Snapshot único evita loop infinito e é idempotente.
    for dialog in list(_export_save_dialog_hwnds(win32)):
        _close_best_effort(win32, dialog, 5)


def cleanup_export_state(win32: Win32) -> None:
    # Fechar diálogo antes do preview quando ambos ficaram de uma execução
    # abortada. Races de destruição entre enumeração e WM_CLOSE são ignorados
    # com segurança por post_if_present().
    close_save_dialogs(win32)
    close_preview(win32)


def _message_text(win32: Win32, hwnd: int) -> str:
    parts = [win32.text(hwnd)]
    parts.extend(item.text for item in win32.children(hwnd) if item.text)
    return ' '.join(parts).strip()


def close_message(win32: Win32, hwnd: int) -> None:
    buttons = [item for item in win32.children(hwnd) if item.class_name == 'TBitBtn']
    if buttons:
        win32.click(buttons[0].hwnd)
    else:
        win32.post(hwnd, 0x0010, 0, 0)
    win32.wait_hidden(hwnd, 5)


def wait_preview_or_no_data(
    win32: Win32,
    *,
    existing_hwnds: set[int] | None = None,
    timeout: float = 90.0,
    poll: float = 0.1,
) -> PreviewResult:
    ignored = existing_hwnds or set()
    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        fresh = [hwnd for hwnd in preview_hwnds(win32) if hwnd not in ignored]
        if fresh:
            return PreviewResult(fresh[0], False)
        msg = win32.find_window('TFormMensagem')
        if msg:
            text = _message_text(win32, msg)
            if any(token in text.casefold() for token in ('sem registro', 'nenhum registro', 'não existem dados', 'nao existem dados')):
                close_message(win32, msg)
                return PreviewResult(None, True, text)
        time.sleep(poll)
    raise ReportTimeoutError('TFormPreview não abriu dentro do timeout.')
