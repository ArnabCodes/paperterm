from __future__ import annotations

import os
try:
    import tomllib
except ModuleNotFoundError:
    import tomli as tomllib
from dataclasses import dataclass, field
from pathlib import Path


def config_path() -> Path:
    if os.name == "nt":
        root = Path(os.environ.get("APPDATA", Path.home() / "AppData" / "Roaming"))
        return root / "paperterm" / "config.toml"
    return Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "paperterm" / "config.toml"


@dataclass
class Config:
    background: str = "#ffffff"
    foreground: str = "#171717"
    transparent_background: bool = False
    page_width: int = 100
    render_scale: float = 1.5
    palette: dict[str, str] = field(default_factory=dict)


def load_config(path: Path | None = None) -> Config:
    target = path or config_path()
    if not target.exists():
        return Config()
    with target.open("rb") as stream:
        raw = tomllib.load(stream)
    config = Config(
        background=raw.get("background", "#ffffff"),
        foreground=raw.get("foreground", "#171717"),
        transparent_background=bool(raw.get("transparent_background", False)),
        page_width=max(30, min(240, int(raw.get("page_width", 100)))),
        render_scale=max(0.25, min(5.0, float(raw.get("render_scale", 1.5)))),
        palette={str(key): str(value) for key, value in raw.get("palette", {}).items()},
    )
    _rgb(config.background)
    _rgb(config.foreground)
    for source, replacement in config.palette.items():
        _rgb(source)
        _rgb(replacement)
    return config


def _rgb(color: str) -> tuple[int, int, int]:
    value = color.removeprefix("#")
    if len(value) != 6:
        raise ValueError(f"Expected a six-digit RGB color, got {color!r}")
    try:
        return tuple(int(value[index:index + 2], 16) for index in (0, 2, 4))
    except ValueError as error:
        raise ValueError(f"Invalid RGB color: {color!r}") from error
