#!/usr/bin/env python3
from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path('/home/LangLang/.hermes/hermes-agent')
sys.path.insert(0, str(REPO))

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text
from rich.markup import escape

from hermes_cli.skin_engine import list_skins, load_skin


def strip_rich(markup: str) -> str:
    return re.sub(r'\[[^\]]+\]', '', markup)


def crop_block(markup: str, max_lines: int = 8, max_cols: int = 50) -> str:
    plain_lines = strip_rich(markup).splitlines()
    lines = plain_lines[:max_lines]
    return '\n'.join(line[:max_cols] for line in lines)


def color_chip(hex_color: str, label: str = '') -> Text:
    t = Text('  ', style=f'on {hex_color}')
    t.append(f' {hex_color} {label}', style=hex_color)
    return t


def preview_skin(name: str) -> None:
    sk = load_skin(name)
    c = sk.colors
    b = sk.branding
    title = c.get('banner_title', '#FFD700')
    border = c.get('banner_border', '#CD7F32')
    accent = c.get('banner_accent', '#FFBF00')
    dim = c.get('banner_dim', '#B8860B')
    text = c.get('banner_text', '#FFF8DC')
    response = c.get('response_border', title)
    status_bg = c.get('status_bar_bg', '#1a1a2e')
    current_bg = c.get('completion_menu_current_bg', '#333355')
    prompt = c.get('prompt', text)

    table = Table.grid(expand=False)
    table.add_column(ratio=1)
    table.add_column(ratio=1)

    left_lines = []
    left_lines.append(f'[{title}]Agent:[/] [{text}]{escape(b.get("agent_name", sk.name))}[/]')
    left_lines.append(f'[{accent}]Response:[/] [{text}]{escape(b.get("response_label", "Hermes"))}[/]')
    left_lines.append(f'[{prompt}]Prompt:[/] [{prompt}]{escape(b.get("prompt_symbol", "❯"))}[/]')
    left_lines.append(f'[{accent}]Tool prefix:[/] [{text}]{escape(sk.tool_prefix)} terminal running…[/]')
    verbs = sk.spinner.get('thinking_verbs') or ['thinking', 'working']
    faces = sk.spinner.get('thinking_faces') or ['(^_^)', '(o_o)']
    left_lines.append(f'[{dim}]Spinner:[/] [{accent}]{escape(faces[0])} {escape(verbs[0])}[/]')
    left = '\n'.join(left_lines)

    chips = Table.grid(padding=(0, 1))
    chips.add_column()
    chips.add_row(color_chip(title, 'title'))
    chips.add_row(color_chip(accent, 'accent'))
    chips.add_row(color_chip(response, 'response'))
    chips.add_row(color_chip(status_bg, 'status bg'))
    chips.add_row(color_chip(current_bg, 'selection'))

    table.add_row(left, chips)

    if sk.banner_hero or sk.banner_logo:
        art = crop_block(sk.banner_hero or sk.banner_logo)
        table.add_row(f'[{dim}]ASCII art sample:[/]\n[{accent}]{escape(art)}[/]', '')

    console.print(Panel(
        table,
        title=f'[{title}]{escape(name)}[/] [{dim}]— {escape(sk.description or "")}[/]',
        border_style=border,
        expand=False,
    ))


console = Console(record=True, width=100, color_system='truecolor')
for item in list_skins():
    preview_skin(item['name'])
    console.print()

out = console.export_html(inline_styles=True, code_format='<pre style="font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 14px; line-height: 1.15; background:#0b1020; color:#e5e7eb; padding:18px; border-radius:12px; overflow:auto">{code}</pre>')
html = '<!doctype html><html><head><meta charset="utf-8"><title>Hermes Skin Preview</title></head><body style="margin:0;background:#111827;padding:24px">' + out + '</body></html>'
path = Path('/home/LangLang/code/ts/LineAI/hermes-skin-preview.html')
path.write_text(html, encoding='utf-8')
print(path)
