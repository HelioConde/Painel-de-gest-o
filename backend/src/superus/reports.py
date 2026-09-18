from __future__ import annotations

import json
import logging
import time
from dataclasses import asdict, dataclass
from datetime import date
from pathlib import Path

from src.config.settings import Settings
from src.config.stores import get_store
from src.superus.errors import ControlStateError
from src.superus.export_html import export_preview_as_htm
from src.superus.preview import close_preview, cleanup_export_state, preview_hwnds, wait_preview_or_no_data
from src.superus.windows import BM_GETCHECK, BST_CHECKED, VK_F11, VK_RETURN, WM_KEYDOWN, WM_KEYUP, Win32, comparable_text



def _safe_control_snapshot(win32: Win32, report: int) -> dict[str, object]:
    """Snapshot somente-leitura dos controles críticos de Perdas.

    Serve apenas para diagnóstico. Não envia mensagens que alterem estado.
    """
    def grab(class_name: str, instance: int) -> dict[str, object]:
        try:
            control = win32.control_by_instance(report, class_name, instance)
            return {
                'class': class_name,
                'instance': instance,
                'hwnd': control.hwnd,
                'text': win32.text(control.hwnd),
                'visible': control.visible,
                'enabled': control.enabled,
                'left': control.left,
                'top': control.top,
                'width': control.width,
                'height': control.height,
            }
        except Exception as exc:
            return {
                'class': class_name,
                'instance': instance,
                'error': f'{type(exc).__name__}: {exc}',
            }

    return {
        'report_hwnd': report,
        'origin': grab('TComboEdit', 3),
        'destination': grab('TComboEdit', 2),
        'date_initial': grab('TSimusDateTimePicker', 2),
        'date_final': grab('TSimusDateTimePicker', 1),
        'ok_button': grab('TBitBtn', 2),
        'products_radio': grab('TRadioButton', 3),
        'agrupa_itens': grab('TCheckBox', 5),
        'lista_compras_vendas_perdas': grab('TCheckBox', 4),
        'somente_pedidos': grab('TCheckBox', 28),
        'mip_todos': grab('TCheckBox', 40),
        'preview_hwnds': list(preview_hwnds(win32)),
        'background': win32.audit.as_dict(),
    }


def _log_loss_state(
    logger: logging.Logger | None,
    label: str,
    win32: Win32,
    report: int,
    **context: object,
) -> None:
    if not logger:
        return
    payload = {'label': label, **context, **_safe_control_snapshot(win32, report)}
    logger.info('[PERDAS STATE] %s', json.dumps(payload, ensure_ascii=False, default=str))


def _log_step(
    logger: logging.Logger | None,
    step: str,
    status: str,
    started: float,
    **context: object,
) -> None:
    if not logger:
        return
    payload = {
        'step': step,
        'status': status,
        'duration_ms': round((time.monotonic() - started) * 1000, 1),
        **context,
    }
    logger.info('[PERDAS STEP] %s', json.dumps(payload, ensure_ascii=False, default=str))

REQUIRED_STATES = {
    ('TRadioButton', 3): True,
    ('TCheckBox', 5): True,
    ('TCheckBox', 3): True,
    ('TCheckBox', 4): True,
    ('TCheckBox', 28): True,
    ('TCheckBox', 1): False,
    ('TCheckBox', 40): True,
}


@dataclass(frozen=True)
class ReportConfiguration:
    store: str
    start: str
    end: str
    controls: dict[str, object]

    def as_dict(self) -> dict[str, object]:
        return asdict(self)


def open_reports(win32: Win32, pedidos: int, logger: logging.Logger | None = None) -> int:
    if hwnd := win32.find_window('TFormRelPedidos'):
        return hwnd
    with win32.background_step('abrir_relatorios_pedidos', logger):
        win32.send_key(pedidos, VK_F11)
    return win32.wait_window('TFormRelPedidos', 30)


PRODUCTS_TAB_CLICK_POINTS = ((80, 12), (78, 12), (84, 12), (80, 15))


def _products_tab_is_active(win32: Win32, report: int) -> bool:
    """Confirma a aba Produtos pela UI real, não só pelo número INSTANCE.

    Na aba Pedidos também existem TRadioButton visíveis. A confirmação exige
    simultaneamente os captions específicos da aba Produtos.
    """
    try:
        radio = win32.control_by_instance(report, 'TRadioButton', 3)
        agrupa = win32.control_by_instance(report, 'TCheckBox', 5)
    except Exception:
        return False
    return (
        radio.visible
        and agrupa.visible
        and comparable_text(radio.text) == comparable_text('Produtos por MIP')
        and comparable_text(agrupa.text) == comparable_text('Agrupa Itens')
    )


def select_products_tab(
    win32: Win32,
    report: int,
    logger: logging.Logger | None = None,
) -> None:
    """Seleciona a aba Produtos sem usar TCM_* no TPageControl Delphi.

    IMPORTANTE: nesta versão do SUPERUS, enviar mensagens TCM_GETITEM*/
    TCM_SETCURSEL ao TPageControl VCL pode provocar Access Violation dentro
    de COMCTL32.dll/FormRelPedidos. Por isso o fluxo de Perdas NÃO chama
    ``select_tab_by_text`` nem qualquer TCM_* aqui.

    A estratégia segura é reproduzir o clique no cabeçalho da aba Produtos
    com WM_LBUTTONDOWN/WM_LBUTTONUP enviados diretamente ao HWND do
    TPageControl. É um clique LOCAL: não move o cursor físico, não usa foco
    e não traz a janela para frente.
    """
    if _products_tab_is_active(win32, report):
        if logger:
            logger.info('Aba Produtos já está ativa.')
        return

    page = win32.control_by_instance(report, 'TPageControl', 1)
    if not page.visible:
        raise ControlStateError('TPageControl INSTANCE 1 não está visível em TFormRelPedidos.')

    # A tela real possui as abas Pedidos / Produtos / Análises. O centro da
    # aba Produtos fica em torno de x=80, y=12 no client do TPageControl.
    # Tentamos poucos pontos próximos e validamos pelo conteúdo real da aba.
    for x, y in PRODUCTS_TAB_CLICK_POINTS:
        try:
            with win32.background_step(f'selecionar_aba_produtos_{x}_{y}', logger):
                win32.virtual_click(page.hwnd, x, y)
        except Exception as exc:
            if logger:
                logger.warning('Falha no clique local da aba Produtos x=%s y=%s: %s', x, y, exc)
            continue

        try:
            win32.wait(
                lambda: page.hwnd if _products_tab_is_active(win32, report) else 0,
                2.0,
                f'Aba Produtos via clique local ({x},{y})',
            )
            if logger:
                logger.info(
                    'Aba Produtos selecionada via clique local seguro no TPageControl x=%s y=%s.',
                    x,
                    y,
                )
            return
        except Exception:
            continue

    visible_radios = [
        item.text
        for item in win32.children(report)
        if item.class_name == 'TRadioButton' and item.visible
    ]
    visible_checks = [
        item.text
        for item in win32.children(report)
        if item.class_name == 'TCheckBox' and item.visible
    ]
    raise ControlStateError(
        'Não foi possível selecionar a aba Produtos por clique local seguro. '
        'TCM_* foi desabilitado nesta versão para evitar Access Violation do SUPERUS. '
        f'Radios visíveis={visible_radios!r}; checkboxes visíveis={visible_checks!r}'
    )

def _set_required_states(
    win32: Win32,
    report: int,
    logger: logging.Logger | None = None,
) -> dict[str, object]:
    if not _products_tab_is_active(win32, report):
        raise ControlStateError('Aba Produtos não está ativa antes da configuração de Produtos por MIP.')

    states: dict[str, object] = {}
    expected_captions = {
        ('TRadioButton', 3): 'Produtos por MIP',
        ('TCheckBox', 5): 'Agrupa Itens',
        ('TCheckBox', 4): 'Lista Compras, Vendas e Perda por Período',
    }

    for (class_name, instance), desired in REQUIRED_STATES.items():
        expected = expected_captions.get((class_name, instance))
        control = win32.control_by_instance_or_text(report, class_name, instance, expected)
        if not control.visible:
            raise ControlStateError(
                f'{class_name} {instance} está oculto; a aba Produtos pode não ter sido selecionada.'
            )
        before = win32.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        win32.set_checked(control, desired)
        actual = win32.send(control.hwnd, BM_GETCHECK) == BST_CHECKED
        if actual != desired:
            raise ControlStateError(f'{class_name} {instance} não confirmou estado obrigatório {desired}.')
        states[f'{class_name}_{instance}'] = {
            'text': control.text,
            'before': before,
            'after': actual,
            'desired': desired,
        }
        if logger:
            logger.info(
                '[PERDAS CONFIG] %s INSTANCE %s text=%r before=%s after=%s desired=%s',
                class_name, instance, control.text, before, actual, desired,
            )

    group18 = win32.control_by_instance(report, 'TGroupButton', 18)
    if not group18.visible:
        raise ControlStateError('TGroupButton 18 está oculto na configuração de Perdas.')
    win32.virtual_click(group18.hwnd)
    states['TGroupButton_18'] = {'text': group18.text, 'selected_or_clicked': True}
    if logger:
        logger.info('[PERDAS CONFIG] TGroupButton INSTANCE 18 text=%r selecionado.', group18.text)
    return states


WM_SETFOCUS = 0x0007
WM_KILLFOCUS = 0x0008


def _count_visible_store_names(win32: Win32, report: int, expected_name: str) -> int:
    """Conta ocorrências visíveis do nome da loja, independentemente da classe.

    No FormRelPedidos o nome resolvido de Origem/Destino pode aparecer em
    controles Delphi cuja INSTANCE varia entre execuções. A validação usa o
    texto exato visível e não depende de TEdit INSTANCE fixo.
    """
    wanted = comparable_text(expected_name)
    return sum(
        1
        for control in win32.children(report)
        if control.visible and comparable_text(control.text) == wanted
    )


def _wait_visible_store_names(
    win32: Win32,
    report: int,
    expected_name: str,
    expected_count: int,
    timeout: float = 3.0,
) -> int:
    deadline = time.monotonic() + timeout
    last = 0
    while time.monotonic() < deadline:
        last = _count_visible_store_names(win32, report, expected_name)
        if last >= expected_count:
            return last
        time.sleep(0.10)
    return last


def _fill_combo_code_and_fire_exit(
    win32: Win32,
    *,
    report: int,
    hwnd: int,
    code: str,
    label: str,
    next_hwnd: int,
    expected_store_name: str,
    expected_name_count: int,
    logger: logging.Logger | None = None,
) -> str:
    """Preenche o TComboEdit e dispara explicitamente o evento de saída.

    No FormRelPedidos, escrever o código interno (ex.: 17) não basta. O
    SUPERUS resolve o lookup e preenche o nome da loja somente quando o campo
    Origem/Destino PERDE O FOCO. Um WM_LBUTTON enviado a outro HWND não
    necessariamente transfere o foco real do VCL, então a V6.1 podia deixar
    apenas o número visível.

    Esta versão mantém a base V6 e simula somente a transição local de foco do
    próprio controle: WM_SETFOCUS -> texto -> ENTER -> WM_KILLFOCUS, seguido
    de WM_SETFOCUS no próximo controle. Não chama SetFocus(), não ativa a
    janela, não usa teclado global e não move o mouse físico.
    """
    last = ''
    confirmed_names = 0

    for attempt in range(1, 4):
        # Mensagens síncronas para que o VCL execute OnEnter/OnExit na ordem.
        win32.send(hwnd, WM_SETFOCUS, 0, 0)
        win32.set_text(hwnd, code, verify=False)
        win32.send(hwnd, WM_KEYDOWN, VK_RETURN, 0)
        win32.send(hwnd, WM_KEYUP, VK_RETURN, 0)
        time.sleep(0.08)

        # A correção central: dispara a perda de foco do TComboEdit.
        win32.send(hwnd, WM_KILLFOCUS, next_hwnd, 0)
        win32.send(next_hwnd, WM_SETFOCUS, hwnd, 0)

        confirmed_names = _wait_visible_store_names(
            win32,
            report,
            expected_store_name,
            expected_name_count,
            timeout=2.5,
        )
        last = win32.text(hwnd).strip()

        if logger:
            logger.info(
                '[PERDAS LOJA] %s tentativa=%s codigo=%r readback=%r '
                'nomes_confirmados=%s/%s next_hwnd=0x%X',
                label,
                attempt,
                code,
                last,
                confirmed_names,
                expected_name_count,
                next_hwnd,
            )

        if last == code and confirmed_names >= expected_name_count:
            return last

    raise ControlStateError(
        f'{label} não resolveu a loja após perder o foco: codigo={code!r}, '
        f'lido={last!r}, nome_esperado={expected_store_name!r}, '
        f'nomes_confirmados={confirmed_names}/{expected_name_count}.'
    )


def validate_loss_store_state(
    win32: Win32,
    report: int,
    store_code: str,
    *,
    timeout: float = 3.0,
    logger: logging.Logger | None = None,
) -> None:
    """Confirma o par Origem/Destino pelo código interno da loja.

    V7.2:
    o texto visual com o nome resolvido da loja é apenas diagnóstico e NÃO
    participa mais do fail-closed desta etapa. Em alguns TEdit Delphi o nome
    aparece na tela, mas WM_GETTEXT/EnumChildWindows não o expõe de forma
    confiável (caso observado na loja 033).

    A segurança final continua fail-closed no HTM: validate_loss_html() exige
    período correto, loja correta e assinatura do relatório antes de marcar
    a coleta como PASS.
    """
    store = get_store(store_code)
    origin = win32.control_by_instance(report, 'TComboEdit', 3)
    destination = win32.control_by_instance(report, 'TComboEdit', 2)
    deadline = time.monotonic() + timeout
    last_origin = ''
    last_destination = ''
    last_names = 0

    while time.monotonic() < deadline:
        last_origin = win32.text(origin.hwnd).strip()
        last_destination = win32.text(destination.hwnd).strip()
        last_names = _count_visible_store_names(win32, report, store.name)

        if (
            last_origin == store.superus_code
            and last_destination == store.superus_code
        ):
            if logger:
                logger.info(
                    '[PERDAS LOJA] estado confirmado por codigo loja=%s codigo=%s '
                    'origem=%r destino=%r nomes_visiveis=%s '
                    '(nome visual apenas diagnostico)',
                    store.code,
                    store.superus_code,
                    last_origin,
                    last_destination,
                    last_names,
                )
            return

        time.sleep(0.10)

    raise ControlStateError(
        'Origem/Destino divergiram antes da geração: '
        f'loja={store.code} codigo_esperado={store.superus_code!r} '
        f'origem={last_origin!r} destino={last_destination!r} '
        f'nome_esperado={store.name!r} nomes_visiveis={last_names} '
        '(nome visual é apenas diagnóstico).'
    )


def _commit_combo_exit(
    win32: Win32,
    *,
    hwnd: int,
    next_hwnd: int,
) -> None:
    """Dispara ENTER + saída local do TComboEdit sem bloquear entre Origem/Destino."""
    win32.send(hwnd, WM_SETFOCUS, 0, 0)
    win32.send(hwnd, WM_KEYDOWN, VK_RETURN, 0)
    win32.send(hwnd, WM_KEYUP, VK_RETURN, 0)
    time.sleep(0.06)
    win32.send(hwnd, WM_KILLFOCUS, next_hwnd, 0)
    win32.send(next_hwnd, WM_SETFOCUS, hwnd, 0)


def set_loss_store(
    win32: Win32,
    report: int,
    store_code: str,
    logger: logging.Logger | None = None,
) -> None:
    """Troca Origem/Destino como um único par atômico de loja.

    Correção V6.4:
    a automação anterior resolvia Origem e só depois começava a escrever Destino.
    Se o SUPERUS demorasse ou travasse no commit da Origem, a tela podia ficar
    cruzada, por exemplo Origem=loja 05 e Destino=loja 04.

    Agora os DOIS códigos são escritos primeiro. Só depois são disparados os
    eventos de ENTER/saída de Origem e Destino. Não existe mais espera de lookup
    entre os dois campos. A validação ocorre apenas no final do par completo.

    Assim, na transição 04 -> 05, o Destino recebe 72731 antes mesmo de a Origem
    resolver "SUPERMERCADO PRIMOR 05 033". Se qualquer resolução falhar, nenhum
    relatório é gerado e o par inteiro é tentado novamente.

    IMPORTANTE V7.0:
    todas as lojas usam exatamente este mesmo fluxo. Não existe if/special-case
    para 033, 307 ou qualquer outra loja. A única diferença entre lojas é o
    código interno e o nome esperado vindos do cadastro STORES.
    """
    store = get_store(store_code)
    origin = win32.control_by_instance(report, 'TComboEdit', 3)
    destination = win32.control_by_instance(report, 'TComboEdit', 2)
    initial_date = win32.control_by_instance(report, 'TSimusDateTimePicker', 2)

    last_error: Exception | None = None

    for attempt in range(1, 4):
        before_origin = win32.text(origin.hwnd).strip()
        before_destination = win32.text(destination.hwnd).strip()

        if logger:
            logger.info(
                '[PERDAS LOJA] troca_atomica inicio loja=%s codigo=%s tentativa=%s '
                'origem_anterior=%r destino_anterior=%r',
                store.code,
                store.superus_code,
                attempt,
                before_origin,
                before_destination,
            )

        # ETAPA CRÍTICA: escrever os dois códigos ANTES de aguardar qualquer
        # resolução de lookup. Isso impede estado cruzado entre lojas.
        win32.set_text(origin.hwnd, store.superus_code, verify=False)
        win32.set_text(destination.hwnd, store.superus_code, verify=False)
        time.sleep(0.06)

        staged_origin = win32.text(origin.hwnd).strip()
        staged_destination = win32.text(destination.hwnd).strip()
        if logger:
            logger.info(
                '[PERDAS LOJA] troca_atomica staged loja=%s origem=%r destino=%r',
                store.code,
                staged_origin,
                staged_destination,
            )

        # Resolve Origem e transfere a saída local para Destino.
        _commit_combo_exit(
            win32,
            hwnd=origin.hwnd,
            next_hwnd=destination.hwnd,
        )
        # Tempo comum a TODAS as lojas para o VCL processar o OnExit/lookup.
        # Não existe tratamento especial para a 033.
        time.sleep(0.30)

        # Alguns handlers VCL podem reescrever o campo vizinho ao resolver
        # Origem. Reaplicamos o código esperado em Destino antes do seu commit.
        if win32.text(destination.hwnd).strip() != store.superus_code:
            win32.set_text(destination.hwnd, store.superus_code, verify=False)
            time.sleep(0.10)

        # Resolve Destino e sai para a Data Inicial.
        _commit_combo_exit(
            win32,
            hwnd=destination.hwnd,
            next_hwnd=initial_date.hwnd,
        )
        # Mesmo tempo de estabilização para qualquer loja.
        time.sleep(0.35)

        try:
            validate_loss_store_state(
                win32,
                report,
                store.code,
                timeout=8.0,
                logger=logger,
            )
            if logger:
                logger.info(
                    '[PERDAS LOJA] troca_atomica PASS loja=%s codigo=%s tentativa=%s',
                    store.code,
                    store.superus_code,
                    attempt,
                )
            return
        except ControlStateError as exc:
            last_error = exc
            current_origin = win32.text(origin.hwnd).strip()
            current_destination = win32.text(destination.hwnd).strip()
            names = _count_visible_store_names(win32, report, store.name)
            if logger:
                logger.warning(
                    '[PERDAS LOJA] troca_atomica retry loja=%s tentativa=%s '
                    'origem=%r destino=%r nomes=%s erro=%s',
                    store.code,
                    attempt,
                    current_origin,
                    current_destination,
                    names,
                    exc,
                )

    raise ControlStateError(
        f'Não foi possível configurar Origem/Destino como o mesmo par da loja {store.code} '
        f'(código interno {store.superus_code}). Último erro: {last_error}'
    )


def set_loss_period(
    win32: Win32,
    report: int,
    start: date,
    end: date,
    logger: logging.Logger | None = None,
) -> None:
    # V7.1 DIAGNÓSTICO: comportamento funcional idêntico ao V7.0.
    # Só adiciona leitura/log antes e depois de cada WM_SETTEXT.
    initial = win32.control_by_instance(report, 'TSimusDateTimePicker', 2)
    final = win32.control_by_instance(report, 'TSimusDateTimePicker', 1)
    expected_initial = start.strftime('%d/%m/%Y')
    expected_final = end.strftime('%d/%m/%Y')

    if logger:
        logger.info(
            '[PERDAS DATA] inicio hwnd=0x%X before=%r expected=%r visible=%s enabled=%s',
            initial.hwnd, win32.text(initial.hwnd), expected_initial, initial.visible, initial.enabled,
        )
    win32.set_text(initial.hwnd, expected_initial, verify=False)
    time.sleep(0.12)
    after_initial = win32.text(initial.hwnd)
    if logger:
        logger.info(
            '[PERDAS DATA] inicio apos_set hwnd=0x%X wm_gettext=%r expected=%r text_match=%s (WM_GETTEXT pode ficar stale; HTM valida o periodo real)',
            initial.hwnd, after_initial, expected_initial, after_initial.strip() == expected_initial,
        )

    if logger:
        logger.info(
            '[PERDAS DATA] final hwnd=0x%X before=%r expected=%r visible=%s enabled=%s',
            final.hwnd, win32.text(final.hwnd), expected_final, final.visible, final.enabled,
        )
    win32.set_text(final.hwnd, expected_final, verify=False)
    time.sleep(0.12)
    after_final = win32.text(final.hwnd)
    if logger:
        logger.info(
            '[PERDAS DATA] final apos_set hwnd=0x%X wm_gettext=%r expected=%r text_match=%s (WM_GETTEXT pode ficar stale; HTM valida o periodo real)',
            final.hwnd, after_final, expected_final, after_final.strip() == expected_final,
        )
    _log_loss_state(
        logger,
        'after_set_loss_period',
        win32,
        report,
        requested_start=expected_initial,
        requested_end=expected_final,
    )


def configure_products(
    win32: Win32,
    report: int,
    store_code: str,
    start: str,
    end: str,
    logger: logging.Logger | None = None,
) -> ReportConfiguration:
    start_date = date.fromisoformat(start) if '-' in start else __import__('datetime').datetime.strptime(start, '%d/%m/%Y').date()
    end_date = date.fromisoformat(end) if '-' in end else __import__('datetime').datetime.strptime(end, '%d/%m/%Y').date()
    select_products_tab(win32, report, logger)
    states = _set_required_states(win32, report, logger)
    set_loss_store(win32, report, store_code, logger)
    set_loss_period(win32, report, start_date, end_date, logger)
    return ReportConfiguration(store_code, start_date.isoformat(), end_date.isoformat(), states)


def generate_loss_report(
    win32: Win32,
    report: int,
    logger: logging.Logger | None = None,
) -> None:
    ok = win32.control_by_instance(report, 'TBitBtn', 2)
    if logger:
        logger.info(
            '[PERDAS OK] antes_click hwnd=0x%X text=%r visible=%s enabled=%s',
            ok.hwnd, win32.text(ok.hwnd), ok.visible, ok.enabled,
        )
    win32.click(ok.hwnd)
    if logger:
        logger.info('[PERDAS OK] BM_CLICK enviado hwnd=0x%X', ok.hwnd)


def collect_loss_htm(
    win32: Win32,
    report: int,
    store_code: str,
    start: date,
    end: date,
    destination: Path,
    settings: Settings,
    logger: logging.Logger | None = None,
    *,
    configure_store: bool = True,
) -> tuple[Path | None, str]:
    if destination.exists():
        raise ControlStateError(f'Fresh collection recusou arquivo já existente: {destination}')

    collection_started = time.monotonic()
    context = {
        'store': store_code,
        'side_mode': 'configure_store' if configure_store else 'reuse_same_store',
        'start': start.isoformat(),
        'end': end.isoformat(),
        'destination': str(destination),
    }
    if logger:
        logger.info('[PERDAS COLLECTION] START %s', json.dumps(context, ensure_ascii=False))
    _log_loss_state(logger, 'collection_start', win32, report, **context)

    step = time.monotonic()
    try:
        cleanup_export_state(win32)
        _log_step(logger, 'cleanup_export_state', 'PASS', step, **context)
    except Exception:
        _log_step(logger, 'cleanup_export_state', 'FAIL', step, **context)
        raise

    step = time.monotonic()
    try:
        select_products_tab(win32, report, logger)
        _log_step(logger, 'select_products_tab', 'PASS', step, **context)
    except Exception:
        _log_step(logger, 'select_products_tab', 'FAIL', step, **context)
        raise

    step = time.monotonic()
    try:
        _set_required_states(win32, report, logger)
        _log_step(logger, 'set_required_states', 'PASS', step, **context)
    except Exception:
        _log_step(logger, 'set_required_states', 'FAIL', step, **context)
        raise

    _log_loss_state(logger, 'after_required_states', win32, report, **context)

    step = time.monotonic()
    try:
        if configure_store:
            set_loss_store(win32, report, store_code, logger)
        else:
            validate_loss_store_state(win32, report, store_code, timeout=3.0, logger=logger)
        _log_step(logger, 'configure_or_validate_store', 'PASS', step, **context)
    except Exception:
        _log_step(logger, 'configure_or_validate_store', 'FAIL', step, **context)
        _log_loss_state(logger, 'store_step_failed', win32, report, **context)
        raise

    _log_loss_state(logger, 'before_period', win32, report, **context)
    step = time.monotonic()
    try:
        set_loss_period(win32, report, start, end, logger)
        _log_step(logger, 'set_loss_period', 'PASS', step, **context)
    except Exception:
        _log_step(logger, 'set_loss_period', 'FAIL', step, **context)
        _log_loss_state(logger, 'period_step_failed', win32, report, **context)
        raise

    existing = preview_hwnds(win32)
    if logger:
        logger.info('[PERDAS PREVIEW] antes_ok existing=%s', sorted(existing))
    _log_loss_state(logger, 'before_ok', win32, report, existing_previews=sorted(existing), **context)

    step = time.monotonic()
    try:
        with win32.background_step(f'coletar_perdas_{store_code}_{start:%Y%m%d}_{end:%Y%m%d}', logger):
            generate_loss_report(win32, report, logger)
        _log_step(logger, 'click_ok', 'PASS', step, **context)
    except Exception:
        _log_step(logger, 'click_ok', 'FAIL', step, **context)
        _log_loss_state(logger, 'ok_click_failed', win32, report, **context)
        raise

    step = time.monotonic()
    try:
        result = wait_preview_or_no_data(
            win32,
            existing_hwnds=existing,
            timeout=settings.superus_preview_timeout,
        )
        _log_step(
            logger, 'wait_preview_or_no_data', 'PASS', step,
            no_data=result.no_data, preview_hwnd=result.hwnd, message=result.message, **context,
        )
    except Exception:
        _log_step(logger, 'wait_preview_or_no_data', 'FAIL', step, **context)
        _log_loss_state(logger, 'preview_wait_failed', win32, report, **context)
        raise

    if result.no_data or not result.hwnd:
        if logger:
            logger.info('[PERDAS COLLECTION] NO_DATA %s', json.dumps(context, ensure_ascii=False))
        return None, result.message or 'NO_DATA'

    try:
        step = time.monotonic()
        try:
            with win32.background_step('exportar_perdas_html', logger):
                path = export_preview_as_htm(win32, result.hwnd, destination, settings)
            _log_step(logger, 'export_preview_as_htm', 'PASS', step, file=str(path), **context)
        except Exception:
            _log_step(logger, 'export_preview_as_htm', 'FAIL', step, **context)
            raise
        if logger:
            logger.info(
                '[PERDAS COLLECTION] PASS total_ms=%s file=%s',
                round((time.monotonic() - collection_started) * 1000, 1),
                path,
            )
        return path, 'PASS'
    finally:
        step = time.monotonic()
        try:
            close_preview(win32)
            win32.wait(lambda: win32.find_window('TFormRelPedidos'), 30, 'retorno ao TFormRelPedidos')
            _log_step(logger, 'close_preview_and_return', 'PASS', step, **context)
        except Exception:
            _log_step(logger, 'close_preview_and_return', 'FAIL', step, **context)
            raise
