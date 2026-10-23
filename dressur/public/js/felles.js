// Felles hjelpere for alle sidene.

export async function api(sti, { metode = 'GET', data } = {}) {
  const svar = await fetch(sti, {
    method: metode, credentials: 'same-origin',
    headers: data !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
  const type = svar.headers.get('content-type') || '';
  const innhold = type.includes('json') ? await svar.json() : await svar.text();
  if (!svar.ok) {
    const e = new Error(innhold?.feil || `Feil ${svar.status}`);
    e.status = svar.status;
    throw e;
  }
  return innhold;
}

const ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ESC[c]);

// Tagget mal som escaper alle verdier, unntatt de som er pakket i raw()
export function html(deler, ...verdier) {
  return deler.reduce((ut, del, i) => {
    if (i === 0) return del;
    const v = verdier[i - 1];
    const s = v?.raa != null ? v.raa : Array.isArray(v) ? v.map((x) => (x?.raa != null ? x.raa : esc(x))).join('') : esc(v);
    return ut + s + del;
  }, '');
}
export const raw = (s) => ({ raa: String(s ?? '') });

export const $ = (sel, rot = document) => rot.querySelector(sel);
export const $$ = (sel, rot = document) => [...rot.querySelectorAll(sel)];

export function datoTekst(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00` : iso);
  return d.toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
}
export function kortDato(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? `${iso}T12:00` : iso);
  return d.toLocaleDateString('nb-NO', { day: 'numeric', month: 'short' });
}
export function tidspunkt(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleString('nb-NO', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
export const kr = (n) => `${Number(n || 0).toLocaleString('nb-NO')} kr`;

export function melding(tekst, type = 'ok') {
  let boks = $('#melding');
  if (!boks) {
    boks = document.createElement('div');
    boks.id = 'melding';
    boks.setAttribute('role', 'status');
    document.body.append(boks);
  }
  boks.textContent = tekst;
  boks.className = `melding ${type} vis`;
  clearTimeout(boks._t);
  boks._t = setTimeout(() => boks.classList.remove('vis'), type === 'feil' ? 6000 : 2800);
}

export function skjemaData(form) {
  const data = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    const sti = el.name.split('.');
    let mal = data;
    while (sti.length > 1) { const s = sti.shift(); mal = (mal[s] ||= {}); }
    const navn = sti[0];
    if (el.type === 'checkbox') {
      if (el.dataset.liste != null) { (mal[navn] ||= []); if (el.checked) mal[navn].push(el.value); } else mal[navn] = el.checked;
    } else if (el.type === 'radio') { if (el.checked) mal[navn] = el.value; } else mal[navn] = el.value;
  }
  return data;
}

export function lastNed(navn, innhold, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([innhold], { type }));
  a.download = navn;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export const STATUS_KLASSE = { planlagt: 'Planlagt', pagar: 'Pågår', avsluttet: 'Avsluttet' };
export const STATUS_PAMELDING = { pameldt: 'Påmeldt', venteliste: 'Venteliste', trukket: 'Trukket' };

// Utskriftsknapper uten inline-skript (CSP)
document.addEventListener('click', (e) => { if (e.target.closest('[data-skriv-ut]')) window.print(); });
