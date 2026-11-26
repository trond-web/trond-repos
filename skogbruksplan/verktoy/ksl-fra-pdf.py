# Leser KSL-sjekklister (PDF fra Stiftelsen Norsk Mat, nb-no) til samme JSON-format som js/ksl-standard.js.
# Bruk: python3 verktoy/ksl-fra-pdf.py ut.json kapittel1.pdf kapittel2.pdf ...  (krever pdftotext og pdfplumber)
# Kapittelnavn og lenker for husdyrkapitlene står i NAVN og URL. Se over resultatet før det legges inn.
import sys, re, json, subprocess, pdfplumber
NAVN = {1: 'Generelle krav til gården', 10: 'Helse, miljø og sikkerhet (HMS)', 15: 'Grovfôr, korn, frø, olje- og belgvekster', 30: 'Drøvtyggere – generelt', 31: 'Storfe', 32: 'Småfe', 35: 'Melk', 40: 'Svin', 50: 'Fjørfe – generelt', 51: 'Eggproduksjon', 52: 'Oppal fjørfe', 53: 'Slaktekyllingproduksjon', 54: 'Kalkun, ender og gjess', 70: 'Hest i næring', 20: 'Potet', 25: 'Grønnsaker, frukt og bær', 60: 'Honning', 110: 'Juletre'}
URL = {1: 'generelle-krav-til-garden', 10: 'helse-miljo-og-sikkerhet', 15: 'grovfor-korn-fro-olje-og-belgvekster', 30: 'drovtyggere-generelt', 31: 'storfe', 32: 'smafe', 35: 'melk', 40: 'svin', 50: 'fjorfe-generelt', 51: 'eggproduksjon', 52: 'oppal-fjorfe', 53: 'slaktekylling', 54: 'kalkun-ender-og-gjess', 70: 'hest-i-naering', 20: 'potet', 25: 'gronnsaker-frukt-og-baer', 60: 'honning', 110: 'juletre'}
QRE = re.compile(r'^(\d+\.\d+\.\d+)\b')
SKRAP = re.compile(r'(\s{2,}(Ja|Nei|Ikke|aktuelt|Svar))+\s*$')
def dokmap(pdf):
    ut = set()
    with pdfplumber.open(pdf) as p:
        for pg in p.pages:
            leg = [w['top'] for w in pg.extract_words() if w['text'].startswith('symbolet')]
            qs = [(w['text'], w['top']) for w in pg.extract_words() if QRE.fullmatch(w['text']) and w['x0'] < 80]
            ik = [c for c in pg.curves if c['width'] >= 8 and c['x0'] < 60 and not any(abs(c['top'] - l) < 25 for l in leg)]
            for nr, t in qs:
                if any(abs(c['top'] - t) < 22 for c in ik): ut.add(nr)
    return ut
def linjer(pdf):
    # pdftotext -layout per side, med «• » foran linjer der PDF-en har tegnet en punktmarkør (fra pdfplumber).
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
    sider = txt.split('\f'); ut = []
    nok = lambda t: re.sub(r'\W+', '', t)[:18]
    with pdfplumber.open(pdf) as p:
        for i, side in enumerate(sider):
            merk = set()
            if i < len(p.pages):
                pg = p.pages[i]; kuler = [c for c in pg.curves if c['width'] < 5 and 70 < c['x0'] < 110]
                for ln in pg.extract_text_lines():
                    h = ln['bottom'] - ln['top']
                    if any(abs((c['top'] + c['bottom']) / 2 - (ln['top'] + ln['bottom']) / 2) < max(h, 6) * 0.7 for c in kuler): merk.add(nok(ln['text']))
            for l in side.split('\n'):
                l = l.rstrip(); k = nok(l)
                if k and k in merk and not QRE.match(l.strip()): ind = len(l) - len(l.lstrip()); l = ' ' * ind + '• ' + l.strip()
                ut.append(l)
    return ut
def ren(s): return re.sub(r'\s+', ' ', s).strip()
def parse(pdf):
    txt = subprocess.run(['pdftotext', '-layout', pdf, '-'], capture_output=True, text=True).stdout
    lines = linjer(pdf)
    lines = [l for l in lines if not re.match(r'^\s*Side: \d+ av \d+', l) and 'Stiftelsen Norsk Mat •' not in l]
    kap = int(re.search(r'^\s+(\d+) [A-ZÆØÅ]', txt, re.M).group(1)); fv = re.search(r'-(\d{4}\.\d+[a-z]?)-nb-no', pdf); ver = fv.group(1) if fv else re.search(r'Versjon ([\d.]+[a-z]?)', txt).group(1)
    dok = dokmap(pdf)
    seksjoner = []; sp = []; i = 0
    while i < len(lines):
        l = lines[i]
        m = re.match(r'^(\d+\.\d+)\s{1,3}([A-ZÆØÅÔÉ0-9][A-ZÆØÅÔÉ0-9 ,\-–/()]+)$', l)
        if m and m.group(1).startswith(f'{kap}.'):
            n = ren(m.group(2)); seksjoner.append({'nr': m.group(1), 'navn': n[0] + n[1:].lower()}); i += 1; continue
        m = QRE.match(l)
        if m and m.group(1).startswith(f'{kap}.'):
            nr = m.group(1); tekst = []; krav = []; modus = 'q'; cur = None; ferdigQ = False
            forst = SKRAP.sub('', l[len(nr):]).strip()
            if forst: tekst.append(forst); ferdigQ = forst.endswith('?')
            i += 1
            while i < len(lines) and not (QRE.match(lines[i]) and lines[i].split()[0].startswith(f'{kap}.')) and not re.match(rf'^{kap}\.\d+\s', lines[i]):
                x = SKRAP.sub('', lines[i]); s = x.strip(); i += 1
                if s in ('Svar', 'Ikke', 'aktuelt', 'Ja', 'Nei') or re.fullmatch(r'Ja\s+Nei', s): continue
                if modus == 'q':
                    if re.match(r'For å (oppfylle|tilfredsstille|innfri)', s):
                        modus = 'k'; rest = s.split(':', 1)[1].strip() if ':' in s else ''
                        if rest: cur = rest
                        continue
                    if not s or ferdigQ: continue
                    tekst.append(s); ferdigQ = s.endswith('?')
                elif modus == 'k':
                    if s.startswith('§ Krav') or s.startswith('§'): modus = 'slutt'; continue
                    if not s:
                        if cur: krav.append(cur); cur = None
                        if krav and not x.startswith('     '): pass
                        continue
                    ind = len(x) - len(x.lstrip())
                    if ind >= 6:
                        if cur and (cur.endswith(('.', ':', ';')) or (s[0].isupper() and not cur.endswith(','))) and len(cur) > 25: krav.append(cur); cur = s
                        else: cur = (cur + ' ' + s) if cur else s
                    else:
                        if krav or cur:
                            if cur and not krav and ind < 6 and not lines[i-2].strip():  # ny avsnitt uten innrykk etter krav = veiledning
                                krav.append(cur); cur = None; modus = 'veil'
                            elif cur: cur = cur + ' ' + s
                            else: modus = 'veil'
                        else: cur = s
            if cur and modus == 'k': krav.append(cur)
            sp.append({'nr': nr, 'tekst': ren(' '.join(tekst)), 'dok': nr in dok, 'krav': [d for k in krav for d in (ren(y) for y in k.split('•')) if d][:8]})
            continue
        i += 1
    return {'nr': kap, 'navn': NAVN.get(kap, str(kap)), 'versjon': ver, 'url': f'https://www.ksl.no/ksl-standarden/{URL.get(kap, "")}/', 'seksjoner': seksjoner, 'sporsmal': sp}
ut = [parse(f) for f in sys.argv[2:]]
ut.sort(key=lambda k: k['nr'])
json.dump(ut, open(sys.argv[1], 'w'), ensure_ascii=False, indent=1)
for k in ut: print(k['nr'], k['navn'], k['versjon'], len(k['seksjoner']), len(k['sporsmal']), sum(q['dok'] for q in k['sporsmal']), sum(1 for q in k['sporsmal'] if not q['krav']))
