from dataclasses import dataclass
from datetime import date

from src.superus.reports import WM_KILLFOCUS, WM_SETFOCUS, set_loss_period
from src.superus.windows import WM_KEYDOWN, WM_KEYUP


@dataclass
class C:
    hwnd: int
    class_name: str
    text: str = ""
    visible: bool = True
    instance: int = 1


class Fake:
    def __init__(self):
        self.initial = C(101, "TSimusDateTimePicker", instance=2)
        self.final = C(102, "TSimusDateTimePicker", instance=1)
        self.ok = C(103, "TBitBtn", "OK", instance=2)
        self.map = {x.hwnd: x for x in [self.initial, self.final, self.ok]}
        self.events = []

    def control_by_instance(self, parent, cls, inst):
        del parent
        if (cls, inst) == ("TSimusDateTimePicker", 2):
            return self.initial
        if (cls, inst) == ("TSimusDateTimePicker", 1):
            return self.final
        if (cls, inst) == ("TBitBtn", 2):
            return self.ok
        raise AssertionError((cls, inst))

    def set_text(self, hwnd, value, *, verify=True):
        del verify
        self.events.append(("set_text", hwnd, value))
        self.map[hwnd].text = value

    def text(self, hwnd):
        return self.map[hwnd].text

    def send(self, hwnd, message, wparam=0, lparam=0):
        self.events.append(("send", hwnd, message, wparam, lparam))
        return 1


def test_period_pair_commits_initial_final_and_leaves_focus_on_ok():
    w = Fake()
    set_loss_period(w, 999, date(2025, 9, 1), date(2025, 9, 3))

    assert w.initial.text == "01/09/2025"
    assert w.final.text == "03/09/2025"
    assert ("send", 101, WM_KILLFOCUS, 102, 0) in w.events
    assert ("send", 102, WM_KILLFOCUS, 103, 0) in w.events
    assert ("send", 102, WM_SETFOCUS, 101, 0) in w.events
    assert ("send", 103, WM_SETFOCUS, 102, 0) in w.events
    assert any(e[1] == 101 and e[2] == WM_KEYDOWN for e in w.events if e[0] == "send")
    assert any(e[1] == 102 and e[2] == WM_KEYUP for e in w.events if e[0] == "send")
