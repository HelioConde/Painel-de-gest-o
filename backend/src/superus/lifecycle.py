from __future__ import annotations

import logging
import subprocess
import time
from contextvars import ContextVar
from functools import wraps
from pathlib import Path

_active_run: ContextVar[OwnedProcesses | None] = ContextVar('superus_owned_processes', default=None)
logger = logging.getLogger(__name__)


class OwnedProcesses:
    """Windows Job containing only processes launched by this collection."""

    def __init__(self) -> None:
        self.job = None

    def launch(self, path: Path, arguments: tuple[str, ...] = ()) -> int:
        import win32api
        import win32job
        import win32process

        if self.job is None:
            self.job = win32job.CreateJobObject(None, '')
            limits = win32job.QueryInformationJobObject(
                self.job, win32job.JobObjectExtendedLimitInformation,
            )
            limits['BasicLimitInformation']['LimitFlags'] |= win32job.JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            win32job.SetInformationJobObject(
                self.job, win32job.JobObjectExtendedLimitInformation, limits,
            )
        startup = win32process.STARTUPINFO()
        startup.dwFlags = subprocess.STARTF_USESHOWWINDOW
        startup.wShowWindow = 4  # SW_SHOWNOACTIVATE
        process, thread, pid, _ = win32process.CreateProcess(
            str(path), subprocess.list2cmdline([str(path), *arguments]),
            None, None, False, win32process.CREATE_SUSPENDED, None, None, startup,
        )
        try:
            # Assign before resuming so launcher children also belong to this run.
            win32job.AssignProcessToJobObject(self.job, process)
            win32process.ResumeThread(thread)
        except BaseException:
            win32api.TerminateProcess(process, 1)
            raise
        finally:
            thread.Close()
            process.Close()
        logger.info('SUPERUS cleanup: tracking launched process pid=%s', pid)
        return pid

    def close(self, timeout: float = 5.0) -> None:
        if self.job is None:
            return
        import win32api
        import win32gui
        import win32job
        import win32process

        job, self.job = self.job, None

        def request_close(hwnd, _):
            process = None
            try:
                _, pid = win32process.GetWindowThreadProcessId(hwnd)
                process = win32api.OpenProcess(0x0400, False, pid)
                if win32job.IsProcessInJob(process, job):
                    win32gui.PostMessage(hwnd, 0x0010, 0, 0)  # WM_CLOSE
            except (OSError, win32api.error):
                pass  # A window may disappear while being enumerated.
            finally:
                if process is not None:
                    process.Close()
            return True

        try:
            win32gui.EnumWindows(request_close, None)
            deadline = time.monotonic() + timeout
            while time.monotonic() < deadline:
                info = win32job.QueryInformationJobObject(job, win32job.JobObjectBasicAccountingInformation)
                if not info['ActiveProcesses']:
                    break
                time.sleep(0.1)
        finally:
            # Kill-on-close also covers hung children and startup/login failures.
            job.Close()
            logger.info('SUPERUS cleanup: released process job')


def current_process_owner() -> OwnedProcesses | None:
    return _active_run.get()


def managed_superus_processes(function):
    @wraps(function)
    def wrapped(*args, **kwargs):
        if current_process_owner() is not None:
            return function(*args, **kwargs)
        owner = OwnedProcesses()
        token = _active_run.set(owner)
        try:
            return function(*args, **kwargs)
        finally:
            try:
                owner.close()
            finally:
                _active_run.reset(token)
    return wrapped
