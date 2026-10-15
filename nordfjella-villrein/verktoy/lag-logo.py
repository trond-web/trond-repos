# Lager logoene til Villreinutvalet for Nordfjella som rene vektorfiler (SVG) fra den opprinnelige logoen.
#   Reinsdyret spores fra verktoy/logo/logo-original.jpg (spor-rein.py).
#   Teksten tegnes som kurver med Archivo Black (SIL Open Font License), som ligner skrifta i originalen.
# Kjør fra appmappen: python3 verktoy/lag-logo.py
import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from importlib import import_module

HER = os.path.dirname(__file__)
spor = import_module('spor-rein')
REIN, _ = spor.bane(os.path.join(HER, 'logo', 'logo-original.jpg'))
TEKST = 'Villreinutvalet for Nordfjella'
HOYDE, SMAL = 56, 0.78

def tekstbane(tekst, x0, grunnlinje, hoyde, smal=1.0):
    font = TTFont(os.path.join(HER, 'logo', 'ArchivoBlack-Regular.ttf'))
    gs = font.getGlyphSet(); cmap = font.getBestCmap(); hmtx = font['hmtx']
    skala = hoyde / font['OS/2'].sCapHeight
    pen = SVGPathPen(gs, ntos=lambda v: f'{v:.1f}'.rstrip('0').rstrip('.')); x = 0
    for t in tekst:
        navn = cmap[ord(t)]
        gs[navn].draw(TransformPen(pen, (skala * smal, 0, 0, -skala, x0 + x * skala * smal, grunnlinje)))
        x += hmtx[navn][0]
    return pen.getCommands(), x * skala * smal

def svg(bredde, hoyde, innhold, tittel='Villreinutvalet for Nordfjella'):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {bredde:.0f} {hoyde:.0f}" role="img" aria-label="{tittel}">'
            f'<title>{tittel}</title>{innhold}</svg>\n')

def lag():
    ut = os.path.join(HER, '..', 'ikoner')
    # Reinsdyret er 150 × 132 i sporingen. Teksten plasseres som i originalen: stor versalhøyde, grunnlinje mot beina.
    # Archivo Black er bredere enn Arial Black i originalen; litt smalere tekst gir samme proporsjoner.
    d, bredde = tekstbane(TEKST, 166, 108, HOYDE, SMAL)
    W, H = 166 + bredde + 8, 140
    rein = f'<path d="{REIN}" fill-rule="evenodd"/>'
    # 1. Som originalen: grå fylling, mørk kontur og hard skygge – for lys bakgrunn.
    lys = (f'<g fill="#2e2e2e" transform="translate(3.6 3.6)" opacity=".8"><path d="{d}"/></g>'
           f'<g fill="#8f8f8f" stroke="#1f1f1f" stroke-width="1.6" stroke-linejoin="round" paint-order="stroke"><path d="{d}"/></g>'
           f'<g fill="#b4b4b4" stroke="#333" stroke-width="1.3" stroke-linejoin="round">{rein}</g>')
    open(os.path.join(ut, 'logo.svg'), 'w').write(svg(W, H, lys))
    # 2. For mørk bakgrunn (toppfelt i appen og admin).
    mork = (f'<g fill="#000" transform="translate(2.4 2.4)" opacity=".35"><path d="{d}"/></g>'
            f'<g fill="#f3efe2"><path d="{d}"/></g>'
            f'<g fill="#f3efe2" stroke="#0b1510" stroke-width="1" stroke-opacity=".4">{rein}</g>')
    open(os.path.join(ut, 'logo-lys.svg'), 'w').write(svg(W, H, mork))
    # 3. Bare reinsdyret, i tekstfargen der den brukes (currentColor).
    open(os.path.join(ut, 'rein.svg'), 'w').write(svg(150, 132, f'<g fill="currentColor">{rein}</g>', 'Reinsdyr'))
    # 4. Appikonet (hjemskjerm): reinsdyret på mørkegrønn bunn, med villreingrensa som rød stiplet linje under.
    ikon = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="96" fill="#24352b"/>'
            f'<g transform="translate(76 92) scale(2.4)" fill="#f3efe2">{rein}</g>'
            '<path d="M70 432h372" stroke="#e5484d" stroke-width="14" stroke-dasharray="28 16" stroke-linecap="round"/></svg>\n')
    open(os.path.join(ut, '..', 'icon.svg'), 'w').write(ikon)
    print('ok', round(W), H, file=sys.stderr)
    return REIN

if __name__ == '__main__':
    lag()
