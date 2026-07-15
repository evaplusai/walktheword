#!/usr/bin/env python3
"""ADR-006: build FULL-CANON editions directly from the curator's source PDFs.

Usage: python3 app/tools/ingest_bible.py <workdir>

Reads docs/00_bible/bible_{kjv,web}.pdf (the ONLY text sources — nothing reused from
prior runs; page text is re-extracted into <workdir> fresh when absent), extracts all
66 books / 1,189 chapters per translation, and writes:

  app/data/edition-2-kjv.json     complete KJV edition (+ curator graph, provenance)
  app/data/edition-2-web.json     complete WEB edition (same graph; anchors are KJV-bound)
  docs/00_bible/extracted/        receipts: canon JSONs, lexicons, bigram checks, autorepairs

Recorded normalizations (nothing silent):
  - supplied-word [brackets] -> plain; curly quotes -> straight; split contractions rejoined
  - Hebrew acrostic markers stripped; ALL-CAPS acrostic titles (ALEPH.) dropped only when
    they precede a verse number (same guard as section headings)
  - psalm superscriptions stay INSIDE verse 1 as the source prints them
  - PDF letter-spacing split words: explicit REPAIRS list + corpus-lexicon scan +
    single-letter rule + join-vs-bigram frequency test; every join receipted; fail-loud
Structural gates: every book must yield EXACTLY its canonical chapter count; every
chapter's verses must be contiguous from 1.
"""
import hashlib, json, os, re, sys, time
from collections import Counter

# (id, display name, PDF header name, canonical order, canonical chapter count)
BOOKS = [
    ('genesis','Genesis','Genesis',1,50),('exodus','Exodus','Exodus',2,40),
    ('leviticus','Leviticus','Leviticus',3,27),('numbers','Numbers','Numbers',4,36),
    ('deuteronomy','Deuteronomy','Deuteronomy',5,34),('joshua','Joshua','Joshua',6,24),
    ('judges','Judges','Judges',7,21),('ruth','Ruth','Ruth',8,4),
    ('1samuel','1 Samuel','1 Samuel',9,31),('2samuel','2 Samuel','2 Samuel',10,24),
    ('1kings','1 Kings','1 Kings',11,22),('2kings','2 Kings','2 Kings',12,25),
    ('1chronicles','1 Chronicles','1 Chronicles',13,29),('2chronicles','2 Chronicles','2 Chronicles',14,36),
    ('ezra','Ezra','Ezra',15,10),('nehemiah','Nehemiah','Nehemiah',16,13),
    ('esther','Esther','Esther',17,10),('job','Job','Job',18,42),
    ('psalms','Psalms','Psalm',19,150),('proverbs','Proverbs','Proverbs',20,31),
    ('ecclesiastes','Ecclesiastes','Ecclesiastes',21,12),('songofsolomon','Song of Solomon','Song of Solomon',22,8),
    ('isaiah','Isaiah','Isaiah',23,66),('jeremiah','Jeremiah','Jeremiah',24,52),
    ('lamentations','Lamentations','Lamentations',25,5),('ezekiel','Ezekiel','Ezekiel',26,48),
    ('daniel','Daniel','Daniel',27,12),('hosea','Hosea','Hosea',28,14),
    ('joel','Joel','Joel',29,3),('amos','Amos','Amos',30,9),
    ('obadiah','Obadiah','Obadiah',31,1),('jonah','Jonah','Jonah',32,4),
    ('micah','Micah','Micah',33,7),('nahum','Nahum','Nahum',34,3),
    ('habakkuk','Habakkuk','Habakkuk',35,3),('zephaniah','Zephaniah','Zephaniah',36,3),
    ('haggai','Haggai','Haggai',37,2),('zechariah','Zechariah','Zechariah',38,14),
    ('malachi','Malachi','Malachi',39,4),
    ('matthew','Matthew','Matthew',40,28),('mark','Mark','Mark',41,16),
    ('luke','Luke','Luke',42,24),('john','John','John',43,21),
    ('acts','Acts','Acts',44,28),('romans','Romans','Romans',45,16),
    ('1corinthians','1 Corinthians','1 Corinthians',46,16),('2corinthians','2 Corinthians','2 Corinthians',47,13),
    ('galatians','Galatians','Galatians',48,6),('ephesians','Ephesians','Ephesians',49,6),
    ('philippians','Philippians','Philippians',50,4),('colossians','Colossians','Colossians',51,4),
    ('1thessalonians','1 Thessalonians','1 Thessalonians',52,5),('2thessalonians','2 Thessalonians','2 Thessalonians',53,3),
    ('1timothy','1 Timothy','1 Timothy',54,6),('2timothy','2 Timothy','2 Timothy',55,4),
    ('titus','Titus','Titus',56,3),('philemon','Philemon','Philemon',57,1),
    ('hebrews','Hebrews','Hebrews',58,13),('james','James','James',59,5),
    ('1peter','1 Peter','1 Peter',60,5),('2peter','2 Peter','2 Peter',61,3),
    ('1john','1 John','1 John',62,5),('2john','2 John','2 John',63,1),
    ('3john','3 John','3 John',64,1),('jude','Jude','Jude',65,1),
    ('revelation','Revelation','Revelation',66,22),
]
assert sum(n for *_, n in BOOKS) == 1189 and len(BOOKS) == 66

CROSSREF_RE = re.compile(r'\([^)]*\d+:[^)]*\)')

# Explicit split-word repairs found by earlier judged rounds — re-validated every run
# (each prints NOT NEEDED if the fresh extraction doesn't contain it).
REPAIRS = {
    ('kjv','isaiah','6','9'):[('ye i ndeed','ye indeed')],('kjv','isaiah','41','17'):[('and t here','and there')],
    ('kjv','mark','4','11'):[('of t he','of the')],('kjv','mark','4','36'):[('eve n as','even as')],
    ('kjv','luke','8','1'):[('with h im','with him')],('kjv','luke','8','13'):[('r eceive','receive')],
    ('kjv','luke','8','28'):[('voic e said','voice said')],
    ('web','matthew','13','27'):[('c ome','come')],('web','matthew','13','32'):[('s maller','smaller')],
    ('web','matthew','13','55'):[('and h is','and his')],('web','matthew','13','57'):[('hi s own','his own')],
    ('web','mark','4','24'):[('measur e you','measure you')],('web','luke','8','17'):[('t o light','to light')],
    ('web','luke','8','51'):[('e nter','enter')],('web','1peter','1','18'):[('th e useless','the useless')],
    ('web','2peter','3','15'):[('t o him','to him')],
}

def sha256_file(path):
    h = hashlib.sha256()
    with open(path,'rb') as f:
        for chunk in iter(lambda: f.read(1<<20), b''):
            h.update(chunk)
    return h.hexdigest()

def extract_pages(pdf_path, cache_path):
    """Fresh page-text extraction from THIS pdf (cached per-run file keyed to pdf hash)."""
    from pypdf import PdfReader
    t0 = time.time()
    r = PdfReader(pdf_path)
    with open(cache_path,'w',encoding='utf-8') as f:
        for i,p in enumerate(r.pages):
            f.write(f'\n@@PAGE {i+1}@@\n'); f.write(p.extract_text() or '')
    print(f'  extracted {len(r.pages)} pages in {time.time()-t0:.0f}s')

def normalize(text):
    text = text.replace('’',"'").replace('‘',"'").replace('“','"').replace('”','"')
    text = re.sub(r'\[([^\]]+)\]', r'\1', text)
    text = re.sub(r'[֐-׿]+',' ',text)
    text = re.sub(r"([A-Za-z])' (t|s|d|ll|re|ve|m)\b", r"\1'\2", text)
    return re.sub(r'\s+',' ',text).strip()

ACROSTIC = r'(?:ALEPH|BETH|GIMEL|DALETH|HE|WAW|VAU|ZAYIN|ZAIN|HETH|CHETH|TETH|YODH|JOD|YOD|KAPH|CAPH|LAMEDH|LAMED|MEM|NUN|SAMEKH|SAMECH|AYIN|AIN|PE|TZADDI|TSADHE|TSADE|QOPH|KOPH|RESH|SHIN|SCHIN|SIN|TAU|TAV|TAW)'


SMALL_WORDS = {'a','an','and','the','of','in','on','to','for','by','with','at','from',
               'into','over','under','or','nor','but','is','are','vs','his','her','as'}

def looks_heading(s):
    s = s.strip()
    if not s or s[0].isdigit():
        return False
    if re.fullmatch(ACROSTIC + r'\.?', s):  # acrostic stanza titles ONLY — a bare
        return True                          # all-caps rule would eat 'LORD.' lines
    if not any(c in s for c in '.;:?!,'):
        w = s.split()
        return 1 <= len(w) <= 9 and s[0].isupper()
    # Title-Case headings WITH internal punctuation ("The First Plague: Blood",
    # "Ahab Reigns in Israel, Marries Jezebel") — round-1 judge finding: these leaked
    # into verse text. A heading is Title Case throughout (small words excepted), short,
    # and — crucially — does NOT end with punctuation: genealogy/city-list VERSE lines
    # ("Issachar, Zebulun, and Benjamin,") are also Title Case but always end with
    # list/sentence punctuation, so they stay (they are scripture).
    if s[-1] in '.,;:!?':
        return False
    words = [w.strip(".,;:?!()'\"") for w in s.split()]
    content = [w for w in words if w and w[0].isalpha()]
    if not (2 <= len(content) <= 10):
        return False
    lowers = [w for w in content if w[0].islower() and w.lower() not in SMALL_WORDS]
    caps = [w for w in content if w[0].isupper()]
    return not lowers and len(caps) >= 2

def next_starts_verse_or_ref(lines, i):
    j = i+1
    while j < len(lines):
        s = lines[j].strip(); j += 1
        if not s or s.startswith('@@PAGE'):
            continue
        return bool(re.match(r'^\d{1,3}\b', s)) or bool(re.match(r'^\([^)]*\d+:', s))
    return False

def parse_chunk(lines, start, end, label, dropped_headings):
    body = []
    i = start+1
    while i < end:
        s = lines[i].strip()
        if s and not s.startswith('@@PAGE') and '[Online]' not in s:
            clean = CROSSREF_RE.sub(' ', s).strip()
            if looks_heading(clean) and next_starts_verse_or_ref(lines, i):
                dropped_headings.append({'at': label, 'line': clean})  # audit receipt
            else:
                body.append(CROSSREF_RE.sub(' ', s))
        i += 1
    tokens = ' '.join(body).split()
    verses, current, expected = {}, [], 1
    for tok in tokens:
        if tok.isdigit() and int(tok) == expected:
            if expected > 1:
                verses[str(expected-1)] = normalize(' '.join(current))
            current, expected = [], expected+1
        else:
            current.append(tok)
    if expected > 1:
        verses[str(expected-1)] = normalize(' '.join(current))
    if not verses:
        sys.exit(f'FATAL: bad parse at {label}')
    # empty verses are legitimate: some translations omit certain verses (e.g. WEB
    # Luke 17:36) — kept as '' so numbering stays honest; receipted by the caller
    return verses

def ingest_translation(cache_path, tag):
    lines = open(cache_path,encoding='utf-8').read().splitlines()
    # index every "<Header> <n>" line confirmed by "[Online]" on the next line
    positions = []   # (line_idx, header_name, chapter)
    by_header = {}
    header_names = {h for _,_,h,_,_ in BOOKS}
    hre = re.compile(r'^(' + '|'.join(re.escape(h) for h in sorted(header_names,key=len,reverse=True)) + r') (\d{1,3})\s*$')
    def confirmed(idx):
        # the "[Online]" line may sit after a page break — skip blanks and @@PAGE marks
        j = idx+1
        while j < len(lines) and (not lines[j].strip() or lines[j].startswith('@@PAGE')):
            j += 1
        return j < len(lines) and '[Online]' in lines[j]
    for idx,line in enumerate(lines):
        m = hre.match(line.strip())
        if m and confirmed(idx):
            positions.append((idx, m.group(1), int(m.group(2))))
            by_header[(m.group(1), int(m.group(2)))] = len(positions)-1
    out, problems, dropped_headings = {}, [], []
    for bid, name, header, order, total in BOOKS:
        chapters = {}
        for ch in range(1, total+1):
            pos = by_header.get((header, ch))
            if pos is None:
                problems.append(f'{tag}: header "{header} {ch}" not found'); continue
            start = positions[pos][0]
            end = positions[pos+1][0] if pos+1 < len(positions) else len(lines)
            chapters[str(ch)] = parse_chunk(lines, start, end, f'{tag} {header} {ch}', dropped_headings)
        if len(chapters) != total:
            problems.append(f'{tag}: {name} has {len(chapters)}/{total} chapters')
        out[bid] = chapters
    if problems:
        sys.exit('FATAL headers/chapters:\n  ' + '\n  '.join(problems[:20]) + f'\n  ({len(problems)} total)')
    omissions = [f'{b} {c}:{v}' for b,chs in out.items() for c,vs in chs.items()
                 for v,t in vs.items() if t == '']
    if omissions:
        print(f'  {tag}: {len(omissions)} verse(s) omitted by this translation: {", ".join(omissions[:8])}{"…" if len(omissions)>8 else ""}')
    print(f'  {tag}: {len(dropped_headings)} editorial heading lines stripped (receipted)')
    return out, omissions, dropped_headings

# Transliterated Hebrew acrostic stanza titles (Psalm 119). The KJV source prints them
# INLINE at each stanza's opening verse — kept verbatim. The WEB source prints them as
# standalone stanza headings which pypdf glues onto the END of the previous line —
# extraction artifacts, stripped and receipted.
# Headings glued INSIDE an extracted line ("...come to want. Thirty Sayings of the
# Wise") escape line-level rules — a verse-level post-pass strips a Title-Case tail
# that follows the final sentence punctuation and itself ends unpunctuated.
GLUE_RE = re.compile(r"([.!?:;][\"']?) ([A-Z][A-Za-z'’]*(?: [A-Za-z'’]+){1,9})$")

def strip_glued_headings(data, tag):
    stripped = []
    for b, chs in data.items():
        for c, vs in chs.items():
            for v, t in vs.items():
                m = GLUE_RE.search(t)
                if not m:
                    continue
                words = m.group(2).split()
                if any(w[0].islower() and w.lower() not in SMALL_WORDS for w in words):
                    continue  # ordinary scripture tail ("Thus saith the LORD, Choose thee")
                if sum(1 for w in words if w[0].isupper()) < 2:
                    continue
                vs[v] = t[:m.end(1)]
                stripped.append({'ref': f'{b} {c}:{v}', 'removed': m.group(2)})
    print(f'  {tag}: {len(stripped)} glued heading tails stripped (receipted)')
    return stripped

def strip_web_acrostics(data, tag):
    if tag != 'web':
        return []
    stripped = []
    ps119 = data['psalms']['119']
    for v, t in list(ps119.items()):
        fixed = re.sub(rf'\s*\b{ACROSTIC}\b\.?\s*$', '', t)   # glued to verse end
        fixed = re.sub(rf'^\s*{ACROSTIC}\b\.?\s*', '', fixed)  # leading heading residue
        if fixed != t:
            stripped.append({'ref': f'psalms 119:{v}', 'from': t[-60:] if len(t) > 60 else t, 'to': fixed[-40:]})
            ps119[v] = fixed.strip()
    return stripped

def build_lexicons(cache_path):
    text = open(cache_path,encoding='utf-8').read()
    text = text.replace('’',"'").replace('‘',"'")
    text = re.sub(r"([A-Za-z])' (t|s|d|ll|re|ve|m)\b", r"\1'\2", text)
    words = [w.strip(".,;:?!()'\"[]").lower() for w in text.split()]
    lex = Counter(words)
    bigrams = Counter((words[i],words[i+1]) for i in range(len(words)-1)
                      if words[i].isalpha() and words[i+1].isalpha())
    return lex, bigrams

def split_scan(data, lex, bigrams):
    strip = ".,;:?!()'\""
    suspects = []
    for b,chs in data.items():
        for c,vs in chs.items():
            for v,t in vs.items():
                toks = t.split()
                for i in range(len(toks)-1):
                    a = toks[i].strip(strip).lower(); z = toks[i+1].strip(strip).lower()
                    if not (a.isalpha() and z.isalpha()):
                        continue
                    if toks[i].strip(strip) and toks[i][-1] in strip:
                        continue
                    joined = lex[a+z]
                    frag = max(2, joined//10)
                    a_frag = lex[a] <= frag or (len(a)==1 and a not in ('a','i','o'))
                    z_frag = lex[z] <= frag or (len(z)==1 and z not in ('a','i','o'))
                    if joined >= 3 and (a_frag or z_frag):
                        suspects.append((b,c,v,toks[i],toks[i+1])); continue
                    if (len(a)>=2 and len(z)>=2 and joined>=50 and bigrams[(a,z)]<=2
                            and joined // max(1,bigrams[(a,z)]) >= 100):
                        suspects.append((b,c,v,toks[i],toks[i+1]))
    return suspects

def apply_repairs_and_scan(data, tag, lex, bigrams):
    applied = 0
    for (tr,b,c,v),fixes in REPAIRS.items():
        if tr != tag: continue
        for old,new in fixes:
            if old in data[b][c][v]:
                data[b][c][v] = data[b][c][v].replace(old,new); applied += 1
            else:
                print(f'  repair NOT NEEDED: {tag} {b} {c}:{v} "{old}"')
    joins = []
    for _ in range(6):
        sus = split_scan(data, lex, bigrams)
        if not sus: break
        for b,c,v,t1,t2 in sus:
            broken = f'{t1} {t2}'
            if broken in data[b][c][v]:
                data[b][c][v] = data[b][c][v].replace(broken, t1+t2)
                joins.append({'ref':f'{b} {c}:{v}','from':broken,'to':t1+t2})
    residual = split_scan(data, lex, bigrams)
    if residual:
        sys.exit(f'FATAL: residual splits in {tag}: {residual[:5]}')
    print(f'  {tag}: {applied} explicit repairs, {len(joins)} lexicon/bigram joins')
    return joins

def main():
    workdir = sys.argv[1]
    os.makedirs('docs/00_bible/extracted', exist_ok=True)
    os.makedirs('app/data', exist_ok=True)
    graph = json.load(open('curator/graph.json'))
    autorepairs = {}
    for tag in ('kjv','web'):
        pdf = f'docs/00_bible/bible_{tag}.pdf'
        pdf_sha = sha256_file(pdf)
        cache = os.path.join(workdir, f'{tag}-{pdf_sha[:12]}.pages.txt')
        print(f'{tag.upper()} <- {pdf} (sha256 {pdf_sha[:16]}…)')
        if not os.path.exists(cache):
            extract_pages(pdf, cache)
        lex, bigrams = build_lexicons(cache)
        data, omissions, dropped_headings = ingest_translation(cache, tag)
        acrostics = strip_web_acrostics(data, tag)
        glued = strip_glued_headings(data, tag)
        joins = apply_repairs_and_scan(data, tag, lex, bigrams)
        autorepairs[tag] = joins
        autorepairs[f'{tag}-omitted-verses'] = omissions
        autorepairs[f'{tag}-acrostic-strips'] = acrostics
        autorepairs[f'{tag}-glued-heading-strips'] = glued
        json.dump(dropped_headings, open(f'docs/00_bible/extracted/headings-dropped-{tag}.json','w'),
                  indent=1, ensure_ascii=False)
        # terminal-punctuation audit: a verse ending without punctuation is the signature
        # of a glued heading — receipt every case for curator review
        unterminated = [f'{b} {c}:{v}' for b,chs in data.items() for c,vs in chs.items()
                        for v,t in vs.items() if t and not re.search(r"[.,;:!?'\")—-]$", t)]
        autorepairs[f'{tag}-unterminated-verses'] = unterminated
        if unterminated:
            print(f'  {tag}: {len(unterminated)} verse(s) end without punctuation (audit): {unterminated[:6]}')
        total_verses = sum(len(vs) for chs in data.values() for vs in chs.values())
        total_chapters = sum(len(chs) for chs in data.values())
        print(f'  {tag}: 66 books, {total_chapters} chapters, {total_verses} verses')
        assert total_chapters == 1189
        # receipts
        json.dump(data, open(f'docs/00_bible/extracted/{tag}-canon.json','w'), ensure_ascii=False)
        json.dump({w:n for w,n in lex.items() if w.isalpha()},
                  open(f'docs/00_bible/extracted/lexicon-{tag}.json','w'), ensure_ascii=False)
        checks = {}
        for chs in data.values():
            for vs in chs.values():
                for t in vs.values():
                    toks = t.split()
                    for i in range(len(toks)-1):
                        a = toks[i].strip(".,;:?!()'\"").lower(); z = toks[i+1].strip(".,;:?!()'\"").lower()
                        if a.isalpha() and z.isalpha() and lex[a+z] >= 3:
                            checks[f'{a} {z}'] = bigrams[(a,z)]
        json.dump(checks, open(f'docs/00_bible/extracted/bigrams-{tag}.json','w'), ensure_ascii=False)
        # the edition artifact (ADR-006)
        tr_name = 'KJV (public domain)' if tag=='kjv' else 'WEB (World English Bible, public domain)'
        edition = {
            'edition': {
                'number': 2,
                'name': f'The whole canon · {tag.upper()}',
                'published': '2026-07-15',
                'translation': tr_name,
                'sourcePdf': {'path': pdf, 'sha256': pdf_sha},
                'checksum': 'PENDING',
                'corrections': 'corrections@walktheword.example',
                'changelog': [
                    'Edition 2 — every book of the canon (66 books, 1,189 chapters), extracted '
                    'directly from the curator-provided source PDF; all prior generated data erased '
                    'and rebuilt (ADR-006). The graded connection map is unchanged from Edition 1.'
                ],
                'graphStatus': graph['_status'],
                'anchorsBoundTo': 'KJV'
            },
            'books': [
                {'id': bid, 'name': name, 'order': order, 'chaptersTotal': total,
                 'chapters': data[bid]}
                for bid, name, _h, order, total in BOOKS
            ],
            'nodes': graph['nodes'], 'edges': graph['edges'],
            'moments': graph['moments'], 'questions': graph['questions']
        }
        with open(f'app/data/edition-2-{tag}.json','w',encoding='utf-8') as f:
            json.dump(edition, f, ensure_ascii=False)
            f.write('\n')
    json.dump(autorepairs, open('docs/00_bible/extracted/autorepairs.json','w'),
              indent=2, ensure_ascii=False)
    print('editions written -> app/data/edition-2-{kjv,web}.json (checksums PENDING; run npm run checksum)')

if __name__ == '__main__':
    main()
