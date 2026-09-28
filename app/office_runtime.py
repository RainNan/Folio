"""Install a pinned LibreOffice runtime before starting the web workers."""

import contextlib
import hashlib
import os
import platform
import shutil
import subprocess
import tarfile
import tempfile
import time
import urllib.request
from pathlib import Path

VERSION = "26.2.6"
ROOT = Path(__file__).resolve().parents[1]
PACKAGES = {
    "Windows": (
        "win/x86_64/LibreOffice_26.2.6_Win_x86-64.msi",
        "f9877032fd908beb9c0ddf06df4af5c2e85f419c42e14876c4cce5aae5fb2660",
    ),
    "Linux": (
        "deb/x86_64/LibreOffice_26.2.6_Linux_x86-64_deb.tar.gz",
        "fd0e8f8f2408dd2e5b90286e60f3f97cf566ba441cd48cfc5bcc68067303e0bc",
    ),
}


def run(args, **kwargs):
    if os.name == "nt":
        kwargs.setdefault("creationflags", subprocess.CREATE_NO_WINDOW)
    return subprocess.run(args, check=True, **kwargs)


def usable(executable: Path) -> bool:
    if not executable.is_file():
        return False
    try:
        run([str(executable), "--headless", "--version"],
            stdout=subprocess.PIPE, stderr=subprocess.PIPE, timeout=30)
        return True
    except (OSError, subprocess.SubprocessError):
        return False


def install_platform() -> str:
    system = platform.system()
    machine = platform.machine().lower()
    if system not in PACKAGES or machine not in {"amd64", "x86_64"}:
        raise RuntimeError(
            f"暂不支持自动安装：{system}/{machine}。"
            "请手动安装并设置 LIBREOFFICE_PATH 为可执行文件路径。"
        )
    if system == "Linux":
        release = platform.freedesktop_os_release()
        families = (release.get("ID", "") + " " + release.get("ID_LIKE", "")).split()
        if not {"ubuntu", "debian"}.intersection(families):
            raise RuntimeError("Linux 自动安装目前只支持 Ubuntu/Debian 系列")
    return system


def privileged(args):
    if os.geteuid() != 0:
        if not shutil.which("sudo"):
            raise RuntimeError("首次安装需要 sudo 或 root 权限，请由管理员预安装")
        args = ["sudo", *args]
    run(args)


@contextlib.contextmanager
def install_lock(path: Path, timeout: int = 1200):
    # OS locks are automatically released if the installer crashes.
    with path.open("a+b") as handle:
        handle.seek(0, os.SEEK_END)
        if handle.tell() == 0:
            handle.write(b"0")
            handle.flush()
        deadline = time.monotonic() + timeout
        while True:
            try:
                handle.seek(0)
                if os.name == "nt":
                    import msvcrt
                    msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
                else:
                    import fcntl
                    fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
                break
            except (BlockingIOError, PermissionError):
                if time.monotonic() >= deadline:
                    raise TimeoutError("等待 LibreOffice 安装锁超时")
                time.sleep(1)
        try:
            yield
        finally:
            handle.seek(0)
            if os.name == "nt":
                msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(handle, fcntl.LOCK_UN)


def download(system: str, destination: Path):
    package, expected = PACKAGES[system]
    digest = hashlib.sha256()
    # Archive fallback keeps the pinned version usable after stable moves on.
    bases = [
        "https://download.documentfoundation.org/libreoffice/stable",
        "https://downloadarchive.documentfoundation.org/libreoffice/old",
    ]
    for index, base in enumerate(bases):
        try:
            with urllib.request.urlopen(f"{base}/{VERSION}/{package}", timeout=60) as response:
                with destination.open("wb") as output:
                    while block := response.read(1024 * 1024):
                        output.write(block)
                        digest.update(block)
            break
        except OSError:
            if index == len(bases) - 1:
                raise
            digest = hashlib.sha256()
    if digest.hexdigest() != expected:
        raise RuntimeError("LibreOffice 下载包 SHA256 校验失败，停止安装")


def ensure_libreoffice() -> Path:
    configured = os.environ.get("LIBREOFFICE_PATH")
    if configured:
        executable = Path(configured).expanduser().resolve()
        if not usable(executable):
            raise RuntimeError(f"LIBREOFFICE_PATH 不可运行：{executable}")
        return executable

    system = install_platform()
    default = ROOT / ".tools" / "libreoffice" if system == "Windows" else Path("/opt/libreoffice")
    target = Path(os.environ.get("LIBREOFFICE_INSTALL_DIR", str(default))).expanduser().resolve()
    executable_name = "soffice.com" if system == "Windows" else "soffice"
    installed = target / VERSION
    executable = installed / "program" / executable_name
    if usable(executable):
        return executable

    try:
        target.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        if system != "Linux":
            raise
        privileged(["install", "-d", "-m", "755", "-o", str(os.getuid()),
                    "-g", str(os.getgid()), str(target)])

    with install_lock(target / ".install.lock"):
        if usable(executable):
            return executable
        if installed.exists():
            raise RuntimeError(f"已有安装不可用：{installed}；请检查依赖或移动该目录后重试")
        print(f"首次安装 LibreOffice {VERSION} 到 {installed}，请稍候", flush=True)
        if system == "Linux":
            privileged(["apt-get", "update"])
            privileged([
                "apt-get", "install", "-y", "--no-install-recommends",
                "ca-certificates", "dpkg", "libxinerama1", "libxrender1", "libxext6",
                "libsm6", "libice6", "libcairo2", "libcups2", "libdbus-1-3",
                "libfontconfig1", "libfreetype6", "libglib2.0-0", "libnss3",
                "libnspr4", "libx11-6", "libxcb1", "libxslt1.1", "libxml2",
                "libstdc++6", "libgcc-s1", "zlib1g", "fonts-dejavu-core", "fonts-noto-cjk",
            ])
        with tempfile.TemporaryDirectory(prefix=".install-", dir=target) as work:
            staging = Path(work)
            package = staging / Path(PACKAGES[system][0]).name
            download(system, package)
            unpacked = staging / "unpacked"
            unpacked.mkdir()
            if system == "Windows":
                run(["msiexec.exe", "/a", str(package), "/qn", "/norestart",
                     f"TARGETDIR={unpacked}", "/L*v", str(target / "install.log")], timeout=900)
            else:
                # Python's data filter rejects archive path traversal and unsafe links.
                if not hasattr(tarfile, "data_filter"):
                    raise RuntimeError("请使用 Python 3.11.8+ 或支持 tarfile.data_filter 的版本")
                with tarfile.open(package) as archive:
                    archive.extractall(staging / "packages", filter="data")
                debs = list((staging / "packages").rglob("*.deb"))
                if not debs:
                    raise RuntimeError("安装包中未找到 DEB 文件")
                for deb in debs:
                    run(["dpkg-deb", "-x", str(deb), str(unpacked)], timeout=120)
            candidates = list(unpacked.rglob(f"program/{executable_name}"))
            if len(candidates) != 1 or not usable(candidates[0]):
                raise RuntimeError("LibreOffice 解包后无法运行，请检查系统依赖；安装未完成")
            candidates[0].parent.parent.rename(installed)
        if not usable(executable):
            raise RuntimeError(f"LibreOffice 在最终安装路径无法运行：{executable}")
        return executable
