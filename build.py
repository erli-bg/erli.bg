#!/usr/bin/env python3
"""
build.py - generate static HTML for erli.bg from Markdown sources.

Reads content/lesson-*.md, writes lessons/lesson-NN.html, and rewrites
index.html so new lessons appear in the list automatically. No external
dependencies. Run with: python3 build.py
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
LESSONS = ROOT / "lessons"

PLACEHOLDER_COMMENT = (
    "<!-- PLACEHOLDER vocabulary, replace with verified Sofia-Erli "
    "data from Kostov reference and field recordings -->"
)


def parse_frontmatter(text):
    m = re.match(r"^---\s*\n(.*?)\n---\s*\n(.*)$", text, re.DOTALL)
    if not m:
        raise ValueError("missing YAML frontmatter")
    meta = {}
    for line in m.group(1).splitlines():
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2)


def parse_body(body):
    sections, current, buf = {}, None, []
    for line in body.splitlines():
        if line.startswith("## "):
            if current is not None:
                sections[current] = buf
            current = line[3:].strip()
            buf = []
        else:
            buf.append(line)
    if current is not None:
        sections[current] = buf
    return sections


def parse_table(lines):
    rows = []
    for line in lines:
        if not line.strip().startswith("|"):
            continue
        cells = [c.strip() for c in line.strip().strip("|").split("|")]
        rows.append(cells)
    if len(rows) < 2:
        return [], []
    return rows[0], rows[2:]


def render_table(header, data, audio_prefix="../audio/"):
    out = ["<table>"]
    out.append(
        "<tr>" + "".join(f"<th>{h}</th>" for h in header) + "</tr>"
    )
    out.append(PLACEHOLDER_COMMENT)
    for row in data:
        cells = []
        for i, cell in enumerate(row):
            if i == 2 and cell:
                cells.append(
                    f'<td><a href="{audio_prefix}{cell}">{cell}</a></td>'
                )
            else:
                cells.append(f"<td>{cell}</td>")
        out.append("<tr>" + "".join(cells) + "</tr>")
    out.append("</table>")
    return "\n".join(out)


def render_lesson(meta, sections):
    n = int(meta["number"])
    nn = f"{n:02d}"
    title = meta["title"]
    full = f"Lesson {n}: {title}"
    vimeo = meta.get("vimeo_id", "XXXXXX")
    anki = meta.get("anki_file", f"lesson-{nn}.apkg")

    parts = [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        f"<title>{full} - erli.bg</title>",
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<style>body{max-width:40em;margin:1em;}</style>",
        "</head>",
        "<body>",
        '<p><a href="../index.html">back to index</a></p>',
        f"<h1>{full}</h1>",
        (
            f'<p>Recorded at {meta.get("recorded_at", "PLACEHOLDER")}, '
            f'on {meta.get("recorded_on", "PLACEHOLDER")}, with '
            f'{meta.get("speakers", "PLACEHOLDER")}.</p>'
        ),
    ]

    desc = sections.get("Description", [])
    for line in desc:
        line = line.strip()
        if line:
            parts.append(f"<p>{line}</p>")

    parts.append("<h2>Video</h2>")
    parts.append(
        f'<p><iframe src="https://player.vimeo.com/video/{vimeo}" '
        f'width="640" height="360" allowfullscreen></iframe></p>'
    )

    if "Vocabulary" in sections:
        header, data = parse_table(sections["Vocabulary"])
        if header:
            parts.append("<h2>Vocabulary</h2>")
            parts.append(render_table(header, data))

    if "Example sentences" in sections:
        header, data = parse_table(sections["Example sentences"])
        if header:
            parts.append("<h2>Example sentences</h2>")
            parts.append(render_table(header, data))

    parts.append("<h2>Download</h2>")
    parts.append(f'<p><a href="../apkg/{anki}">{anki}</a></p>')
    parts.append("</body>")
    parts.append("</html>")
    return "\n".join(parts) + "\n"


def render_index(metas):
    parts = [
        "<!DOCTYPE html>",
        '<html lang="en">',
        "<head>",
        '<meta charset="utf-8">',
        "<title>erli.bg</title>",
        '<meta name="viewport" content="width=device-width,initial-scale=1">',
        "<style>body{max-width:40em;margin:1em;}</style>",
        "</head>",
        "<body>",
        "<h1>erli.bg</h1>",
        (
            "<p>A learning resource for Sofia-Erli, the Romani dialect "
            "spoken in the Erli community of Sofia, Bulgaria. The site "
            "is non-commercial, open access, and deliberately low-tech "
            "so it loads on any device including basic phones.</p>"
        ),
        "<h2>Lessons</h2>",
        "<ul>",
    ]
    for m in metas:
        n = int(m["number"])
        nn = f"{n:02d}"
        parts.append(
            f'<li><a href="lessons/lesson-{nn}.html">'
            f'Lesson {n}: {m["title"]}</a></li>'
        )
    parts += [
        "</ul>",
        "<h2>About</h2>",
        "<ul>",
        '<li><a href="about.html">About the project</a></li>',
        '<li><a href="sources.html">Sources and references</a></li>',
        "</ul>",
        "</body>",
        "</html>",
    ]
    return "\n".join(parts) + "\n"


def main():
    LESSONS.mkdir(exist_ok=True)
    metas = []
    for md in sorted(CONTENT.glob("lesson-*.md")):
        meta, body = parse_frontmatter(md.read_text(encoding="utf-8"))
        sections = parse_body(body)
        html = render_lesson(meta, sections)
        n = int(meta["number"])
        out = LESSONS / f"lesson-{n:02d}.html"
        out.write_text(html, encoding="utf-8")
        metas.append(meta)
        print(f"wrote {out.relative_to(ROOT)} ({len(html)} bytes)")
    metas.sort(key=lambda m: int(m["number"]))
    index_html = render_index(metas)
    (ROOT / "index.html").write_text(index_html, encoding="utf-8")
    print(f"wrote index.html ({len(index_html)} bytes)")


if __name__ == "__main__":
    main()
