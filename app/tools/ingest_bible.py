#!/usr/bin/env python3
"""Ingest curator-provided Bible PDFs into edition data (ADR-001 open item: text verification).

Reads pre-extracted page text (kjv_full.txt / web_full.txt from pypdf), pulls WHOLE
chapters for Edition 1, strips editorial matter (section headings, parallel-reference
lines, page markers), applies recorded normalizations, and writes:
  docs/00_bible/extracted/{kjv,web}-edition1.json   (curator-inspectable intermediates)

Recorded normalizations (ADR-001):
  - [brackets] marking KJV supplied words are removed, keeping the word (the print
    convention for italics; the words are part of the KJV text).
  - curly apostrophes/quotes -> straight; whitespace collapsed.
  - psalm superscriptions stay INSIDE verse 1, exactly as the source prints them.
Everything else is verbatim from the source PDF.
"""
import json, re, sys, os

CHAPTERS = [  # (bookId, chapter, header text in PDF)
    ('psalms', 34, 'Psalm 34'), ('psalms', 121, 'Psalm 121'),
    ('isaiah', 6, 'Isaiah 6'), ('isaiah', 41, 'Isaiah 41'),
    ('matthew', 13, 'Matthew 13'), ('mark', 4, 'Mark 4'), ('luke', 8, 'Luke 8'),
    ('john', 3, 'John 3'), ('john', 12, 'John 12'),
    ('galatians', 6, 'Galatians 6'), ('hebrews', 13, 'Hebrews 13'),
    ('1peter', 1, '1 Peter 1'), ('2peter', 3, '2 Peter 3'),
]

HEADER_RE = re.compile(r'^[1-3]? ?[A-Z][a-z]+(?: of [A-Z][a-z]+)? \d+\s*$')  # "Matthew 13", "1 Peter 1", "Song of Solomon 2"
CROSSREF_RE = re.compile(r'\([^)]*\d+:[^)]*\)')  # "(Mark 4:1–9; Luke 8:4–8)"

def normalize(text):
    text = text.replace('’', "'").replace('‘', "'")
    text = text.replace('“', '"').replace('”', '"')
    text = re.sub(r'\[([^\]]+)\]', r'\1', text)          # supplied-word brackets -> plain
    text = re.sub(r'[֐-׿]+', ' ', text)        # Hebrew acrostic markers (Ps 34/119 print convention)
    text = re.sub(r"([A-Za-z])' (t|s|d|ll|re|ve|m)\b", r"\1'\2", text)  # split contractions: "didn' t" -> "didn't"
    text = re.sub(r'\s+', ' ', text).strip()
    return text

# Split-word artifacts from PDF letter-spacing, found by scan and repaired EXPLICITLY —
# every correction is visible here, none applied silently (ADR-001 verbatim rule).
REPAIRS = {
    ('kjv', 'isaiah', '6', '9'): [('ye i ndeed', 'ye indeed')],
    ('kjv', 'isaiah', '41', '17'): [('and t here', 'and there')],
    ('kjv', 'mark', '4', '11'): [('of t he', 'of the')],
    ('kjv', 'mark', '4', '36'): [('eve n as', 'even as')],
    ('kjv', 'luke', '8', '1'): [('with h im', 'with him')],
    ('kjv', 'luke', '8', '13'): [('r eceive', 'receive')],
    ('kjv', 'luke', '8', '28'): [('voic e said', 'voice said')],
    ('web', 'matthew', '13', '27'): [('c ome', 'come')],
    ('web', 'matthew', '13', '32'): [('s maller', 'smaller')],
    ('web', 'matthew', '13', '55'): [('and h is', 'and his')],
    ('web', 'matthew', '13', '57'): [('hi s own', 'his own')],
    ('web', 'mark', '4', '24'): [('measur e you', 'measure you')],
    ('web', 'luke', '8', '17'): [('t o light', 'to light')],
    ('web', 'luke', '8', '51'): [('e nter', 'enter')],
    ('web', '1peter', '1', '18'): [('th e useless', 'the useless')],
    ('web', '2peter', '3', '15'): [('t o him', 'to him')],
}

def apply_repairs(data, translation):
    count = 0
    for (tr, b, c, v), fixes in REPAIRS.items():
        if tr != translation:
            continue
        for old, new in fixes:
            if old in data[b][c][v]:
                data[b][c][v] = data[b][c][v].replace(old, new)
                count += 1
            else:
                print(f'  repair NOT NEEDED (already clean?): {tr} {b} {c}:{v} "{old}"')
    print(f'{translation}: {count} explicit split-word repairs applied')
    return data

def looks_heading(line):
    """Shape of an editorial heading: short, starts uppercase, no sentence punctuation."""
    s = line.strip()
    if not s or any(c in s for c in '.;:?!,'):
        return False
    words = s.split()
    return 1 <= len(words) <= 9 and s[0].isupper() and not s[0].isdigit()

def next_starts_verse_or_ref(lines, i):
    """True when the following content line begins a new verse (bare number) or is a
    parallel-reference line — the only two things a heading precedes in this layout.
    Guards against eating punctuation-free VERSE FRAGMENTS (e.g. 'And great multitudes were')."""
    j = i + 1
    while j < len(lines):
        s = lines[j].strip()
        j += 1
        if not s or s.startswith('@@PAGE'):
            continue
        return bool(re.match(r'^\d{1,3}\b', s)) or bool(re.match(r'^\([^)]*\d+:', s))
    return False

def extract_chapter(lines, start_idx, label):
    """From the chapter header line, collect verse map until the next chapter header."""
    i = start_idx + 1
    body = []
    while i < len(lines):
        line = lines[i]
        if HEADER_RE.match(line.strip()) and i + 1 < len(lines) and '[Online]' in lines[i + 1]:
            break  # next chapter begins
        s = line.strip()
        if not s or s.startswith('@@PAGE') or '[Online]' in s:
            i += 1
            continue
        if looks_heading(CROSSREF_RE.sub(' ', s).strip()) and next_starts_verse_or_ref(lines, i):
            i += 1
            continue
        body.append(CROSSREF_RE.sub(' ', s))
        i += 1
    # Sequential verse split: accept a bare integer token only when it is the NEXT verse.
    tokens = ' '.join(body).split()
    verses, current, expected = {}, [], 1
    for tok in tokens:
        if tok.isdigit() and int(tok) == expected:
            if expected > 1:
                verses[str(expected - 1)] = normalize(' '.join(current))
            current, expected = [], expected + 1
        else:
            current.append(tok)
    if expected > 1:
        verses[str(expected - 1)] = normalize(' '.join(current))
    if not verses:
        sys.exit(f'FATAL: no verses parsed for {label}')
    return verses

def ingest(txt_path, translation):
    lines = open(txt_path, encoding='utf-8').read().splitlines()
    # index all chapter-header line numbers
    headers = {}
    for idx, line in enumerate(lines):
        s = line.strip()
        if HEADER_RE.match(s) and idx + 1 < len(lines) and '[Online]' in lines[idx + 1]:
            headers.setdefault(s, []).append(idx)
    out = {}
    for book_id, chapter, header in CHAPTERS:
        if header not in headers:
            sys.exit(f'FATAL: header "{header}" not found in {translation}')
        idx = headers[header][0]
        verses = extract_chapter(lines, idx, f'{translation} {header}')
        out.setdefault(book_id, {})[str(chapter)] = verses
        print(f'{translation} {header}: {len(verses)} verses')
    return out

if __name__ == '__main__':
    cache_dir = sys.argv[1]  # dir containing kjv_full.txt / web_full.txt
    os.makedirs('docs/00_bible/extracted', exist_ok=True)
    for tr in ('kjv', 'web'):
        data = ingest(os.path.join(cache_dir, f'{tr}_full.txt'), tr.upper())
        data = apply_repairs(data, tr)
        # post-repair artifact scan: any residual standalone lowercase letter fails loudly
        for b, chs in data.items():
            for c, vs in chs.items():
                for v, t in vs.items():
                    if re.search(r'(?:^|\s)[b-z](?= [a-z])', t):
                        sys.exit(f'FATAL: residual split-word artifact in {tr} {b} {c}:{v}: {t}')
        with open(f'docs/00_bible/extracted/{tr}-edition1.json', 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
    print('extracted -> docs/00_bible/extracted/')
