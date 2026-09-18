"""GUI operacional simples para a extração manual de Perdas."""
from __future__ import annotations

import threading
import tkinter as tk
from datetime import datetime
from tkinter import messagebox

from src.app.controller import run_losses_auto
from src.config.stores import STORES


class LossesWindow:
    def __init__(self, *, sync: bool = False) -> None:
        self.sync = sync
        self.root = tk.Tk()
        self.root.title('EXTRAÇÃO DE PERDAS - SUPERUS')
        self.root.resizable(False, False)
        today = datetime.now().strftime('%d/%m/%Y')
        self.start = tk.StringVar(value=today)
        self.end = tk.StringVar(value=today)
        self.status = tk.StringVar(value='Pronto')
        self.stores = {code: tk.BooleanVar(value=True) for code in STORES}
        self._build()

    def _build(self) -> None:
        frame = tk.Frame(self.root, padx=22, pady=18)
        frame.grid()
        tk.Label(frame, text='DATA INICIAL:').grid(row=0, column=0, sticky='w', pady=4)
        tk.Entry(frame, textvariable=self.start, width=14, justify='center').grid(row=0, column=1, sticky='w')
        tk.Label(frame, text='DATA FINAL:').grid(row=1, column=0, sticky='w', pady=4)
        tk.Entry(frame, textvariable=self.end, width=14, justify='center').grid(row=1, column=1, sticky='w')
        tk.Label(frame, text='LOJAS:').grid(row=2, column=0, sticky='w', pady=(12, 4))
        stores_frame = tk.Frame(frame)
        stores_frame.grid(row=3, column=0, columnspan=3, sticky='w')
        for index, (code, store) in enumerate(STORES.items()):
            tk.Checkbutton(
                stores_frame,
                text=f'{store.sequence} - {code}',
                variable=self.stores[code],
            ).grid(row=index % 3, column=index // 3, padx=(0, 28), sticky='w')
        buttons = tk.Frame(frame)
        buttons.grid(row=4, column=0, columnspan=3, sticky='w', pady=(15, 8))
        tk.Button(buttons, text='SELECIONAR TODAS', width=18, command=self._select_all).grid(row=0, column=0, padx=3)
        tk.Button(buttons, text='LIMPAR', width=10, command=self._clear).grid(row=0, column=1, padx=3)
        tk.Button(frame, text='BUSCAR PERDAS', width=20, command=self._start).grid(row=5, column=0, pady=10, sticky='w')
        tk.Button(frame, text='CANCELAR', width=12, command=self.root.destroy).grid(row=5, column=1, pady=10, sticky='w')
        tk.Label(frame, textvariable=self.status, anchor='w', justify='left', wraplength=420).grid(
            row=6, column=0, columnspan=3, sticky='we'
        )

    def _select_all(self) -> None:
        for value in self.stores.values():
            value.set(True)

    def _clear(self) -> None:
        for value in self.stores.values():
            value.set(False)

    def _set_status(self, value: str) -> None:
        self.root.after(0, lambda: self.status.set(value))

    def _start(self) -> None:
        selected = [code for code, value in self.stores.items() if value.get()]
        if not selected:
            messagebox.showerror('Lojas', 'Selecione pelo menos uma loja.')
            return
        start = self.start.get().strip()
        end = self.end.get().strip()

        def worker() -> None:
            try:
                self._set_status('Coletando perdas e vendas do período no SUPERUS...')
                code = run_losses_auto(start, end, ','.join(selected), sync=self.sync)
                if code == 0:
                    message = (
                        'Perdas + vendas coletadas e sincronizadas com o Supabase.'
                        if self.sync
                        else 'Perdas + vendas coletadas com sucesso.'
                    )
                    self._set_status(message)
                    self.root.after(0, lambda: messagebox.showinfo('Concluído', message))
                elif code == 3:
                    self._set_status(
                        'Coleta concluída, mas o Supabase falhou. '
                        'Consulte payload_preview.json / supabase_sync.json.'
                    )
                else:
                    self._set_status('A coleta terminou com falha. Consulte data/loss_runs.')
            except Exception as error:
                message = str(error)
                self._set_status(f'ERRO: {message}')
                # Python limpa a variável do `except` ao sair do bloco; capturar
                # a string evita NameError quando o callback Tk executar depois.
                self.root.after(0, lambda message=message: messagebox.showerror('Erro', message))

        threading.Thread(target=worker, daemon=True).start()

    def mainloop(self) -> None:
        self.root.mainloop()


def open_losses_window(*, sync: bool = False) -> None:
    LossesWindow(sync=sync).mainloop()


def open_initial_window() -> None:
    open_losses_window()
