// Droneoppdrag (beta): ortofoto av et tegnet område med DJI Enterprise-droner.
// Systematiske parallelle flylinjer («gressklipper») over polygonet, med overlapp, bildeavstand, GSD, flytid og
// batterier, og eksport som DJI WPML-rute (KMZ med wpmz/template.kml + wpmz/waylines.wpml) for DJI Pilot 2.
// Format: DJI Cloud API – WPML (template.kml: templateType mapping2d; waylines.wpml: veipunkter med takePhoto ved
// «multipleDistance»). Ingen DOM – kan testes i Node.
import { tilUtmPunkt, tilGeoPunkt } from './flate-geometri.js';

// Kamera: sensorbredde × -høyde (mm), bildestørrelse (px) og brennvidde (mm). droneEnum/payloadEnum fra WPML-dokumentasjonen.
export const DRONER = {
  m3e: { navn: 'Mavic 3 Enterprise (M3E)', droneEnum: 77, droneSub: 0, payloadEnum: 66, sensor: [17.3, 13.0], px: [5280, 3956], f: 12.29, maksFart: 15, flytid: 30, minIntervall: 1, klasse: 'C2' },
  m3m: { navn: 'Mavic 3 Multispectral (M3M)', droneEnum: 77, droneSub: 2, payloadEnum: 68, sensor: [17.3, 13.0], px: [5280, 3956], f: 12.29, maksFart: 15, flytid: 28, minIntervall: 1, klasse: 'C2' },
  m3t: { navn: 'Mavic 3 Thermal (M3T) – vidvinkel', droneEnum: 77, droneSub: 1, payloadEnum: 67, sensor: [6.4, 4.8], px: [8000, 6000], f: 4.4, maksFart: 15, flytid: 28, minIntervall: 2, klasse: 'C2' },
  m3d: { navn: 'Matrice 3D (dokk)', droneEnum: 91, droneSub: 0, payloadEnum: 80, sensor: [17.3, 13.0], px: [5280, 3956], f: 12.29, maksFart: 15, flytid: 35, minIntervall: 1, klasse: 'C2' },
  m30: { navn: 'Matrice 30 (M30) – vidvinkel', droneEnum: 67, droneSub: 0, payloadEnum: 52, sensor: [6.4, 4.8], px: [4000, 3000], f: 4.5, maksFart: 15, flytid: 28, minIntervall: 2, klasse: 'C2/spesifikk' },
  m350h20: { navn: 'Matrice 350 RTK + H20 – vidvinkel', droneEnum: 89, droneSub: 0, payloadEnum: 42, sensor: [6.17, 4.55], px: [4056, 3040], f: 4.5, maksFart: 15, flytid: 35, minIntervall: 2, klasse: 'spesifikk' },
};
// Skog: høy overlapp (80/80) fordi tretoppene er vanskelige å matche i ortofoto-programmene.
export const STANDARD_DRONE = { drone: 'm3e', hoyde: 100, overlappFram: 80, overlappSide: 80, retning: null, margin: 0, fart: null };
export const MAKS_HOYDE = 120; // åpen kategori: maks 120 m over bakken

const rad = (g) => (g * Math.PI) / 180;
const roter = ([x, y], a) => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
const ringUtm = (geom) => {
  const p = geom.type === 'MultiPolygon' ? geom.coordinates.reduce((s, x) => (areal(x[0].map(tilUtmPunkt)) > areal(s[0].map(tilUtmPunkt)) ? x : s)) : geom.coordinates;
  return p[0].map(tilUtmPunkt);
};
function areal(r) { let a = 0; for (let i = 0; i < r.length; i++) { const j = (i + 1) % r.length; a += r[i][0] * r[j][1] - r[j][0] * r[i][1]; } return Math.abs(a / 2); }

// GSD (cm/px) og bildeutsnitt på bakken (m) ved høyde H (m). Langsiden av bildet ligger på tvers av flyretningen.
export function kamera(droneId, H) {
  const d = DRONER[droneId] || DRONER.m3e;
  const gsd = (d.sensor[0] * H) / (d.f * d.px[0]); // m/px
  return { gsd: gsd * 100, bredde: gsd * d.px[0], lengde: gsd * d.px[1] };
}
// Høyden som gir ønsket GSD (cm/px).
export const hoydeForGsd = (droneId, gsdCm) => { const d = DRONER[droneId] || DRONER.m3e; return (gsdCm / 100) * d.f * d.px[0] / d.sensor[0]; };

// Flylinjer over polygonet ved en gitt retning (grader fra nord, med klokka). Gir linjer i UTM.
function linjerVed(ring, retning, avstand, forleng) {
  const a = rad(90 - retning); // roter slik at flyretningen blir x-aksen
  const r = ring.map((p) => roter(p, -a));
  const ys = r.map((p) => p[1]); const y0 = Math.min(...ys); const y1 = Math.max(...ys);
  const n = Math.max(1, Math.ceil((y1 - y0) / avstand));
  const start = y0 + ((y1 - y0) - (n - 1) * avstand) / 2;
  const linjer = [];
  for (let i = 0; i < n; i++) {
    const y = start + i * avstand; const xs = [];
    for (let k = 0; k < r.length; k++) {
      const [p, q] = [r[k], r[(k + 1) % r.length]];
      if ((p[1] <= y && q[1] > y) || (q[1] <= y && p[1] > y)) xs.push(p[0] + ((y - p[1]) / (q[1] - p[1])) * (q[0] - p[0]));
    }
    if (xs.length < 2) continue;
    let x0 = Math.min(...xs) - forleng; let x1 = Math.max(...xs) + forleng;
    if (linjer.length % 2) [x0, x1] = [x1, x0]; // fram og tilbake
    linjer.push([roter([x0, y], a), roter([x1, y], a)]);
  }
  return linjer;
}

// Hele planen: { linjer (UTM og lat/lon), gsd, bildeavstand, linjeavstand, fart, intervall, lengde, bilder, flytid, batterier, retning, arealDaa }
export function planlegg(geom, param = {}) {
  const p = { ...STANDARD_DRONE, ...param };
  const d = DRONER[p.drone] || DRONER.m3e;
  const H = Math.min(MAKS_HOYDE, Math.max(20, p.hoyde));
  const k = kamera(p.drone, H);
  const linjeavstand = k.bredde * (1 - p.overlappSide / 100);
  const bildeavstand = k.lengde * (1 - p.overlappFram / 100);
  const ring = ringUtm(geom);
  const forleng = k.lengde / 2 + (p.margin || 0); // bildene skal dekke kanten – fly litt forbi
  // Retning: angitt, eller den som gir kortest samlet flytid (færrest vendinger).
  const kost = (ls) => ls.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0) + ls.length * 60;
  let retning = p.retning; let linjer;
  if (retning == null) {
    let best = null;
    for (let g = 0; g < 180; g += 5) { const ls = linjerVed(ring, g, linjeavstand, forleng); const c = kost(ls); if (!best || c < best.c) best = { g, ls, c }; }
    retning = best.g; linjer = best.ls;
  } else linjer = linjerVed(ring, retning, linjeavstand, forleng);
  const fart = Math.min(p.fart || d.maksFart, d.maksFart, bildeavstand / d.minIntervall, 12);
  const lengde = linjer.reduce((s, [a, b]) => s + Math.hypot(b[0] - a[0], b[1] - a[1]), 0);
  const overgang = linjer.slice(1).reduce((s, l, i) => s + Math.hypot(l[0][0] - linjer[i][1][0], l[0][1] - linjer[i][1][1]), 0);
  const bilder = linjer.reduce((s, [a, b]) => s + Math.floor(Math.hypot(b[0] - a[0], b[1] - a[1]) / bildeavstand) + 1, 0);
  const sek = lengde / fart + overgang / Math.min(10, d.maksFart) + linjer.length * 8 + 120; // + vendinger, opp/ned og til/fra
  const flytid = sek / 60;
  return {
    drone: p.drone, droneNavn: d.navn, hoyde: H, overlappFram: p.overlappFram, overlappSide: p.overlappSide, retning, margin: p.margin || 0,
    gsd: k.gsd, utsnitt: [k.bredde, k.lengde], linjeavstand, bildeavstand, fart, intervall: bildeavstand / fart,
    linjer, linjerGeo: linjer.map((l) => l.map(tilGeoPunkt)), lengde: lengde + overgang, bilder, flytid,
    batterier: Math.max(1, Math.ceil(flytid / d.flytid)), arealDaa: areal(ring) / 1000, polygonGeo: ring.map(tilGeoPunkt),
  };
}

// Terrengsjekk: høydeforskjell i området mot flyhøyden. Flyhøyden i ruten er relativ til startpunktet, så stigende
// terreng gir lavere høyde over bakken (og trærne) og mindre GSD.
export function terrengVurdering(hoyder, plan, { trehoyde = 20 } = {}) {
  const z = hoyder.filter((x) => Number.isFinite(x)); if (!z.length) return null;
  const min = Math.min(...z); const max = Math.max(...z); const diff = max - min;
  const overTraer = plan.hoyde - diff - trehoyde;
  const niva = overTraer < 20 ? 'fare' : diff > plan.hoyde * 0.2 ? 'advarsel' : 'ok';
  return { min, max, diff, overTraer, niva, tekst: niva === 'fare'
    ? `Terrenget stiger ${Math.round(diff)} m i området. Starter du fra det laveste punktet, er dronen bare ca. ${Math.max(0, Math.round(overTraer))} m over tretoppene på det høyeste. Øk høyden, start fra høyeste punkt eller bruk terrengfølging i DJI Pilot 2.`
    : niva === 'advarsel' ? `Terrenget varierer ${Math.round(diff)} m. Start fra et høyt punkt, eller slå på terrengfølging i DJI Pilot 2 for jevn GSD.`
      : `Terrenget varierer ${Math.round(diff)} m – greit for konstant flyhøyde.` };
}

// ---------- DJI WPML (KMZ) ----------
const x = (s) => String(s).replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const tall = (v, n = 6) => Number(v).toFixed(n).replace(/\.?0+$/, '');
const missionConfig = (d, plan) => `  <wpml:missionConfig>
    <wpml:flyToWaylineMode>safely</wpml:flyToWaylineMode>
    <wpml:finishAction>goHome</wpml:finishAction>
    <wpml:exitOnRCLost>executeLostAction</wpml:exitOnRCLost>
    <wpml:executeRCLostAction>goBack</wpml:executeRCLostAction>
    <wpml:takeOffSecurityHeight>${Math.min(plan.hoyde, 60)}</wpml:takeOffSecurityHeight>
    <wpml:globalTransitionalSpeed>${tall(Math.min(10, d.maksFart), 1)}</wpml:globalTransitionalSpeed>
    <wpml:droneInfo>
      <wpml:droneEnumValue>${d.droneEnum}</wpml:droneEnumValue>
      <wpml:droneSubEnumValue>${d.droneSub}</wpml:droneSubEnumValue>
    </wpml:droneInfo>
    <wpml:payloadInfo>
      <wpml:payloadEnumValue>${d.payloadEnum}</wpml:payloadEnumValue>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
    </wpml:payloadInfo>
  </wpml:missionConfig>`;

export function lagTemplateKml(plan, { naa = Date.now() } = {}) {
  const d = DRONER[plan.drone];
  const ring = [...plan.polygonGeo, plan.polygonGeo[0]].map(([lon, lat]) => `${tall(lon)},${tall(lat)},0`).join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
<Document>
  <wpml:author>SkogIQ</wpml:author>
  <wpml:createTime>${naa}</wpml:createTime>
  <wpml:updateTime>${naa}</wpml:updateTime>
${missionConfig(d, plan)}
  <Folder>
    <wpml:templateType>mapping2d</wpml:templateType>
    <wpml:templateId>0</wpml:templateId>
    <wpml:waylineCoordinateSysParam>
      <wpml:coordinateMode>WGS84</wpml:coordinateMode>
      <wpml:heightMode>relativeToStartPoint</wpml:heightMode>
      <wpml:globalShootHeight>${tall(plan.hoyde, 1)}</wpml:globalShootHeight>
      <wpml:surfaceFollowModeEnable>0</wpml:surfaceFollowModeEnable>
    </wpml:waylineCoordinateSysParam>
    <wpml:autoFlightSpeed>${tall(plan.fart, 1)}</wpml:autoFlightSpeed>
    <wpml:payloadParam>
      <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
      <wpml:focusMode>firstPoint</wpml:focusMode>
      <wpml:meteringMode>average</wpml:meteringMode>
      <wpml:dewarpingEnable>0</wpml:dewarpingEnable>
      <wpml:imageFormat>${plan.drone === 'm3m' ? 'visible' : 'wide'}</wpml:imageFormat>
    </wpml:payloadParam>
    <Placemark>
      <wpml:caliFlightEnable>0</wpml:caliFlightEnable>
      <wpml:elevationOptimizeEnable>1</wpml:elevationOptimizeEnable>
      <wpml:shootType>time</wpml:shootType>
      <wpml:direction>${Math.round(plan.retning) % 360}</wpml:direction>
      <wpml:margin>${Math.round(plan.margin)}</wpml:margin>
      <wpml:overlap>
        <wpml:orthoCameraOverlapH>${Math.round(plan.overlappFram)}</wpml:orthoCameraOverlapH>
        <wpml:orthoCameraOverlapW>${Math.round(plan.overlappSide)}</wpml:orthoCameraOverlapW>
      </wpml:overlap>
      <wpml:ellipsoidHeight>${tall(plan.hoyde, 1)}</wpml:ellipsoidHeight>
      <wpml:height>${tall(plan.hoyde, 1)}</wpml:height>
      <Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon>
      <wpml:mappingHeadingParam><wpml:mappingHeadingMode>followWayline</wpml:mappingHeadingMode></wpml:mappingHeadingParam>
      <wpml:gimbalPitchMode>fixed</wpml:gimbalPitchMode>
      <wpml:gimbalPitchAngle>-90</wpml:gimbalPitchAngle>
    </Placemark>
  </Folder>
</Document>
</kml>
`;
}

export function lagWaylinesWpml(plan) {
  const d = DRONER[plan.drone];
  const pkt = plan.linjerGeo.flat();
  const sist = pkt.length - 1;
  const placemarks = pkt.map(([lon, lat], i) => `      <Placemark>
        <Point><coordinates>${tall(lon)},${tall(lat)}</coordinates></Point>
        <wpml:index>${i}</wpml:index>
        <wpml:executeHeight>${tall(plan.hoyde, 1)}</wpml:executeHeight>
        <wpml:waypointSpeed>${tall(plan.fart, 1)}</wpml:waypointSpeed>
        <wpml:waypointHeadingParam><wpml:waypointHeadingMode>followWayline</wpml:waypointHeadingMode></wpml:waypointHeadingParam>
        <wpml:waypointTurnParam><wpml:waypointTurnMode>toPointAndStopWithDiscontinuityCurvature</wpml:waypointTurnMode><wpml:waypointTurnDampingDist>0</wpml:waypointTurnDampingDist></wpml:waypointTurnParam>${i === 0 ? `
        <wpml:actionGroup>
          <wpml:actionGroupId>0</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>0</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger><wpml:actionTriggerType>reachPoint</wpml:actionTriggerType></wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>0</wpml:actionId>
            <wpml:actionActuatorFunc>gimbalRotate</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam>
              <wpml:gimbalRotateMode>absoluteAngle</wpml:gimbalRotateMode>
              <wpml:gimbalPitchRotateEnable>1</wpml:gimbalPitchRotateEnable>
              <wpml:gimbalPitchRotateAngle>-90</wpml:gimbalPitchRotateAngle>
              <wpml:gimbalRollRotateEnable>0</wpml:gimbalRollRotateEnable>
              <wpml:gimbalRollRotateAngle>0</wpml:gimbalRollRotateAngle>
              <wpml:gimbalYawRotateEnable>0</wpml:gimbalYawRotateEnable>
              <wpml:gimbalYawRotateAngle>0</wpml:gimbalYawRotateAngle>
              <wpml:gimbalRotateTimeEnable>0</wpml:gimbalRotateTimeEnable>
              <wpml:gimbalRotateTime>0</wpml:gimbalRotateTime>
              <wpml:payloadPositionIndex>0</wpml:payloadPositionIndex>
            </wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>
        <wpml:actionGroup>
          <wpml:actionGroupId>1</wpml:actionGroupId>
          <wpml:actionGroupStartIndex>0</wpml:actionGroupStartIndex>
          <wpml:actionGroupEndIndex>${sist}</wpml:actionGroupEndIndex>
          <wpml:actionGroupMode>sequence</wpml:actionGroupMode>
          <wpml:actionTrigger><wpml:actionTriggerType>multipleDistance</wpml:actionTriggerType><wpml:actionTriggerParam>${tall(plan.bildeavstand, 1)}</wpml:actionTriggerParam></wpml:actionTrigger>
          <wpml:action>
            <wpml:actionId>1</wpml:actionId>
            <wpml:actionActuatorFunc>takePhoto</wpml:actionActuatorFunc>
            <wpml:actionActuatorFuncParam><wpml:fileSuffix>skogiq</wpml:fileSuffix><wpml:payloadPositionIndex>0</wpml:payloadPositionIndex></wpml:actionActuatorFuncParam>
          </wpml:action>
        </wpml:actionGroup>` : ''}
      </Placemark>`).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:wpml="http://www.dji.com/wpmz/1.0.2">
  <Document>
${missionConfig(d, plan).replace(/^/gm, '  ')}
    <Folder>
      <wpml:templateId>0</wpml:templateId>
      <wpml:executeHeightMode>relativeToStartPoint</wpml:executeHeightMode>
      <wpml:waylineId>0</wpml:waylineId>
      <wpml:distance>${Math.round(plan.lengde)}</wpml:distance>
      <wpml:duration>${Math.round(plan.flytid * 60)}</wpml:duration>
      <wpml:autoFlightSpeed>${tall(plan.fart, 1)}</wpml:autoFlightSpeed>
${placemarks}
    </Folder>
  </Document>
</kml>
`;
}

// Enkel KML med området (for DJI Pilot 2 «Importer KML» til kartleggingsoppdrag, eller andre programmer).
export function lagOmradeKml(plan, navn = 'SkogIQ ortofoto') {
  const ring = [...plan.polygonGeo, plan.polygonGeo[0]].map(([lon, lat]) => `${tall(lon)},${tall(lat)},0`).join(' ');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${x(navn)}</name><Placemark><name>${x(navn)}</name><Polygon><outerBoundaryIs><LinearRing><coordinates>${ring}</coordinates></LinearRing></outerBoundaryIs></Polygon></Placemark></Document></kml>
`;
}

// ---------- ZIP (uten komprimering) ----------
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (b) => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
export function lagZip(filer) {
  const enc = new TextEncoder(); const deler = []; const sentral = []; let pos = 0;
  for (const [navn, innhold] of filer) {
    const n = enc.encode(navn); const data = typeof innhold === 'string' ? enc.encode(innhold) : innhold; const c = crc32(data);
    const lok = new DataView(new ArrayBuffer(30));
    lok.setUint32(0, 0x04034b50, true); lok.setUint16(4, 20, true); lok.setUint16(6, 0x0800, true); lok.setUint16(8, 0, true);
    lok.setUint32(14, c, true); lok.setUint32(18, data.length, true); lok.setUint32(22, data.length, true); lok.setUint16(26, n.length, true);
    deler.push(new Uint8Array(lok.buffer), n, data);
    const s = new DataView(new ArrayBuffer(46));
    s.setUint32(0, 0x02014b50, true); s.setUint16(4, 20, true); s.setUint16(6, 20, true); s.setUint16(8, 0x0800, true);
    s.setUint32(16, c, true); s.setUint32(20, data.length, true); s.setUint32(24, data.length, true); s.setUint16(28, n.length, true); s.setUint32(42, pos, true);
    sentral.push(new Uint8Array(s.buffer), n);
    pos += 30 + n.length + data.length;
  }
  const sLen = sentral.reduce((t, b) => t + b.length, 0);
  const slutt = new DataView(new ArrayBuffer(22));
  slutt.setUint32(0, 0x06054b50, true); slutt.setUint16(8, filer.length, true); slutt.setUint16(10, filer.length, true); slutt.setUint32(12, sLen, true); slutt.setUint32(16, pos, true);
  const alle = [...deler, ...sentral, new Uint8Array(slutt.buffer)];
  const ut = new Uint8Array(alle.reduce((t, b) => t + b.length, 0)); let o = 0; for (const b of alle) { ut.set(b, o); o += b.length; }
  return ut;
}
// DJI-rute: KMZ med wpmz/template.kml og wpmz/waylines.wpml.
export const lagKmz = (plan, opt = {}) => lagZip([['wpmz/template.kml', lagTemplateKml(plan, opt)], ['wpmz/waylines.wpml', lagWaylinesWpml(plan)]]);

// Sjekkliste før flyging (Norge – Luftfartstilsynet, åpen kategori).
export const SJEKKLISTE = [
  { id: 'operator', tekst: 'Registrert som droneoperatør hos Luftfartstilsynet (flysmart.no), og operatør-ID er satt i dronen' },
  { id: 'kompetanse', tekst: 'Kompetansebevis A1/A3 – og A2 for C2-droner nær folk (M3E/M3M er C2)' },
  { id: 'luftrom', tekst: 'Luftrommet er sjekket (Ninox Drone / Avinor): ikke i kontrollsone, nær flyplass eller i restriksjonsområde' },
  { id: 'vern', tekst: 'Ikke over naturreservat med ferdselsforbud for luftfartøy, og ikke over folkemengder' },
  { id: 'hoyde', tekst: 'Maks 120 m over bakken – og minst 20–30 m over høyeste tretopp' },
  { id: 'synsvidde', tekst: 'Dronen holdes innenfor synsvidde (VLOS) hele tiden – eller med luftobservatør' },
  { id: 'grunneier', tekst: 'Grunneier/naboer er varslet der ruten går utenfor egen eiendom' },
  { id: 'vaer', tekst: 'Vær: under ca. 10 m/s vind, ikke nedbør, helst overskyet eller sol høyt (jevnt lys gir bedre ortofoto)' },
  { id: 'batteri', tekst: 'Nok fulladede batterier og minnekort med plass til alle bildene' },
];
