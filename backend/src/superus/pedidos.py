from src.superus.errors import ControlNotFoundError
from src.superus.windows import Win32


def cancel_stock_dialog_if_present(win32: Win32) -> bool:
    dialog = win32.find_window('TFormRelEstMin_ProdEstrategico')
    if not dialog:
        return False
    candidates = [item for item in win32.children(dialog) if item.text.casefold() in {'cancelar', 'fechar'}]
    if not candidates:
        candidates = [item for item in win32.children(dialog) if item.class_name == 'TBitBtn']
    if not candidates:
        raise ControlNotFoundError('Botão Cancelar/Fechar não localizado no popup de estoque.')
    win32.click(candidates[0].hwnd)
    win32.wait(lambda: not win32.find_window('TFormRelEstMin_ProdEstrategico'), 10, 'Fechamento do popup')
    return True


def open_pedidos(win32: Win32, menu: int) -> int:
    """Exige mapeamento de WM_COMMAND obtido pelo inspect; nunca usa mouse."""
    del win32, menu
    raise RuntimeError('Menu Faturamento > Pedidos requer ID WM_COMMAND confirmado por inspect.')
