"""Run with the project's Python environment: python start.py [uvicorn options]."""
# python start.py --host 0.0.0.0 --port 8000
import os
import subprocess
import sys

from app.office_runtime import ROOT, ensure_libreoffice


def main() -> int:
    try:
        executable = ensure_libreoffice()
    except (OSError, RuntimeError, subprocess.SubprocessError) as exc:
        print(f"LibreOffice 初始化失败：{exc}", file=sys.stderr)
        return 1
    os.environ["LIBREOFFICE_PATH"] = str(executable)
    print(f"LibreOffice 已就绪：{executable}", flush=True)
    os.chdir(ROOT)
    os.execv(sys.executable, [sys.executable, "-m", "uvicorn", "app.api:app", *sys.argv[1:]])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
