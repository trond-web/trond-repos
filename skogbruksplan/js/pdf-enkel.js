// Enkel PDF-generator uten avhengigheter: tekst (Helvetica, WinAnsi med æøå), overskrifter, nøkkel/verdi-rader,
// avkrysningsbokser og streker, med automatisk linjebryting, sideskift og sidenummer. Gir en ekte PDF-fil
// (Uint8Array) som kan lastes ned eller deles – ingen utskriftsdialog. Ingen DOM – kan testes i Node.

// Bredder (1/1000 em) for Helvetica, tegn 32–126 (Adobe AFM). Andre tegn regnes som 556.
const B = [278, 278, 355, 556, 556, 889, 667, 191, 333, 333, 389, 584, 278, 333, 278, 278, 556, 556, 556, 556, 556, 556, 556, 556, 556, 556, 278, 278, 584, 584, 584, 556,
  1015, 667, 667, 722, 722, 667, 611, 778, 722, 278, 500, 667, 556, 833, 722, 778, 667, 778, 722, 667, 611, 722, 667, 944, 667, 667, 611, 278, 278, 278, 469, 556,
  333, 556, 556, 500, 556, 556, 278, 556, 556, 222, 222, 500, 222, 833, 556, 556, 556, 556, 333, 500, 278, 556, 500, 722, 500, 500, 500, 334, 260, 334, 584];
const SMAL = { 'æ': 889, 'Æ': 1000, 'ø': 611, 'Ø': 778, 'å': 556, 'Å': 667, '–': 556, '—': 1000, '«': 556, '»': 556, '°': 400, '•': 350, '’': 222, '‘': 222, '“': 333, '”': 333, '…': 1000, 'é': 556, 'ü': 556, 'ö': 556, 'ä': 556 };
const bredde = (t, str, fet = false) => [...t].reduce((s, c) => { const k = c.charCodeAt(0); return s + (k >= 32 && k <= 126 ? B[k - 32] : SMAL[c] ?? 556); }, 0) * str / 1000 * (fet ? 1.06 : 1);

// Unicode → Windows-1252 for tegnene som finnes der; andre tegn (emoji o.l.) tas bort.
const CP = { '€': 128, '‚': 130, 'ƒ': 131, '„': 132, '…': 133, '†': 134, '‡': 135, 'ˆ': 136, '‰': 137, 'Š': 138, '‹': 139, 'Œ': 140, 'Ž': 142, '‘': 145, '’': 146, '“': 147, '”': 148, '•': 149, '–': 150, '—': 151, '˜': 152, '™': 153, 'š': 154, '›': 155, 'œ': 156, 'ž': 158, 'Ÿ': 159 };
export function rensTekst(t) {
  return String(t ?? '').replace(/[\u2192\u2794\u279c\u27a1]/g, '->').replace(/≥/g, '>=').replace(/≤/g, '<=').replace(/[\u200d\ufe0f]/g, '')
    .replace(/\p{Extended_Pictographic}/gu, '').replace(/\s+/g, ' ').trim();
}
function pdfStreng(t) {
  let ut = '(';
  for (const c of t) {
    let k = CP[c] ?? c.charCodeAt(0); if (k > 255) k = 63; // ?
    if (c === '(' || c === ')' || c === '\\') ut += `\\${c}`;
    else if (k < 32 || k > 126) ut += `\\${k.toString(8).padStart(3, '0')}`;
    else ut += c;
  }
  return `${ut})`;
}
export function bryt(tekst, maks, str, fet = false) {
  const ord = rensTekst(tekst).split(' '); const linjer = []; let l = '';
  for (const o of ord) {
    const prov = l ? `${l} ${o}` : o;
    if (bredde(prov, str, fet) <= maks || !l) l = prov; else { linjer.push(l); l = o; }
  }
  if (l) linjer.push(l);
  return linjer.length ? linjer : [''];
}

// blokker: { type: 'h1'|'h2'|'p'|'liten'|'kv'|'sjekk'|'strek'|'signatur'|'luft', tekst, etikett, verdi, ok, hoyde }
export function lagPdf(blokker, { tittel = 'Dokument', bunntekst = '' } = {}) {
  const W = 595; const H = 842; const M = 48; const BR = W - 2 * M;
  const sider = [[]]; let y = H - M;
  const ops = () => sider[sider.length - 1];
  const trenger = (h) => { if (y - h < M + 24) { sider.push([]); y = H - M; } };
  const tekst = (x, yy, t, str, fet = false, farge = null) => { ops().push(`BT ${farge ? `${farge} rg ` : ''}/${fet ? 'F2' : 'F1'} ${str} Tf ${x.toFixed(1)} ${yy.toFixed(1)} Td ${pdfStreng(t)} Tj ET${farge ? ' 0 g' : ''}`); };
  for (const b of blokker) {
    if (b.type === 'luft') { y -= b.hoyde || 8; continue; }
    if (b.type === 'h1') { const ls = bryt(b.tekst, BR, 17, true); trenger(ls.length * 21 + 6); for (const l of ls) { tekst(M, y - 17, l, 17, true); y -= 21; } y -= 6; continue; }
    if (b.type === 'h2') { const ls = bryt(b.tekst, BR, 12, true); trenger(ls.length * 15 + 26); y -= 8; ops().push(`0.82 0.86 0.82 RG 0.8 w ${M} ${(y - 2).toFixed(1)} m ${W - M} ${(y - 2).toFixed(1)} l S 0 G`); y -= 4; for (const l of ls) { tekst(M, y - 12, l, 12, true, '0.10 0.30 0.20'); y -= 15; } y -= 3; continue; }
    if (b.type === 'p' || b.type === 'liten') { const s = b.type === 'p' ? 10 : 8.5; const lh = s * 1.35; const ls = bryt(b.tekst, BR, s, b.fet); for (const l of ls) { trenger(lh); tekst(M, y - s, l, s, !!b.fet, b.type === 'liten' ? '0.35 0.35 0.35' : null); y -= lh; } y -= 3; continue; }
    if (b.type === 'kv') {
      const KW = 165; const s = 10; const lh = 13.5; const v = rensTekst(b.verdi) || '–';
      const ls = bryt(v, BR - KW - 8, s); const le = bryt(b.etikett, KW - 6, s - 0.5, true); const n = Math.max(ls.length, le.length);
      trenger(n * lh + 4);
      le.forEach((l, i) => tekst(M, y - s - i * lh, l, s - 0.5, true, '0.25 0.25 0.25'));
      ls.forEach((l, i) => tekst(M + KW, y - s - i * lh, l, s));
      y -= n * lh + 4; continue;
    }
    if (b.type === 'sjekk') {
      const s = 10; const lh = 13.5; const ls = bryt(b.tekst, BR - 20, s); trenger(ls.length * lh + 3);
      const by = y - s - 1; ops().push(`0.6 w ${M} ${by.toFixed(1)} 9 9 re S`);
      if (b.ok) ops().push(`1.4 w ${M + 1.8} ${(by + 4.5).toFixed(1)} m ${M + 3.8} ${(by + 1.8).toFixed(1)} l ${M + 7.6} ${(by + 7.8).toFixed(1)} l S 0.6 w`);
      ls.forEach((l, i) => tekst(M + 16, y - s - i * lh, l, s, false, b.ok ? null : '0.40 0.40 0.40'));
      y -= ls.length * lh + 3; continue;
    }
    if (b.type === 'signatur') {
      trenger(40); const s = 10;
      tekst(M, y - s, rensTekst(b.etikett), s - 0.5, true, '0.25 0.25 0.25');
      tekst(M + 165, y - s, rensTekst(b.verdi) || '', s);
      if (b.tid) tekst(M + 165, y - s - 13, rensTekst(b.tid), 8.5, false, '0.35 0.35 0.35');
      ops().push(`0.5 w 0.6 G ${M + 165} ${(y - s - 17).toFixed(1)} m ${W - M} ${(y - s - 17).toFixed(1)} l S 0 G`);
      y -= 36; continue;
    }
    if (b.type === 'strek') { trenger(10); ops().push(`0.5 w 0.7 G ${M} ${(y - 4).toFixed(1)} m ${W - M} ${(y - 4).toFixed(1)} l S 0 G`); y -= 10; }
  }
  // Bunntekst og sidenummer
  sider.forEach((s, i) => {
    const t = `${rensTekst(bunntekst)}${bunntekst ? '   ' : ''}Side ${i + 1} av ${sider.length}`;
    s.push(`BT 0.45 g /F1 8 Tf ${M} 26 Td ${pdfStreng(t)} Tj ET 0 g`);
  });
  // Objekter
  const obj = []; const leggTil = (s) => { obj.push(s); return obj.length; };
  const katalog = leggTil(null); const sideTre = leggTil(null);
  const f1 = leggTil('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
  const f2 = leggTil('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
  const info = leggTil(`<< /Title ${pdfStreng(rensTekst(tittel))} /Producer (SkogIQ.ai) /CreationDate (D:${new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14)}Z) >>`);
  const sideIder = [];
  for (const s of sider) {
    const innhold = s.join('\n');
    const strom = leggTil(`<< /Length ${innhold.length} >>\nstream\n${innhold}\nendstream`);
    sideIder.push(leggTil(`<< /Type /Page /Parent ${sideTre} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${strom} 0 R >>`));
  }
  obj[katalog - 1] = `<< /Type /Catalog /Pages ${sideTre} 0 R >>`;
  obj[sideTre - 1] = `<< /Type /Pages /Kids [${sideIder.map((i) => `${i} 0 R`).join(' ')}] /Count ${sideIder.length} >>`;
  let ut = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n'; const pos = [];
  obj.forEach((o, i) => { pos.push(ut.length); ut += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = ut.length;
  ut += `xref\n0 ${obj.length + 1}\n0000000000 65535 f \n${pos.map((p) => `${String(p).padStart(10, '0')} 00000 n \n`).join('')}`;
  ut += `trailer\n<< /Size ${obj.length + 1} /Root ${katalog} 0 R /Info ${info} 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  // Alt er ASCII bortsett fra binærkommentaren – skriv tegn for tegn som byte.
  const bytes = new Uint8Array(ut.length); for (let i = 0; i < ut.length; i++) bytes[i] = ut.charCodeAt(i) & 255;
  return bytes;
}
