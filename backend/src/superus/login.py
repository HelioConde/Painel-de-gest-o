from __future__ import annotations

import time

from src.config.settings import Settings
from src.superus.errors import ControlNotFoundError, SuperusError
from src.superus.windows import Win32

LOGIN_CLASS = 'TFormLogonUsuario'


def find_login(win32: Win32) -> int | None:
    """Localiza a tela real de login desta instalação do SUPERUS.

    Classe confirmada no Spy++ em 04/09/2026:
      TFormLogonUsuario

    O fallback por título evita quebra se a versão mudar o caption mantendo a
    mesma tela.
    """
    return win32.find_window(LOGIN_CLASS) or win32.find_window(title_contains='Logon de Usu')


def cancel_stock_dialog_if_present(win32: Win32) -> bool:
    dialog = win32.find_window('TFormRelEstMin_ProdEstrategico') or win32.find_window(
        title_contains='Estoque Mínimo de Produtos Estratégicos'
    )
    if not dialog:
        return False
    try:
        button = win32.control_by_instance(dialog, 'TBitBtn', 1)
    except ControlNotFoundError:
        buttons = [item for item in win32.children(dialog) if item.class_name == 'TBitBtn']
        if not buttons:
            raise
        button = buttons[0]
    win32.click(button.hwnd)
    if not win32.wait_hidden(dialog, 10):
        raise SuperusError('Popup de Estoque Mínimo não fechou.')
    return True


def _login_ok_button(win32: Win32, login: int):
    # Spy++ confirmou TBitBtn "&OK". O INSTANCE 2 permanece como fallback
    # compatível com o fluxo legado.
    try:
        return win32.control_by_text(login, 'TBitBtn', 'OK')
    except ControlNotFoundError:
        return win32.control_by_instance(login, 'TBitBtn', 2)


def login_if_present(win32: Win32, settings: Settings, timeout: float = 60.0) -> bool:
    login = find_login(win32)
    if not login:
        return False

    username, password = settings.require_credentials()

    # Confirmado por Spy++ e por teste real:
    # TEdit INSTANCE 1 = senha
    # TEdit INSTANCE 2 = usuário
    user = win32.control_by_instance(login, 'TEdit', 2)
    pwd = win32.control_by_instance(login, 'TEdit', 1)
    ok = _login_ok_button(win32, login)

    with win32.background_step('login'):
        # Delphi/VCL pode aceitar WM_SETTEXT e não expor readback confiável para
        # outro processo. O quality gate real do login é a transição para o menu,
        # por isso não abortamos por readback de TEdit.
        # Usuário não é segredo e deve ter readback exato. Isso detecta de
        # imediato qualquer regressão ANSI/Unicode no TEdit do SUPERUS.
        win32.set_text(user.hwnd, username, verify=True)

        # Senha não é relida nem registrada. A validação definitiva continua
        # sendo a transição do TFormLogonUsuario para TFormMenuPrincipal.
        win32.set_text(pwd.hwnd, password, verify=False)
        win32.click(ok.hwnd)

    deadline = time.monotonic() + timeout
    while time.monotonic() < deadline:
        cancel_stock_dialog_if_present(win32)
        if win32.find_window('TFormMenuPrincipal') or win32.find_window('TFormVendas'):
            return True
        time.sleep(0.1)

    if find_login(win32):
        raise SuperusError(
            'TFormLogonUsuario continua aberto após o login. Verifique usuário/senha '
            'ou alguma mensagem apresentada pelo SUPERUS.'
        )
    raise SuperusError('Login enviado, mas o menu principal não apareceu.')


def ensure_menu(win32: Win32, timeout: float = 60.0) -> int:
    deadline = time.monotonic() + timeout
    stable = 0
    last = None
    while time.monotonic() < deadline:
        cancel_stock_dialog_if_present(win32)
        current = win32.find_window('TFormMenuPrincipal')
        # A janela pode existir antes de o TMainMenu estar populado. O teste real
        # confirmou que, depois de estabilizar, Vendas > Vendas é command_id=47.
        menu_ready = bool(current and win32.menu_item_count(current) > 0)
        if menu_ready and current == last:
            stable += 1
            if stable >= 4:
                return current
        else:
            stable = 0
            last = current if menu_ready else None
        time.sleep(0.2)
    raise SuperusError('TFormMenuPrincipal apareceu, mas o menu nativo não ficou pronto.')
