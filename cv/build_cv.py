#!/usr/bin/env python3
"""Render both Markdown CVs in English, German, and Czech as single-page A4 PDFs.

Requires ReportLab and the Liberation Sans fonts. Uses Poppler for validation.
Run from any directory: python3 cv/build_cv.py
"""

import re
import subprocess
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Flowable, Paragraph, SimpleDocTemplate, Spacer


ROOT = Path(__file__).resolve().parents[1]
CV_ROOT = ROOT / "cv"
OUTPUT = ROOT / "public"
MARGIN = 38
# SimpleDocTemplate's frame has 6 pt of padding on each side.
WIDTH = A4[0] - 2 * MARGIN - 12
INK = colors.HexColor("#151827")
TEAL = colors.HexColor("#157582")
PURPLE = colors.HexColor("#7323C3")
MUTED = colors.HexColor("#666666")
RULE = colors.HexColor("#D6D6D6")
SUMMARY_HEADING = {
    "en": "Professional Summary",
    "de": "Kurzprofil",
    "cs": "Profesní profil",
}
DATED_HEADING = re.compile(r"^(.*?) \(([^()]*\d{4} – [^()]+)\)$")
# Body text sizes tried in order until a CV fits on one page.
BODY_SIZES = [10.5, 10.25, 10, 9.75, 9.5]


class PageOverflow(ValueError):
    pass


def plain(text):
    """Normalize typography for PDF output without changing the source files."""
    return text.replace("–", "-").replace(chr(0x2014), "-").replace("’", "'")


def markup(text):
    text = escape(plain(text))
    text = re.sub(
        r"\[([^\]]+)\]\((https://[^)]+)\)",
        r'<link href="\2" color="#157582">\1</link>',
        text,
    )
    text = text.replace(
        "krystof@liskovec.dev",
        '<link href="mailto:krystof@liskovec.dev" color="#157582">krystof@liskovec.dev</link>',
    )
    return text


def style(name, size=10.5, **kwargs):
    settings = dict(
        fontName="CV-Regular", fontSize=size, leading=round(size * 4 / 3, 2),
        textColor=colors.black, alignment=TA_LEFT,
        splitLongWords=False, spaceAfter=4,
    )
    settings.update(kwargs)
    return ParagraphStyle(name, **settings)


class DatedRow(Flowable):
    """A heading with a muted date range aligned to the right."""

    def __init__(self, title, date, company=False):
        super().__init__()
        self.title = plain(title)
        self.date = f" ({plain(date)})"
        self.font = "CV-Bold"
        self.size = 11.5 if company else 10.5
        self.color = PURPLE if company else INK
        self.height = 21 if company else 19
        self.keepWithNext = True

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        needed = (
            pdfmetrics.stringWidth(self.title, self.font, self.size)
            + pdfmetrics.stringWidth(self.date, "CV-Regular", 10)
            + 12
        )
        if needed > avail_width:
            raise ValueError(f"Dated heading exceeds line width: {self.title}")
        return self.width, self.height

    def draw(self):
        text = self.canv.beginText(0, 5)
        text.setFillColor(self.color)
        text.setFont(self.font, self.size)
        text.textOut(self.title)
        self.canv.drawText(text)
        self.canv.setFillColor(MUTED)
        self.canv.setFont("CV-Regular", 10)
        self.canv.drawRightString(self.width, 5, self.date.strip())


class HeaderRule(Flowable):
    """The teal-to-purple rule below the name and role."""

    spaceAfter = 8

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        self.height = 2
        return self.width, self.height

    def draw(self):
        self.canv.saveState()
        path = self.canv.beginPath()
        path.rect(0, 0, self.width, self.height)
        self.canv.clipPath(path, stroke=0)
        self.canv.linearGradient(0, 0, self.width, 0, [TEAL, PURPLE], extend=True)
        self.canv.restoreState()


class SectionHeading(Flowable):
    """An uppercase teal section label above a light rule."""

    def __init__(self, label):
        super().__init__()
        self.label = plain(label).upper()
        self.height = 19
        self.spaceBefore = 8
        self.keepWithNext = True

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        return self.width, self.height

    def draw(self):
        self.canv.setFillColor(TEAL)
        self.canv.setFont("CV-Bold", 10.5)
        self.canv.drawString(0, 8, self.label)
        self.canv.setStrokeColor(RULE)
        self.canv.setLineWidth(0.6)
        self.canv.line(0, 4, self.width, 4)


def build(source, destination, language="en", size=10.5):
    raw = source.read_text(encoding="utf-8")
    lines = [line.strip() for line in raw.splitlines()
             if line.strip() and not line.startswith("<!--")]
    body = style("body", size)
    styles = {
        "name": style("name", fontName="CV-Bold", fontSize=28, leading=32,
                      textColor=INK, spaceAfter=3),
        "target": style("target", fontName="CV-Bold", fontSize=13, leading=17,
                        textColor=TEAL, spaceAfter=5),
        "summary": style("summary", size, spaceAfter=4),
        "contact": style("contact", size, textColor=MUTED, spaceAfter=3),
        "company": style("company", fontName="CV-Bold", fontSize=11, leading=14,
                         spaceAfter=4, keepWithNext=True),
        "bullet": style("bullet", size, leftIndent=11, firstLineIndent=0,
                        bulletIndent=0, bulletFontName="CV-Regular", bulletFontSize=size,
                        spaceAfter=4),
    }
    story = []
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        if line.startswith("# "):
            story.append(Paragraph(markup(line[2:]), styles["name"]))
        elif idx == 1:
            story.append(Paragraph(markup(line.upper()), styles["target"]))
            story.append(HeaderRule())
        elif idx == 2:
            summary = line
        elif idx in (3, 4):
            story.append(Paragraph(markup(line), styles["contact"]))
            if idx == 4:
                story.append(SectionHeading(SUMMARY_HEADING[language]))
                story.append(Paragraph(markup(summary), styles["summary"]))
        elif line.startswith("## "):
            story.append(SectionHeading(line[3:]))
        elif line.startswith("### "):
            if dated := DATED_HEADING.fullmatch(line[4:]):
                story.append(DatedRow(*dated.groups(), company=True))
            else:
                story.append(Paragraph(markup(line[4:]), styles["company"]))
        elif line.startswith("- "):
            paragraph = Paragraph(markup(line[2:]), styles["bullet"], bulletText="•")
            _, height = paragraph.wrap(WIDTH, A4[1])
            if height > styles["bullet"].leading * 2:
                raise ValueError(f"Bullet exceeds two lines: {line}")
            story.append(paragraph)
        elif dated := DATED_HEADING.fullmatch(line):
            story.append(Spacer(1, 7))
            story.append(DatedRow(*dated.groups()))
        else:
            story.append(Paragraph(markup(line), body))
        idx += 1

    doc = SimpleDocTemplate(
        str(destination), pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=37, bottomMargin=37,
        title=f"Kryštof Lískovec - {lines[1]}",
        author="Kryštof Lískovec",
        subject={"en": "English CV", "de": "Deutscher Lebenslauf", "cs": "Český životopis"}[language],
    )
    doc.build(story)
    info = subprocess.check_output(["pdfinfo", str(destination)], text=True)
    if not re.search(r"Pages:\s+1\b", info):
        raise PageOverflow(f"Expected one page: {destination}")
    extracted = subprocess.check_output(["pdftotext", "-layout", str(destination), "-"], text=True)
    compact = lambda value: " ".join(value.split()).casefold()
    for line in lines:
        expected = re.sub(r"^#{1,3} |^- ", "", line)
        expected = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", expected)
        # Poppler can place the contact separators and right-aligned dates apart
        # from the text they accompany.
        if dated := DATED_HEADING.fullmatch(expected):
            expected = " · ".join((dated[1], f"({dated[2]})"))
        for part in expected.split(" · "):
            if compact(plain(part)) not in compact(extracted):
                raise ValueError(f"Missing PDF text: {part}")
    print(f"Verified one-page PDF with complete extracted text ({size} pt): {destination.relative_to(ROOT)}")


def main():
    font_roots = [
        Path("/usr/share/fonts"),
        Path("/usr/local/share/fonts"),
    ]
    font_dir = next(
        (
            candidate.parent
            for root in font_roots
            for candidate in root.rglob("LiberationSans-Regular.ttf")
            if (candidate.parent / "LiberationSans-Bold.ttf").exists()
        ),
        None,
    )
    if font_dir is None:
        raise SystemExit("Install Liberation Sans fonts before building the CVs.")
    for weight in ["Regular", "Bold"]:
        pdfmetrics.registerFont(TTFont(f"CV-{weight}", str(font_dir / f"LiberationSans-{weight}.ttf")))
    OUTPUT.mkdir(parents=True, exist_ok=True)
    for role in ["devops", "backend"]:
        for language in ["en", "de", "cs"]:
            stem = "cv" if role == "devops" else "cv-backend"
            suffix = "" if language == "en" else f"-{language}"
            for size in BODY_SIZES:
                try:
                    build(CV_ROOT / f"cv-{role}-{language}.md", OUTPUT / f"{stem}{suffix}.pdf", language, size)
                    break
                except PageOverflow:
                    if size == BODY_SIZES[-1]:
                        raise


if __name__ == "__main__":
    main()
