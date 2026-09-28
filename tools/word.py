import os
import subprocess
import sys
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import uuid4


def docx_to_pdf(path: Path, output_root: Path) -> Path:
    """使用启动器配置的 LibreOffice 转换 DOCX，返回保留在磁盘上的 PDF。"""
    path = path.resolve(strict=True)
    if not path.is_file() or path.suffix.lower() != ".docx":
        raise ValueError("请输入有效的 DOCX 文件")

    configured = os.environ.get("LIBREOFFICE_PATH")
    if not configured:
        raise RuntimeError(
            "未配置 LIBREOFFICE_PATH，请通过 python start.py 启动后端，"
            "或将该环境变量设置为 soffice 的完整路径"
        )
    soffice = Path(configured).expanduser().resolve()
    if not soffice.is_file():
        raise RuntimeError(f"未找到 LibreOffice 可执行文件：{soffice}")

    # 每次使用独立目录，避免同名文件覆盖或误读旧结果
    output_dir = output_root.resolve() / uuid4().hex
    output_dir.mkdir(parents=True)

    # 使用独立配置目录，避免与其他 LibreOffice 实例共用配置
    with TemporaryDirectory(prefix="libreoffice-") as profile:
        try:
            result = subprocess.run(
                [
                    str(soffice),
                    f"-env:UserInstallation={Path(profile).resolve().as_uri()}",
                    "--headless",
                    "--convert-to",
                    "pdf:writer_pdf_Export",
                    "--outdir",
                    str(output_dir),
                    str(path),
                ],
                capture_output=True,
                timeout=120,
                # Linux 不支持 Windows 的 CREATE_NO_WINDOW。
                creationflags=subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0,
            )
        except subprocess.TimeoutExpired as exc:
            raise RuntimeError("DOCX 转 PDF 超时（120 秒）") from exc
        except OSError as exc:
            raise RuntimeError("无法启动 LibreOffice，请检查程序路径和运行依赖") from exc

    pdf_path = output_dir / f"{path.stem}.pdf"

    if (
        result.returncode != 0
        or not pdf_path.is_file()
        or pdf_path.stat().st_size == 0
    ):
        raise RuntimeError("DOCX 转 PDF 失败")

    return pdf_path
