from dataclasses import dataclass

from src.superus.reports import WM_KILLFOCUS, WM_SETFOCUS, set_loss_store
from src.superus.windows import WM_KEYDOWN, WM_KEYUP


@dataclass
class C:
    hwnd: int
    class_name: str
    text: str = ''
    visible: bool = True
    instance: int = 1


class Fake:
    def __init__(self):
        self.origin=C(101,'TComboEdit',instance=3)
        self.destination=C(102,'TComboEdit',instance=2)
        self.date=C(103,'TSimusDateTimePicker',instance=2)
        self.name1=C(201,'TEdit',instance=1)
        self.name2=C(202,'TEdit',instance=2)
        self.map={x.hwnd:x for x in [self.origin,self.destination,self.date,self.name1,self.name2]}
        self.messages=[]

    def control_by_instance(self, parent, cls, inst):
        del parent
        if (cls,inst)==('TComboEdit',3): return self.origin
        if (cls,inst)==('TComboEdit',2): return self.destination
        if (cls,inst)==('TSimusDateTimePicker',2): return self.date
        raise AssertionError((cls,inst))

    def set_text(self, hwnd, value, *, verify=True):
        del verify
        self.map[hwnd].text=value

    def text(self, hwnd):
        return self.map[hwnd].text

    def send(self, hwnd, message, wparam=0, lparam=0):
        self.messages.append((hwnd,message,wparam,lparam))
        # Simula o comportamento real informado: nome aparece no OnExit/KILLFOCUS.
        if hwnd==self.origin.hwnd and message==WM_KILLFOCUS and self.origin.text=='17':
            self.name1.text='SUPERMERCADO PRIMOR 01 307'
        if hwnd==self.destination.hwnd and message==WM_KILLFOCUS and self.destination.text=='17':
            self.name2.text='SUPERMERCADO PRIMOR 01 307'
        return 1

    def children(self, parent):
        del parent
        return [self.origin,self.destination,self.date,self.name1,self.name2]


def test_store_lookup_is_committed_by_killfocus():
    w=Fake()
    set_loss_store(w,999,'307')
    assert w.origin.text=='17'
    assert w.destination.text=='17'
    assert w.name1.text=='SUPERMERCADO PRIMOR 01 307'
    assert w.name2.text=='SUPERMERCADO PRIMOR 01 307'
    assert (101,WM_KILLFOCUS,102,0) in w.messages
    assert (102,WM_KILLFOCUS,103,0) in w.messages
    assert any(m[1]==WM_SETFOCUS for m in w.messages)
    assert any(m[1]==WM_KEYDOWN for m in w.messages)
    assert any(m[1]==WM_KEYUP for m in w.messages)
