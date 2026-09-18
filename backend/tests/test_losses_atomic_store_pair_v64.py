from dataclasses import dataclass

from src.superus.reports import WM_KILLFOCUS, set_loss_store


@dataclass
class C:
    hwnd: int
    class_name: str
    text: str = ''
    visible: bool = True
    instance: int = 1


class FakeTransition:
    """Simula exatamente a transição observada 04/120 -> 05/033."""

    def __init__(self):
        self.origin = C(101, 'TComboEdit', '66471', instance=3)
        self.destination = C(102, 'TComboEdit', '66471', instance=2)
        self.date = C(103, 'TSimusDateTimePicker', instance=2)
        self.name1 = C(201, 'TEdit', 'SUPERMERCADO PRIMOR 04 120', instance=1)
        self.name2 = C(202, 'TEdit', 'SUPERMERCADO PRIMOR 04 120', instance=2)
        self.map = {
            x.hwnd: x
            for x in [self.origin, self.destination, self.date, self.name1, self.name2]
        }
        self.events = []

    def control_by_instance(self, parent, cls, inst):
        del parent
        if (cls, inst) == ('TComboEdit', 3):
            return self.origin
        if (cls, inst) == ('TComboEdit', 2):
            return self.destination
        if (cls, inst) == ('TSimusDateTimePicker', 2):
            return self.date
        raise AssertionError((cls, inst))

    def set_text(self, hwnd, value, *, verify=True):
        del verify
        self.events.append(('set_text', hwnd, value))
        self.map[hwnd].text = value

    def text(self, hwnd):
        return self.map[hwnd].text

    def send(self, hwnd, message, wparam=0, lparam=0):
        self.events.append(('send', hwnd, message, wparam, lparam))
        # O nome só é resolvido quando o respectivo TComboEdit perde o foco.
        if hwnd == self.origin.hwnd and message == WM_KILLFOCUS and self.origin.text == '72731':
            self.name1.text = 'SUPERMERCADO PRIMOR 05 033'
        if hwnd == self.destination.hwnd and message == WM_KILLFOCUS and self.destination.text == '72731':
            self.name2.text = 'SUPERMERCADO PRIMOR 05 033'
        return 1

    def children(self, parent):
        del parent
        return [self.origin, self.destination, self.date, self.name1, self.name2]


def test_store_05_stages_origin_and_destination_before_origin_exit():
    w = FakeTransition()
    set_loss_store(w, 999, '033')

    assert w.origin.text == '72731'
    assert w.destination.text == '72731'
    assert w.name1.text == 'SUPERMERCADO PRIMOR 05 033'
    assert w.name2.text == 'SUPERMERCADO PRIMOR 05 033'

    set_origin_index = w.events.index(('set_text', 101, '72731'))
    set_destination_index = w.events.index(('set_text', 102, '72731'))
    origin_exit_index = next(
        i
        for i, event in enumerate(w.events)
        if event[:3] == ('send', 101, WM_KILLFOCUS)
    )

    # Regressão do bug real: Destino precisa receber 72731 ANTES de Origem
    # iniciar a resolução que anteriormente podia interromper o fluxo.
    assert set_origin_index < origin_exit_index
    assert set_destination_index < origin_exit_index
