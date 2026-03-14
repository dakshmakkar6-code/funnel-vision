from pathlib import Path
from tempfile import TemporaryDirectory
from typing import Any

from fpdf import FPDF
from PIL import Image, ImageDraw


def generate_teardown_report(image_path: str | list[str], bounding_boxes: list[dict], flow_analysis: dict) -> str:
    image_paths = [image_path] if isinstance(image_path, str) else image_path
    image_files = [Path(path) for path in image_paths if Path(path).exists()]
    if not image_files:
        raise FileNotFoundError("No valid screenshot files found for report generation.")

    normalized_boxes: list[dict[str, Any]] = []
    for item in bounding_boxes:
        if isinstance(item, dict):
            normalized_boxes.append(item)
        elif isinstance(item, list):
            normalized_boxes.extend(box for box in item if isinstance(box, dict))

    pdf = FPDF()
    pdf.set_auto_page_break(auto=True, margin=10)
    pdf.add_page()
    pdf.set_font("Helvetica", "B", 18)
    pdf.cell(0, 12, "FunnelVision Teardown Report", new_x="LMARGIN", new_y="NEXT", align="C")

    with TemporaryDirectory() as tmp_dir:
        tmp_dir_path = Path(tmp_dir)
        segment_top = 0.0
        for page_index, image_file in enumerate(image_files, start=1):
            image = Image.open(image_file).convert("RGB")
            image_width_px, image_height_px = image.size
            segment_bottom = segment_top + float(image_height_px)
            draw = ImageDraw.Draw(image)

            for box in normalized_boxes:
                x = box.get("x")
                y = box.get("y")
                width = box.get("width")
                height = box.get("height")
                if x is None or y is None or width is None or height is None:
                    continue

                x_val = float(x)
                y_val = float(y)
                width_val = float(width)
                height_val = float(height)
                if y_val + height_val <= segment_top or y_val >= segment_bottom:
                    continue

                local_y = y_val - segment_top
                draw.rectangle(
                    (x_val, local_y, x_val + width_val, local_y + height_val),
                    outline="red",
                    width=5,
                )

            marked_path = tmp_dir_path / f"marked_slice_{page_index:03d}.png"
            image.save(marked_path)

            if page_index > 1:
                pdf.add_page()

            content_width_mm = pdf.w - pdf.l_margin - pdf.r_margin
            pdf.set_font("Helvetica", "B", 12)
            pdf.cell(0, 8, f"Screenshot {page_index}", new_x="LMARGIN", new_y="NEXT")
            pdf.image(str(marked_path), x=pdf.l_margin, y=pdf.get_y(), w=content_width_mm)

            segment_top = segment_bottom

    pdf.add_page()
    pdf.set_font("Helvetica", "", 12)

    friction_text = flow_analysis.get("F") or flow_analysis.get("Friction") or ""
    legitimacy_text = flow_analysis.get("L") or flow_analysis.get("Legitimacy") or ""
    offer_clarity_text = flow_analysis.get("O") or flow_analysis.get("Offer Clarity") or ""
    willingness_text = flow_analysis.get("W") or flow_analysis.get("Willingness to Buy") or ""

    sections = [
        ("Friction", friction_text),
        ("Legitimacy", legitimacy_text),
        ("Offer Clarity", offer_clarity_text),
        ("Willingness to Buy", willingness_text),
    ]

    for title, text in sections:
        pdf.set_font("Helvetica", "B", 13)
        pdf.cell(0, 8, title, new_x="LMARGIN", new_y="NEXT")
        pdf.set_font("Helvetica", "", 12)
        pdf.multi_cell(0, 7, str(text).strip() if text else "")
        pdf.ln(2)

    output_path = Path("teardown_report.pdf")
    pdf.output(str(output_path))
    return str(output_path)
