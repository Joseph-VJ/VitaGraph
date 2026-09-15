"""Generate synthetic demo health reports (text PDFs) for VitaGraph.

All values are entirely fictional and exist only for development and
demonstration. Two versions of the same panel type are generated with
different dates and values so longitudinal questions can be tested.

Usage (from the vitagraph folder):
    backend/.venv/Scripts/python.exe sample_data/generate_reports.py
"""

from __future__ import annotations

from pathlib import Path

import pymupdf

OUT_DIR = Path(__file__).resolve().parent

REPORT_1 = """Riverdale Diagnostics - Synthetic Demo Laboratory
Patient: Demo Persona A
Collection Date: 15 January 2025
Report ID: SYN-2025-0115-A
Note: This is a synthetic report generated for an academic project.
All values are fictional.

Comprehensive Health Panel

Hemoglobin
Result: 13.8 g/dL
Reference range: 12.0 - 15.5 g/dL

Vitamin D, 25-Hydroxy
Result: 18 ng/mL
Reference range: 30 - 100 ng/mL
Flag: LOW

Cholesterol, Total
Result: 224 mg/dL
Reference range: < 200 mg/dL
Flag: HIGH

LDL Cholesterol
Result: 148 mg/dL
Reference range: < 100 mg/dL
Flag: HIGH

HDL Cholesterol
Result: 44 mg/dL
Reference range: > 40 mg/dL

Fasting Glucose
Result: 96 mg/dL
Reference range: 70 - 99 mg/dL

Thyroid Stimulating Hormone (TSH)
Result: 2.4 uIU/mL
Reference range: 0.4 - 4.0 uIU/mL

General Notes
The patient reported occasional fatigue during afternoon hours in the
covering note. No medication list was provided with this panel.
Interpretation of these values is reserved for the treating clinician.
"""

REPORT_2 = """Riverdale Diagnostics - Synthetic Demo Laboratory
Patient: Demo Persona A
Collection Date: 20 June 2025
Report ID: SYN-2025-0620-A
Note: This is a synthetic report generated for an academic project.
All values are fictional.

Comprehensive Health Panel (Follow-up)

Hemoglobin
Result: 14.1 g/dL
Reference range: 12.0 - 15.5 g/dL

Vitamin D, 25-Hydroxy
Result: 34 ng/mL
Reference range: 30 - 100 ng/mL

Cholesterol, Total
Result: 198 mg/dL
Reference range: < 200 mg/dL

LDL Cholesterol
Result: 126 mg/dL
Reference range: < 100 mg/dL
Flag: HIGH

HDL Cholesterol
Result: 51 mg/dL
Reference range: > 40 mg/dL

Fasting Glucose
Result: 92 mg/dL
Reference range: 70 - 99 mg/dL

Thyroid Stimulating Hormone (TSH)
Result: 2.1 uIU/mL
Reference range: 0.4 - 4.0 uIU/mL

Vitamin B12
Result: 410 pg/mL
Reference range: 200 - 900 pg/mL

General Notes
The patient reports improved energy levels in the mornings and continued
supplement use as advised by their clinician. Interpretation of these
values is reserved for the treating clinician.
"""


def build_pdf(text: str, out_path: Path) -> None:
    doc = pymupdf.open()
    page = doc.new_page(width=595, height=842)  # A4
    margin = 54
    y = margin
    for line in text.split("\n"):
        if not line.strip():
            # Blank source line -> visible vertical gap so extraction
            # preserves the section boundary.
            y += 12
            continue
        page.insert_text((margin, y), line, fontsize=10, fontname="helv")
        y += 14
        if y > 780:
            page = doc.new_page(width=595, height=842)
            y = margin
    doc.save(str(out_path))
    doc.close()
    print(f"wrote {out_path.name} ({out_path.stat().st_size} bytes)")


if __name__ == "__main__":
    build_pdf(REPORT_1, OUT_DIR / "synthetic_panel_2025-01-15.pdf")
    build_pdf(REPORT_2, OUT_DIR / "synthetic_panel_2025-06-20.pdf")
