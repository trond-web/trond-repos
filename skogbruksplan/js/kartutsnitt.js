// Padding for kart.fitBounds som tar hensyn til panelet (bunnark på mobil, sidepanel på PC) og verktøylinjene
// øverst, slik at det man zoomer til havner i den synlige delen av kartet.
export function synligPadding(kart, ekstra = 30) {
  const k = kart.getContainer().getBoundingClientRect();
  let topp = ekstra; let venstre = ekstra; let hoyre = ekstra; let bunn = ekstra;
  const panel = document.querySelector('.panel');
  const p = panel && !panel.hidden ? panel.getBoundingClientRect() : null;
  if (p && p.width && p.height) {
    if (p.width >= k.width * 0.9) bunn += Math.max(0, k.bottom - p.top); // bunnark
    else if (p.left > k.left + k.width / 2) hoyre += Math.max(0, k.right - p.left); // sidepanel til høyre
  }
  const verktoy = document.querySelector('.kartverktoy');
  const v = verktoy ? verktoy.getBoundingClientRect() : null;
  if (v && v.height && v.bottom > k.top) topp += Math.max(0, v.bottom - k.top);
  // Ikke mer padding enn at det blir igjen et brukbart utsnitt.
  bunn = Math.min(bunn, k.height * 0.7); hoyre = Math.min(hoyre, k.width * 0.7);
  return { paddingTopLeft: [venstre, topp], paddingBottomRight: [hoyre, bunn] };
}
