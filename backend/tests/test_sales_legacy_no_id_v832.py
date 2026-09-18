from pathlib import Path


def test_sales_repository_does_not_require_legacy_id_column():
    root = Path(__file__).resolve().parents[1]
    text = (root / "src" / "supabase" / "repository.py").read_text(encoding="utf-8")
    assert "'id,snapshot_key" not in text
    assert "'snapshot_key,reference_date" in text


def test_sales_supabase_check_uses_snapshot_key_not_id():
    root = Path(__file__).resolve().parents[1]
    text = (root / "src" / "app" / "controller.py").read_text(encoding="utf-8")
    assert "select='id'" not in text[text.index('def check_sales_supabase_command'):text.index('def _loss_run_dir')]
    assert "select='snapshot_key'" in text[text.index('def check_sales_supabase_command'):text.index('def _loss_run_dir')]
