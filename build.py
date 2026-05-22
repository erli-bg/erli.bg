#!/usr/bin/env python3
"""
build.py - generate static HTML for erli.bg from Markdown sources.

Reads content/lesson-*.md, writes lessons/lesson-NN.html, and rewrites
index.html so new lessons appear in the list automatically. No external
dependencies. Run with: python3 build.py

Lesson publication is tied to the presence of the .apkg file. While no
.apkg files exist in apkg/, the index shows all ten lessons from
content/ as a curriculum preview. As soon as the first .apkg arrives,
only published lessons (those with their .apkg in apkg/) appear, and
HTML files for unpublished lessons are removed from lessons/.
"""

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONTENT = ROOT / "content"
LESSONS = ROOT / "lessons"
APKG = ROOT / "apkg"

PLACEHOLDER_COMMENT = (
    "<!-- PLACEHOLDER vocabulary, replace with verified Sofia-Erli "
    "data from Kostov reference and field recordings -->"
)

LESSON_STYLE = (
    "<style>"
    "body{font-family:Times,\"Times New Roman\",serif;"
    "max-width:40em;margin:1em;line-height:1.45}"
    "table{border-collapse:collapse;margin:0.7em 0}"
    "th,td{padding:0.3em 0.6em;text-align:left;vertical-align:top}"
    "th{font-weight:bold}"
    ".video-wrapper{position:relative;width:100%;max-width:800px;"
    "margin:1.5em auto;aspect-ratio:16/9}"
    ".video-wrapper iframe{position:absolute;inset:0;width:100%;"
    "height:100%;border:0}"
    "@media (max-width:480px){.video-wrapper{margin:1em 0}}"
    "</style>"
)

INDEX_STYLE = (
    "<style>"
    "body{font-family:Times,\"Times New Roman\",serif;"
    "max-width:40em;margin:1em;line-height:1.45}"
    "ul.lessons{list-style:none;padding-left:0}"
    "ul.lessons li{display:flex;gap:1em;align-items:baseline}"
    ".lesson-date{font-variant-numeric:tabular-nums;"
    "min-width:4.5em}"
    "</style>"
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
        LESSON_STYLE,
        "</head>",
        "<body>",
        '<p><a href="../">back to index</a></p>',
        f"<h1>{full}</h1>",
        (
            f'<div class="video-wrapper"><iframe src="https://player.vimeo.com/video/{vimeo}" '
            f'allowfullscreen></iframe></div>'
        ),
    ]

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
        INDEX_STYLE,
        "</head>",
        "<body>",
        "<h1>Erli</h1>",
        (
            "<p>In Fakulteta people speak Erli, a dialect of Romi. "
            "There are very few resources on it. Here you find videos "
            "with vocabulary to learn this language. The site is "
            "non-commercial, open access, and very simple. It can "
            "load easily on most devices.</p>"
        ),
        "<h2>Pronunciation</h2>",
        '<ul class="lessons">',
        '<li><span class="lesson-date">-&gt;</span><a href="pronunciation/vowels.html">Vowels</a></li>',
        '<li><span class="lesson-date">-&gt;</span><a href="pronunciation/consonants.html">Consonants</a></li>',
        '<li><span class="lesson-date">-&gt;</span><a href="pronunciation/aspirated.html">Aspirated consonants</a></li>',
        '<li><span class="lesson-date">-&gt;</span><a href="pronunciation/word-final.html">A note on word-final sounds</a></li>',
        '<li><span class="lesson-date">-&gt;</span><a href="pronunciation/archaic.html">The archaic ř</a></li>',
        '<li><span class="lesson-date">-&gt;</span><a href="pronunciation/stress.html">Stress</a></li>',
        "</ul>",
        "<h2>Lessons</h2>",
        '<ul class="lessons">',
    ]
    for m in metas:
        n = int(m["number"])
        nn = f"{n:02d}"
        date = m.get("release_date", "")
        parts.append(
            f'<li><span class="lesson-date">{date}</span>'
            f'<a href="lessons/lesson-{nn}.html">'
            f'Lesson {n}: {m["title"]}</a></li>'
        )
    parts += [
        "</ul>",
        "<h2>About</h2>",
        '<ul class="lessons">',
        '<li><span class="lesson-date">-&gt;</span><a href="about/who.html">Who?</a></li>',
        '<li><span class="lesson-date">-&gt;</span><a href="about/why.html">Why?</a></li>',
        "</ul>",
        "</body>",
        "</html>",
    ]
    return "\n".join(parts) + "\n"


def is_lesson_published(meta):
    """A lesson is published when its .apkg file exists in apkg/."""
    nn = f"{int(meta['number']):02d}"
    anki = meta.get("anki_file") or f"lesson-{nn}.apkg"
    return (APKG / anki).exists()


def main():
    LESSONS.mkdir(exist_ok=True)

    all_metas = []
    sources = {}
    for md in sorted(CONTENT.glob("lesson-*.md")):
        meta, body = parse_frontmatter(md.read_text(encoding="utf-8"))
        all_metas.append(meta)
        sources[int(meta["number"])] = body

    published = [m for m in all_metas if is_lesson_published(m)]

    # Variante A: while no .apkg has landed yet, the index shows all
    # ten lessons from content/ as a curriculum preview. As soon as
    # the first .apkg arrives in apkg/, only published lessons appear
    # and HTML for unpublished lessons is removed.
    active = published if published else all_metas
    active.sort(key=lambda m: int(m["number"]))

    rendered_names = set()
    for meta in active:
        body = sources[int(meta["number"])]
        sections = parse_body(body)
        html = render_lesson(meta, sections)
        n = int(meta["number"])
        out = LESSONS / f"lesson-{n:02d}.html"
        out.write_text(html, encoding="utf-8")
        rendered_names.add(out.name)
        print(f"wrote {out.relative_to(ROOT)} ({len(html)} bytes)")

    for existing in LESSONS.glob("lesson-*.html"):
        if existing.name not in rendered_names:
            existing.unlink()
            print(f"removed {existing.relative_to(ROOT)}")

    index_html = render_index(active)
    (ROOT / "index.html").write_text(index_html, encoding="utf-8")
    print(f"wrote index.html ({len(index_html)} bytes)")


if __name__ == "__main__":
    main()
