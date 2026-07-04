#!/usr/bin/env python3
"""Convert Yijing hexagram XHTML files to structured JSON."""

import json
import re
from pathlib import Path
from bs4 import BeautifulSoup, Tag

INPUT_DIR  = Path(__file__).parent / "OPS"
OUTPUT_DIR = Path(__file__).parent / "TEXT"

SKIP_STEMS = {
    "c01_tuan", "c02_da_xiang", "c03_xiao_xiang",
    "c04_wen_yan", "c05_xi_ci_shang", "c06_xi_ci_xia",
    "c07_shuo_gua", "c08_xu_gua", "c09_za_gua",
}

CHINESE_DIGIT = {'一': 1, '二': 2, '三': 3, '四': 4, '五': 5,
                 '六': 6, '七': 7, '八': 8, '九': 9}
CHINESE_UNIT  = {'十': 10, '百': 100}


def parse_chinese_ordinal(s: str) -> int:
    result, temp = 0, 0
    for ch in s:
        if ch in CHINESE_DIGIT:
            temp = CHINESE_DIGIT[ch]
        elif ch in CHINESE_UNIT:
            result += (temp or 1) * CHINESE_UNIT[ch]
            temp = 0
    return result + temp


def extract_text(tag) -> str:
    """Recursively extract plain text; resolve mw:LanguageVariant self-closing spans."""
    parts = []
    for child in tag.children:
        if isinstance(child, Tag):
            if child.get('typeof') == 'mw:LanguageVariant':
                try:
                    v = json.loads(child.get('data-mw-variant', '{}'))
                    parts.append(v.get('disabled', {}).get('t', ''))
                except (json.JSONDecodeError, KeyError):
                    pass
            else:
                parts.append(extract_text(child))
        else:
            parts.append(str(child))
    return ''.join(parts)


def strip_name_prefix(raw: str) -> str:
    """Remove leading 'HexName：' from a 卦辭 string."""
    colon = raw.find('：')
    return raw[colon + 1:].strip() if colon >= 0 else raw


YAO_LABELS = ['初九', '初六', '九二', '六二', '九三', '六三', '九四', '六四',
              '九五', '六五', '上九', '上六', '用九', '用六']

def parse_yao_line(raw: str) -> dict:
    # Labels are normally followed by '：', but at least one source page (否)
    # uses '，' instead — match the label itself rather than assuming a colon.
    for label in YAO_LABELS:
        if raw.startswith(label) and raw[len(label):len(label) + 1] in '：，:,':
            return {"label": label, "text": raw[len(label) + 1:].strip()}
    colon = raw.find('：')
    if colon >= 0:
        return {"label": raw[:colon], "text": raw[colon + 1:].strip()}
    return {"label": "", "text": raw}


YANG = "========="
YIN  = "===   ==="

def hexagram_art(yao_ci: list) -> list[str]:
    lines = []
    for entry in yao_ci:
        label = entry['label']
        if '用' in label:
            continue
        if '九' in label:
            lines.append(YANG)
        elif '六' in label:
            lines.append(YIN)
    return list(reversed(lines))  # display top-to-bottom


def parse_file(path: Path) -> dict | None:
    soup = BeautifulSoup(path.read_text(encoding='utf-8'), 'html.parser')
    section = soup.find('section')
    if not section:
        return None

    # Hexagram name: prefer <dl><dt> (handles LanguageVariant chars like 无妄)
    dt = section.find('dl') and section.find('dl').find('dt')
    if dt:
        hex_name = extract_text(dt).strip()
    else:
        title_tag = soup.find('title')
        hex_name = title_tag.get_text().strip() if title_tag else path.stem

    # Hexagram number from "周易　第X卦"
    hex_number = None
    for p in section.find_all('p'):
        text = p.get_text()
        m = re.search(r'第(.+?)卦', text)
        if m:
            hex_number = parse_chinese_ordinal(m.group(1))
            break
    if hex_number is None:
        return None

    result: dict = {
        "hexagram_number": hex_number,
        "hexagram_name": hex_name,
        "ascii_art": [],
        "yi_jing": {"gua_ci": "", "yao_ci": []},
        "tuan": "",
        "xiang": {"da_xiang": "", "xiao_xiang": []},
    }

    # Walk direct-child <ul> elements of <section>
    for ul in section.find_all('ul', recursive=False):
        top_li = ul.find('li', recursive=False)
        if not top_li:
            continue
        bold = top_li.find('b')
        if not bold:
            continue
        section_label = extract_text(bold).strip().rstrip('：:')

        if '易經' in section_label:
            inner_ul = top_li.find('ul', recursive=False)
            if inner_ul:
                gua_ci_li = inner_ul.find('li', recursive=False)
                if gua_ci_li:
                    raw = extract_text(gua_ci_li).strip()
                    result['yi_jing']['gua_ci'] = strip_name_prefix(raw)

            ol = top_li.find('ol', recursive=False)
            if ol:
                for li in ol.find_all('li', recursive=False):
                    raw = extract_text(li).strip()
                    if raw:
                        result['yi_jing']['yao_ci'].append(parse_yao_line(raw))

        elif '彖曰' in section_label:
            inner_ul = top_li.find('ul', recursive=False)
            if inner_ul:
                result['tuan'] = extract_text(inner_ul).strip()

        elif '象曰' in section_label:
            inner_ul = top_li.find('ul', recursive=False)
            if inner_ul:
                da_li = inner_ul.find('li', recursive=False)
                if da_li:
                    result['xiang']['da_xiang'] = extract_text(da_li).strip()

            ol = top_li.find('ol', recursive=False)
            if ol:
                for li in ol.find_all('li', recursive=False):
                    raw = extract_text(li).strip()
                    if raw:
                        result['xiang']['xiao_xiang'].append(raw)

        elif '文言' in section_label:
            # Preserve 文言 as flat text blocks; only 乾 and 坤 have this
            blocks = []
            inner_ul = top_li.find('ul', recursive=False)
            if inner_ul:
                blocks.append(extract_text(inner_ul).strip())
            ol = top_li.find('ol', recursive=False)
            if ol:
                for li in ol.find_all('li', recursive=False):
                    raw = extract_text(li).strip()
                    if raw:
                        blocks.append(raw)
            if blocks:
                result['wen_yan'] = blocks

    result['ascii_art'] = hexagram_art(result['yi_jing']['yao_ci'])
    return result


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    processed, skipped, errors = 0, 0, []

    for path in sorted(INPUT_DIR.glob('*.xhtml')):
        if path.stem in SKIP_STEMS:
            skipped += 1
            continue

        try:
            data = parse_file(path)
            if not data:
                print(f"  SKIP {path.name} — no hexagram number")
                skipped += 1
                continue

            # .js rather than .json: reading.html loads hexagrams via <script>
            # tags (each file calls HEX() to register itself) so it works on
            # file:// with no server and no separate build/copy step.
            out_name = f"{data['hexagram_number']:02d}_{data['hexagram_name']}.js"
            out_path = OUTPUT_DIR / out_name
            out_path.write_text(
                f"HEX('text', {json.dumps(data, ensure_ascii=False, indent=2)});\n",
                encoding='utf-8',
            )
            print(f"  OK   {path.name} → {out_name}")
            processed += 1
        except Exception as e:
            import traceback
            print(f"  ERR  {path.name}: {e}")
            traceback.print_exc()
            errors.append((path.name, str(e)))

    print(f"\n{processed} hexagrams written, {skipped} skipped, {len(errors)} errors")
    for name, err in errors:
        print(f"  ! {name}: {err}")


if __name__ == "__main__":
    main()
