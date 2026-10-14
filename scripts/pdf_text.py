"""Create UTF-8 text companions without modifying original PDFs."""
import os
import re
import subprocess
import tempfile
from pathlib import Path


def extract_pdf_text(path):
    import fitz

    pages = []
    used_ocr = False
    with fitz.open(path) as document:
        for number, page in enumerate(document, 1):
            text = page.get_text('text', sort=True).strip()
            # A scanned page can contain only a page number or a watermark.
            if len(re.findall(r'[^\W\d_]', text, flags=re.UNICODE)) < 20:
                used_ocr = True
                with tempfile.TemporaryDirectory(prefix='adeshpustika-ocr-') as temporary:
                    image = Path(temporary) / 'page.png'
                    page.get_pixmap(dpi=300, colorspace=fitz.csRGB, alpha=False).save(image)
                    command = ['tesseract', str(image), 'stdout', '-l', 'nep+eng', '--psm', '3']
                    if os.environ.get('TESSDATA_PREFIX'):
                        command += ['--tessdata-dir', os.environ['TESSDATA_PREFIX']]
                    result = subprocess.run(command, capture_output=True, text=True,
                                            encoding='utf-8', check=True, timeout=180,
                                            env={**os.environ, 'OMP_THREAD_LIMIT': '1'})
                    text = result.stdout.strip()
            text = text.replace('\x00', '').replace('\r\n', '\n')
            pages.append(text or f'[Page {number}: no readable text was detected.]')
    if not pages:
        raise ValueError(f'PDF has no pages: {path}')
    return '\n\n\f\n\n'.join(pages) + '\n', 'ocr' if used_ocr else 'extracted'


def add_text_companion(root, path, entry):
    # A corrected text file beside its PDF takes precedence over automatic OCR.
    sidecar = path.with_suffix('.txt')
    if sidecar.is_file() and not sidecar.is_symlink():
        sidecar.read_text(encoding='utf-8-sig')  # Validate the uploaded encoding.
        entry.update(textPath=sidecar.relative_to(root).as_posix(), textMethod='provided')
        return
    text, method = extract_pdf_text(path)
    target = root / '_text' / path.relative_to(root).with_suffix('.txt')
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(text, encoding='utf-8')
    entry.update(textPath=target.relative_to(root).as_posix(), textMethod=method)
