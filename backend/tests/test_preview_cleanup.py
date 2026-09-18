from __future__ import annotations

from src.superus.preview import cleanup_export_state


class FakeWin32Race:
    def __init__(self) -> None:
        self.alive = {100: True}
        self.post_calls: list[tuple[int, int]] = []

    def enum_top_windows(self):
        return [100]

    def class_name(self, hwnd: int) -> str:
        return 'TFormPreview' if hwnd == 100 else ''

    def text(self, hwnd: int) -> str:
        return ''

    def is_visible(self, hwnd: int) -> bool:
        return bool(self.alive.get(hwnd))

    def post_if_present(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> bool:
        self.post_calls.append((hwnd, message))
        # Simula o race observado: a janela desaparece entre enumeração e PostMessage.
        self.alive[hwnd] = False
        return False

    def wait_hidden(self, hwnd: int, timeout: float = 10.0) -> bool:
        return not self.alive.get(hwnd, False)


def test_cleanup_ignores_preview_destroyed_between_enum_and_close() -> None:
    fake = FakeWin32Race()
    cleanup_export_state(fake)  # type: ignore[arg-type]
    assert fake.post_calls == [(100, 0x0010)]


class FakeWin32Dialogs:
    def __init__(self) -> None:
        self.closed: list[int] = []

    def enum_top_windows(self):
        return [1, 2, 3]

    def class_name(self, hwnd: int) -> str:
        return '#32770' if hwnd in {1, 2} else 'Other'

    def text(self, hwnd: int) -> str:
        return {1: 'Salva o relatório', 2: 'Segurança', 3: ''}.get(hwnd, '')

    def is_visible(self, hwnd: int) -> bool:
        return True

    def post_if_present(self, hwnd: int, message: int, wparam: int = 0, lparam: int = 0) -> bool:
        self.closed.append(hwnd)
        return True

    def wait_hidden(self, hwnd: int, timeout: float = 10.0) -> bool:
        return True


def test_cleanup_does_not_close_unrelated_32770_dialog() -> None:
    fake = FakeWin32Dialogs()
    cleanup_export_state(fake)  # type: ignore[arg-type]
    assert fake.closed == [1]
