#!/usr/bin/env python3
"""Render the two Markdown CVs as single-page A4 PDFs.

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


CV_ROOT = Path(__file__).resolve().parent
ROOT = CV_ROOT.parent
OUTPUT = ROOT / "public"
MARGIN = 38
# SimpleDocTemplate's frame has 6 pt of padding on each side.
WIDTH = A4[0] - 2 * MARGIN - 12
NAVY = colors.HexColor("#234D68")
RULE = colors.HexColor("#C7D4DE")


def plain(text):
    """Normalize typography for PDF output without changing the source files."""
    return text.replace("–", "-").replace("—", "-").replace("’", "'")


def markup(text):
    text = escape(plain(text))
    text = re.sub(
        r"\[([^\]]+)\]\((https://[^)]+)\)",
        r'<link href="\2" color="#000000">\1</link>',
        text,
    )
    text = text.replace(
        "krystof@liskovec.dev",
        '<link href="mailto:krystof@liskovec.dev" color="#000000">krystof@liskovec.dev</link>',
    )
    return text


def style(name, **kwargs):
    settings = dict(
        fontName="CV-Regular", fontSize=10.5, leading=14,
        textColor=colors.black, alignment=TA_LEFT,
        splitLongWords=False, spaceAfter=4,
    )
    settings.update(kwargs)
    return ParagraphStyle(name, **settings)


class DatedRow(Flowable):
    """One logical row with a left label and right-aligned date."""

    def __init__(self, left, right, bold=True, company=False):
        super().__init__()
        self.left, self.right = plain(left), plain(right)
        self.font = "CV-Bold" if bold else "CV-Regular"
        self.size = 11.5 if company else 10.5
        self.color = NAVY if company else colors.black
        self.height = 21 if company else 19
        self.keepWithNext = True

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        needed = (
            pdfmetrics.stringWidth(self.left, self.font, self.size)
            + pdfmetrics.stringWidth(self.right, "CV-Regular", 10.5)
            + 16
        )
        if needed > avail_width:
            raise ValueError(f"Date row would overlap: {self.left}")
        return self.width, self.height

    def draw(self):
        self.canv.setFillColor(self.color)
        self.canv.setFont(self.font, self.size)
        self.canv.drawString(0, 5, self.left)
        self.canv.setFillColor(colors.black)
        self.canv.setFont("CV-Regular", 10.5)
        self.canv.drawRightString(self.width, 5, self.right)


class SectionHeading(Flowable):
    """A navy section label with a quiet rule extending to the right margin."""

    def __init__(self, label):
        super().__init__()
        self.label = plain(label)
        self.height = 21
        self.spaceBefore = 12
        self.keepWithNext = True

    def wrap(self, avail_width, avail_height):
        self.width = avail_width
        return self.width, self.height

    def draw(self):
        self.canv.setFillColor(NAVY)
        self.canv.setFont("CV-Bold", 11.5)
        self.canv.drawString(0, 7, self.label)
        start = pdfmetrics.stringWidth(self.label, "CV-Bold", 11.5) + 12
        self.canv.setStrokeColor(RULE)
        self.canv.setLineWidth(0.6)
        self.canv.line(start, 11, self.width, 11)


def build(source, destination):
    raw = source.read_text(encoding="utf-8")
    lines = [line.strip() for line in raw.splitlines()
             if line.strip() and not line.startswith("<!--")]
    body = style("body")
    styles = {
        "name": style("name", fontName="CV-Bold", fontSize=30, leading=35, spaceAfter=5),
        "target": style("target", fontName="CV-Bold", fontSize=13, leading=17,
                        textColor=NAVY, spaceAfter=3),
        "summary": style("summary", spaceAfter=8),
        "contact": style("contact", leading=14, spaceAfter=3),
        "company": style("company", fontName="CV-Bold", fontSize=11, leading=14,
                         spaceAfter=4, keepWithNext=True),
        "bullet": style("bullet", leftIndent=11, firstLineIndent=0,
                        bulletIndent=0, bulletFontName="CV-Regular", bulletFontSize=10.5,
                        spaceAfter=5),
    }
    story = []
    idx = 0
    while idx < len(lines):
        line = lines[idx]
        if line.startswith("# "):
            story.append(Paragraph(markup(line[2:]), styles["name"]))
        elif idx == 1:
            story.append(Paragraph(markup(line), styles["target"]))
        elif idx == 2:
            story.append(Paragraph(markup(line), styles["summary"]))
        elif idx in (3, 4):
            story.append(Paragraph(markup(line), styles["contact"]))
        elif line.startswith("## "):
            story.append(SectionHeading(line[3:]))
        elif line.startswith("### "):
            if idx + 1 < len(lines) and re.fullmatch(r"\w+ \d{4} – Present", lines[idx + 1]):
                story.append(DatedRow(line[4:], lines[idx + 1], company=True))
                idx += 1
            else:
                story.append(Paragraph(markup(line[4:]), styles["company"]))
        elif line.startswith("- "):
            paragraph = Paragraph(markup(line[2:]), styles["bullet"], bulletText="•")
            _, height = paragraph.wrap(WIDTH, A4[1])
            if height > styles["bullet"].leading * 2:
                raise ValueError(f"Bullet exceeds two lines: {line}")
            story.append(paragraph)
        elif re.search(r" · (?:\w+ \d{4} – |\d{4}$)", line):
            left, right = line.rsplit(" · ", 1)
            story.append(Spacer(1, 7))
            story.append(DatedRow(left, right, bold=not left.startswith("Bachelor")))
        else:
            story.append(Paragraph(markup(line), body))
        idx += 1

    doc = SimpleDocTemplate(
        str(destination), pagesize=A4,
        leftMargin=MARGIN, rightMargin=MARGIN,
        topMargin=37, bottomMargin=37,
        title=f"Kryštof Lískovec - {lines[1]}",
        author="Kryštof Lískovec", subject="English CV",
    )
    doc.build(story)
    info = subprocess.check_output(["pdfinfo", str(destination)], text=True)
    if not re.search(r"Pages:\s+1\b", info):
        raise ValueError(f"Expected one page: {destination}")
    extracted = subprocess.check_output(["pdftotext", str(destination), "-"], text=True)
    compact = lambda value: " ".join(value.split())
    for line in lines:
        expected = re.sub(r"^#{1,3} |^- ", "", line)
        expected = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", expected)
        # Dates are drawn as separate text objects, so check the label and date separately.
        for part in expected.split(" · "):
            if compact(plain(part)) not in compact(extracted):
                raise ValueError(f"Missing PDF text: {part}")
    print(f"Verified one-page PDF with complete extracted text: {destination.relative_to(ROOT)}")


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
    output_names = {"devops": "cv.pdf", "backend": "cv-backend.pdf"}
    for role, filename in output_names.items():
        build(CV_ROOT / f"cv-{role}-en.md", OUTPUT / filename)


if __name__ == "__main__":
    main()
