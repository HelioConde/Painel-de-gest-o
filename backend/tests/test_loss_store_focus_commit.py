from dataclasses import dataclass

from src.superus.reports import set_loss_store


@dataclass
class _Control:
    hwnd: int
    class_name: str
    text: str = ''
    visible: bool = True
    instance: int = 1


class _FakeWin32:
    def __init__(self) -> None:
        self.origin = _Control(101, 'TComboEdit', instance=3)
        self.destination = _Control(102, 'TComboEdit', instance=2)
        self.initial_date = _Control(103, 'TSimusDateTimePicker', instance=2)
        self.origin_name = _Control(201, 'TEdit', instance=1)
        self.destination_name = _Control(202, 'TEdit', instance=2)
        self.clicks: list[int] = []
        self.keys: list[tuple[int, int]] = []
        self._map = {
            101: self.origin,
            102: self.destination,
            103: self.initial_date,
            201: self.origin_name,
            202: self.destination_name,
        }

    def control_by_instance(self, _parent: int, class_name: str, instance: int):
        if class_name == 'TComboEdit' and instance == 3:
            return self.origin
        if class_name == 'TComboEdit' and instance == 2:
            return self.destination
        if class_name == 'TSimusDateTimePicker' and instance == 2:
            return self.initial_date
        raise AssertionError((class_name, instance))

    def set_text(self, hwnd: int, value: str, *, verify: bool = True) -> None:
        del verify
        self._map[hwnd].text = value

    def send_key(self, hwnd: int, vk: int) -> None:
        self.keys.append((hwnd, vk))

    def virtual_click(self, hwnd: int, x=None, y=None) -> None:
        del x, y
        self.clicks.append(hwnd)
        # Simula exatamente o comportamento observado no FormRelPedidos:
        # o nome só é resolvido quando o TComboEdit anterior perde o foco.
        if hwnd == self.destination.hwnd and self.origin.text == '17':
            self.origin_name.text = 'SUPERMERCADO PRIMOR 01 307'
        if hwnd == self.initial_date.hwnd and self.destination.text == '17':
            self.destination_name.text = 'SUPERMERCADO PRIMOR 01 307'

    def text(self, hwnd: int) -> str:
        return self._map[hwnd].text

    def children(self, _parent: int):
        return [
            self.origin,
            self.destination,
            self.initial_date,
            self.origin_name,
            self.destination_name,
        ]


def test_loss_store_commits_origin_and_destination_by_focus_loss() -> None:
    win32 = _FakeWin32()

    set_loss_store(win32, 999, '307')

    assert win32.origin.text == '17'
    assert win32.destination.text == '17'
    assert win32.origin_name.text == 'SUPERMERCADO PRIMOR 01 307'
    assert win32.destination_name.text == 'SUPERMERCADO PRIMOR 01 307'

    # A correção central: Origem perde foco em Destino; Destino perde foco
    # na Data Inicial. Nenhum mouse físico é usado.
    assert win32.clicks == [win32.destination.hwnd, win32.initial_date.hwnd]
