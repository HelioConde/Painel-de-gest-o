from dataclasses import dataclass
from datetime import date

from src.superus.reports import WM_KILLFOCUS, WM_SETFOCUS, set_loss_period


@dataclass
class C:
    hwnd: int
    class_name: str
    text: str = ''
    instance: int = 1


class FakePeriod:
    def __init__(self):
        self.initial = C(101, 'TSimusDateTimePicker', '04/09/2026', 2)
        self.final = C(102, 'TSimusDateTimePicker', '04/09/2026', 1)
        self.ok = C(103, 'TBitBtn', 'OK', 2)
        self.map = {c.hwnd: c for c in (self.initial, self.final, self.ok)}
        self.events = []

    def control_by_instance(self, parent, cls, inst):
        del parent
        if (cls, inst) == ('TSimusDateTimePicker', 2):
            return self.initial
        if (cls, inst) == ('TSimusDateTimePicker', 1):
            return self.final
        if (cls, inst) == ('TBitBtn', 2):
            return self.ok
        raise AssertionError((cls, inst))

    def send(self, hwnd, message, wparam=0, lparam=0):
        self.events.append(('send', hwnd, message, wparam, lparam))
        return 1

    def set_text(self, hwnd, value, *, verify=True):
        del verify
        self.events.append(('set_text', hwnd, value))
        self.map[hwnd].text = value

    def text(self, hwnd):
        return self.map[hwnd].text


def test_loss_period_commits_initial_then_final_by_focus_exit():
    w = FakePeriod()
    set_loss_period(w, 999, date(2025, 9, 1), date(2025, 9, 3))

    assert w.initial.text == '01/09/2025'
    assert w.final.text == '03/09/2025'

    assert ('send', 101, WM_SETFOCUS, 0, 0) in w.events
    assert ('send', 101, WM_KILLFOCUS, 102, 0) in w.events
    assert ('send', 102, WM_SETFOCUS, 101, 0) in w.events
    assert ('send', 102, WM_KILLFOCUS, 103, 0) in w.events
    assert ('send', 103, WM_SETFOCUS, 102, 0) in w.events

    # O botão OK só recebe foco local; não é clicado por set_loss_period.
    assert not any(event[0] == 'click' for event in w.events)
