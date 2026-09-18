from __future__ import annotations

import json
from pathlib import Path


def main() -> int:
    backend = Path(__file__).resolve().parents[1]
    root = backend / "data" / "loss_runs"
    runs = sorted((p for p in root.iterdir() if p.is_dir()), key=lambda p: p.name, reverse=True) if root.exists() else []
    if not runs:
        print("Nenhum run de perdas encontrado.")
        return 1

    run = runs[0]
    manifest_path = run / "manifest.json"
    manifest = json.loads(manifest_path.read_text(encoding="utf-8")) if manifest_path.exists() else {}

    print(f"run_id: {run.name}")
    print(f"run_dir: {run}")
    print(f"status: {manifest.get('status')}")
    print(f"error: {manifest.get('error')}")
    print(f"failure_context: {manifest.get('failure_context')}")
    print("diagnostics:")
    for name, path in (manifest.get("diagnostic_files") or {}).items():
        print(f"  {name}: {path}")

    log = run / "automation.log"
    if log.exists():
        lines = log.read_text(encoding="utf-8", errors="replace").splitlines()
        print("\n--- ULTIMAS 100 LINHAS automation.log ---")
        for line in lines[-100:]:
            print(line)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
