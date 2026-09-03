from dataclasses import asdict, dataclass

from src.superus.errors import ControlStateError
from src.superus.windows import BST_CHECKED, VK_F11, WM_KEYDOWN, WM_KEYUP, Win32

REQUIRED_STATES = {
    ('TRadioButton', 3): True,
    ('TCheckBox', 5): True, ('TCheckBox', 3): True, ('TCheckBox', 4): True,
    ('TCheckBox', 28): True, ('TCheckBox', 1): False, ('TCheckBox', 40): True,
}


@dataclass(frozen=True)
class ReportConfiguration:
    store: str
    start: str
    end: str
    controls: dict[str, object]

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def open_reports(win32: Win32, pedidos: int) -> int:
    win32.post(pedidos, WM_KEYDOWN, VK_F11)
    win32.post(pedidos, WM_KEYUP, VK_F11)
    return win32.wait_window('TFormRelPedidos', 20)


def configure_products(win32: Win32, report: int, store_code: str, start: str, end: str) -> ReportConfiguration:
    controls: dict[str, object] = {}
    for (class_name, instance), desired in REQUIRED_STATES.items():
        control = win32.control_by_instance(report, class_name, instance)
        win32.set_checked(control, desired)
        actual = win32.send(control.hwnd, 0x00F0) == BST_CHECKED
        if actual != desired:
            raise ControlStateError(f'{class_name} {instance} não confirmou estado obrigatório.')
        controls[f'{class_name}_{instance}'] = actual
    # Campos de loja/data são mantidos fora da configuração até confirmação por inspect.
    raise ControlStateError('Aba Produtos e controles TComboEdit/TSimusDateTimePicker exigem confirmação no inspect.')
