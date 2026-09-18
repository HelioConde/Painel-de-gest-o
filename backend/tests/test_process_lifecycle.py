import os
import sys
import time
from pathlib import Path

import pytest

from src.superus import lifecycle


@pytest.mark.parametrize('fail', [False, True])
def test_cleanup_runs_after_work_and_on_failure(monkeypatch, fail):
    events = []
    monkeypatch.setattr(lifecycle.OwnedProcesses, 'close', lambda self: events.append('close'))

    @lifecycle.managed_superus_processes
    def inner():
        events.append('sync')
        if fail:
            raise RuntimeError('sync failed')

    @lifecycle.managed_superus_processes
    def outer():
        events.append('collect')
        inner()

    if fail:
        with pytest.raises(RuntimeError, match='sync failed'):
            outer()
    else:
        outer()
    assert events == ['collect', 'sync', 'close']
    assert lifecycle.current_process_owner() is None


@pytest.mark.skipif(os.name != 'nt', reason='Windows Job integration')
def test_job_closes_launched_process_and_preserves_current_process():
    import win32api
    import win32event
    import win32job

    owner = lifecycle.OwnedProcesses()
    process = None
    try:
        pid = owner.launch(Path(sys.executable), ('-c', 'import time; time.sleep(60)'))
        process = win32api.OpenProcess(0x100000, False, pid)
        assert not win32job.IsProcessInJob(win32api.GetCurrentProcess(), owner.job)
        owner.close(timeout=0)
        assert win32event.WaitForSingleObject(process, 5000) == win32event.WAIT_OBJECT_0
        owner.close(timeout=0)
    finally:
        owner.close(timeout=0)
        if process is not None:
            process.Close()


@pytest.mark.skipif(os.name != 'nt', reason='Windows Job integration')
def test_launcher_child_is_closed_even_after_launcher_exits(tmp_path):
    import win32api
    import win32event

    pid_file = tmp_path / 'child.pid'
    script = (
        'import subprocess, sys; from pathlib import Path; '
        "child = subprocess.Popen([sys.executable, '-c', 'import time; time.sleep(60)']); "
        f'Path({str(pid_file)!r}).write_text(str(child.pid))'
    )
    owner = lifecycle.OwnedProcesses()
    child = None
    try:
        owner.launch(Path(sys.executable), ('-c', script))
        deadline = time.monotonic() + 5
        while not pid_file.exists() and time.monotonic() < deadline:
            time.sleep(0.05)
        assert pid_file.exists()
        child = win32api.OpenProcess(0x100000, False, int(pid_file.read_text()))
        owner.close(timeout=0)
        assert win32event.WaitForSingleObject(child, 5000) == win32event.WAIT_OBJECT_0
    finally:
        owner.close(timeout=0)
        if child is not None:
            child.Close()
