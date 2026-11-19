// OpenAPI 3.1-beskrivelse av SkogIQ.ai: integrasjons-API-et (/api/v1, med API-nøkkel) i detalj, og de interne
// endepunktene som appen selv bruker (innlogging/økt) som oversikt. Serveres på GET /api/v1/openapi.json og vises
// i admin (admin.html › API).
import { VERSJON as APPVERSJON } from './js/versjon.js';

const ref = (n) => ({ $ref: `#/components/schemas/${n}` });
const svar = (beskrivelse, skjema) => ({ description: beskrivelse, content: { 'application/json': { schema: skjema } } });
const FEIL = { 400: { $ref: '#/components/responses/Feil' }, 401: { $ref: '#/components/responses/IkkeAutentisert' }, 404: { $ref: '#/components/responses/IkkeFunnet' }, 429: { $ref: '#/components/responses/ForMange' } };
const SKRIVFEIL = { ...FEIL, 403: { $ref: '#/components/responses/BareLes' }, 409: { $ref: '#/components/responses/Konflikt' } };
const planId = { name: 'planId', in: 'path', required: true, schema: { type: 'string' }, description: 'Planens id (fra GET /planer)' };
const ifMatch = { name: 'If-Match', in: 'header', required: false, schema: { type: 'string' }, description: 'Planversjonen (ETag) du bygget på. Gir 409 hvis planen er endret i mellomtiden.' };
const json = (skjema, eksempel) => ({ required: true, content: { 'application/json': { schema: skjema, ...(eksempel ? { example: eksempel } : {}) } } });

// Interne endepunkter (appen): [metode, sti, tag, beskrivelse, tilgang]
export const INTERNE = [
  ['GET', '/api/meg', 'Konto', 'Innlogget bruker, roller og godkjenning av vilkår', 'økt'],
  ['POST', '/api/logginn', 'Konto', 'Logg inn (e-post og passord)', 'åpen'], ['POST', '/api/loggut', 'Konto', 'Logg ut', 'økt'],
  ['POST', '/api/registrer', 'Konto', 'Registrer ny bruker', 'åpen'], ['POST', '/api/glemt', 'Konto', 'Glemt passord (lenke)', 'åpen'], ['POST', '/api/tilbakestill', 'Konto', 'Sett nytt passord fra lenke', 'åpen'],
  ['POST', '/api/passord', 'Konto', 'Bytt passord', 'økt'], ['POST', '/api/samtykke', 'Konto', 'Godta vilkår og personvern', 'økt'],
  ['POST', '/api/konto/innstillinger', 'Konto', 'Innstillinger (bruksstatistikk m.m.)', 'økt'], ['GET', '/api/konto/eksport', 'Konto', 'Innsyn: alle data om brukeren (JSON)', 'økt'], ['POST', '/api/konto/slett', 'Konto', 'Slett kontoen', 'økt'],
  ['GET/PUT', '/api/konto/profil', 'Konto', 'Profil (kontakt, foretak, roller, kommuner)', 'økt'], ['POST/DELETE', '/api/konto/bilde', 'Konto', 'Profilbilde', 'økt'], ['GET', '/api/bilde/{id}', 'Konto', 'Profilbilde (innloggede)', 'økt'],
  ['POST', '/api/bruk', 'Konto', 'Bruksstatistikk (aktiv tid, faner)', 'økt'],
  ['GET', '/api/sky/planer', 'Skylagring', 'Planene i skyen', 'økt'], ['GET/PUT/DELETE', '/api/sky/planer/{id}', 'Skylagring', 'Hent, lagre (versjonert) eller slett plan', 'økt'], ['GET', '/api/sky/planer/{id}/versjoner', 'Skylagring', 'Versjonshistorikk', 'økt'],
  ['POST/GET', '/api/plan …', 'Overføring', 'Plan mellom PC og mobil (kode/QR)', 'kode'], ['POST', '/api/plankobling', 'Overføring', 'Koble enhet med kode', 'kode'],
  ['GET/POST/PUT', '/api/tilbud …', 'Tilbud', 'Tilbudsforespørsler, svar, avslag, innboks og nye svar', 'økt / kode'], ['GET/POST/PUT', '/api/tommer …', 'Tilbud', 'Deling med tømmerkjøper', 'økt / kode'],
  ['GET/POST/PUT', '/api/nettverk …', 'Nettverk', 'Koblinger, aktører og chat', 'økt'],
  ['GET/POST', '/api/tilbakemelding', 'Tilbakemelding', 'Send tilbakemelding; /mine gir egne', 'økt'],
  ['GET/POST', '/api/kontroller …', 'Felt', 'Droneoppdrag og kontroll (kode)', 'kode'], ['POST', '/api/kobling', 'Felt', 'Koble kontroller med kode', 'kode'],
  ['GET/POST', '/api/jd/…', 'John Deere', 'Operations Center: innlogging, organisasjoner, skifter, operasjoner, filer', 'økt'],
  ['GET', '/api/nve/…', 'Fagdata', 'Vær- og flomdata fra NVE (mellomledd)', 'åpen'],
  ['GET', '/api/admin/oversikt', 'Admin', 'Brukere og bruksstatistikk', 'admin'], ['POST', '/api/admin/bruker', 'Admin', 'Endre bruker (roller, sperring, lenke)', 'admin'],
  ['GET/PUT', '/api/admin/tilbakemelding …', 'Admin', 'Tilbakemeldinger og svar', 'admin'], ['GET/POST', '/api/admin/backup …', 'Admin', 'Sikkerhetskopier', 'admin'],
  ['GET/POST/DELETE', '/api/admin/apinokler …', 'Admin', 'API-nøkler og logg over API-kall', 'admin'],
];

export function openapi() {
  const v1 = {
    '/api/v1': { get: { tags: ['Generelt'], summary: 'Informasjon om API-et og nøkkelen', security: [{}, { apiNokkel: [] }], responses: { 200: svar('Informasjon', { type: 'object' }) } } },
    '/api/v1/planer': { get: { tags: ['Planer'], summary: 'Planene til brukeren nøkkelen gjelder', responses: { 200: svar('Planer', { type: 'object', properties: { planer: { type: 'array', items: ref('PlanInfo') } } }), ...FEIL } } },
    '/api/v1/planer/{planId}': { get: { tags: ['Planer'], summary: 'Hele planen (eiendom, bestand, tiltak, oppdrag, registreringer …)', parameters: [planId], responses: { 200: svar('Planen. ETag-hodet er versjonen.', { type: 'object', properties: { id: { type: 'string' }, versjon: { type: 'integer' }, endret: { type: 'string', format: 'date-time' }, plan: { type: 'object' } } }), ...FEIL } } },
    '/api/v1/planer/{planId}/eiendom': { get: { tags: ['Planer'], summary: 'Eiendommen som GeoJSON Feature (grense og matrikkel)', parameters: [planId], responses: { 200: svar('GeoJSON Feature', { type: 'object' }), ...FEIL } } },
    '/api/v1/planer/{planId}/bestand': { get: { tags: ['Bestand'], summary: 'Bestandene (kort form) – eller GeoJSON med ?format=geojson', parameters: [planId, { name: 'format', in: 'query', schema: { type: 'string', enum: ['geojson'] } }], responses: { 200: svar('Bestand', { type: 'object', properties: { bestand: { type: 'array', items: ref('Bestand') } } }), ...FEIL } } },
    '/api/v1/planer/{planId}/bestand/{bestandId}': { get: { tags: ['Bestand'], summary: 'Ett bestand med alle felt (id eller bestandsnummer)', parameters: [planId, { name: 'bestandId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: svar('Bestand', { type: 'object' }), ...FEIL } } },
    '/api/v1/planer/{planId}/tiltak': {
      get: { tags: ['Tiltak'], summary: 'Tiltak i planen', parameters: [planId, { name: 'status', in: 'query', schema: { type: 'string', enum: ['planlagt', 'utfort'] } }, { name: 'aar', in: 'query', schema: { type: 'integer' } }, { name: 'bestand', in: 'query', schema: { type: 'string' }, description: 'Bestand-id eller -nummer' }], responses: { 200: svar('Tiltak', { type: 'object', properties: { tiltak: { type: 'array', items: ref('Tiltak') } } }), ...FEIL } },
      post: { tags: ['Tiltak'], summary: 'Opprett tiltak (skrivetilgang)', parameters: [planId, ifMatch], requestBody: json(ref('NyttTiltak'), { bestandId: 'b12', type: 'ungskogpleie', aar: 2027, prioritet: 1, kommentar: 'Lauvrydding' }), responses: { 201: svar('Opprettet', { type: 'object', properties: { tiltak: ref('Tiltak'), versjon: { type: 'integer' } } }), ...SKRIVFEIL } },
    },
    '/api/v1/planer/{planId}/tiltak/{tiltakId}': {
      get: { tags: ['Tiltak'], summary: 'Ett tiltak', parameters: [planId, { name: 'tiltakId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: svar('Tiltak', { type: 'object', properties: { tiltak: ref('Tiltak') } }), ...FEIL } },
      patch: { tags: ['Tiltak'], summary: 'Endre tiltak – f.eks. merk som utført (skrivetilgang)', parameters: [planId, { name: 'tiltakId', in: 'path', required: true, schema: { type: 'string' } }, ifMatch], requestBody: json(ref('EndreTiltak'), { status: 'utfort', utfortDato: '2026-11-19' }), responses: { 200: svar('Endret', { type: 'object' }), ...SKRIVFEIL } },
      delete: { tags: ['Tiltak'], summary: 'Slett tiltak (skrivetilgang)', parameters: [planId, { name: 'tiltakId', in: 'path', required: true, schema: { type: 'string' } }, ifMatch], responses: { 200: svar('Slettet', { type: 'object' }), ...SKRIVFEIL } },
    },
    '/api/v1/planer/{planId}/oppdrag': { get: { tags: ['Oppdrag'], summary: 'Oppdrag (bestillinger til utførere)', parameters: [planId], responses: { 200: svar('Oppdrag', { type: 'object' }), ...FEIL } } },
    '/api/v1/planer/{planId}/oppdrag/{oppdragId}': {
      get: { tags: ['Oppdrag'], summary: 'Ett oppdrag (id eller nummer)', parameters: [planId, { name: 'oppdragId', in: 'path', required: true, schema: { type: 'string' } }], responses: { 200: svar('Oppdrag', { type: 'object' }), ...FEIL } },
      patch: { tags: ['Oppdrag'], summary: 'Endre status, periode eller merknad (skrivetilgang)', parameters: [planId, { name: 'oppdragId', in: 'path', required: true, schema: { type: 'string' } }, ifMatch], requestBody: json({ type: 'object', properties: { status: { type: 'string', enum: ['utkast', 'bestilt', 'pagar', 'utfort', 'avbrutt'] }, merknad: { type: 'string' }, periode: { type: 'object', properties: { fra: { type: 'string', format: 'date' }, til: { type: 'string', format: 'date' } } } } }, { status: 'pagar' }), responses: { 200: svar('Endret', { type: 'object' }), ...SKRIVFEIL } },
    },
    '/api/v1/planer/{planId}/registreringer': {
      get: { tags: ['Registreringer'], summary: 'Feltregistreringer (uten bilder)', parameters: [planId], responses: { 200: svar('Registreringer', { type: 'object' }), ...FEIL } },
      post: { tags: ['Registreringer'], summary: 'Ny feltregistrering (skrivetilgang)', parameters: [planId, ifMatch], requestBody: json({ type: 'object', required: ['lat', 'lon'], properties: { kategori: { type: 'string' }, tekst: { type: 'string' }, lat: { type: 'number' }, lon: { type: 'number' }, bestandId: { type: 'string' } } }, { kategori: 'Stormfall', tekst: '30 trær veltet', lat: 60.95, lon: 11.45 }), responses: { 201: svar('Opprettet', { type: 'object' }), ...SKRIVFEIL } },
    },
    '/api/v1/planer/{planId}/kantsone': { get: { tags: ['Miljø'], summary: 'Kantsone mot vann (15/30 m) som GeoJSON Feature', parameters: [planId], responses: { 200: svar('GeoJSON Feature', { type: 'object' }), ...FEIL } } },
    '/api/v1/planer/{planId}/skogkarakter': { get: { tags: ['Beregninger'], summary: 'SkogIQ Skogkarakter (A–E, områder, indikatorer, forbedringer)', parameters: [planId], responses: { 200: svar('Skogkarakter', { type: 'object' }), ...FEIL } } },
    '/api/v1/planer/{planId}/landbrukstakst': { get: { tags: ['Beregninger'], summary: 'Beregnet landbrukstakst (konsesjon, odel, åsete)', parameters: [planId], responses: { 200: svar('Landbrukstakst', { type: 'object' }), ...FEIL } } },
  };
  // De interne endepunktene som egen oversikt (x-interne) – ikke for integrasjoner.
  return {
    openapi: '3.1.0',
    info: { title: 'SkogIQ.ai API', version: `v1 (app ${APPVERSJON})`, description: 'Integrasjons-API for SkogIQ.ai. En API-nøkkel opprettes av administrator for én bruker, med lese- eller skrivetilgang, og gir bare tilgang til den brukerens egne planer. Skrivinger lagres som ny planversjon og synkroniseres til appene. Bruk If-Match med planversjonen for å unngå å overskrive andres endringer. Grense: 300 kall per minutt per nøkkel. Alle kall logges (uten innhold).', contact: { name: 'Trond Harald Sand', email: 'trond@strafferunden.no' } },
    servers: [{ url: 'https://skogiq-production.up.railway.app' }],
    tags: [{ name: 'Generelt' }, { name: 'Planer' }, { name: 'Bestand' }, { name: 'Tiltak' }, { name: 'Oppdrag' }, { name: 'Registreringer' }, { name: 'Miljø' }, { name: 'Beregninger' }],
    security: [{ apiNokkel: [] }],
    paths: v1,
    components: {
      securitySchemes: { apiNokkel: { type: 'http', scheme: 'bearer', bearerFormat: 'skiq_<id>_<hemmelighet>', description: 'Authorization: Bearer skiq_… (eller X-API-Key: skiq_…)' } },
      responses: {
        Feil: svar('Ugyldig forespørsel', ref('Feil')), IkkeAutentisert: svar('Mangler eller ugyldig API-nøkkel', ref('Feil')), BareLes: svar('Nøkkelen har bare lesetilgang', ref('Feil')),
        IkkeFunnet: svar('Finnes ikke', ref('Feil')), Konflikt: svar('Planen er endret siden du hentet den (If-Match)', ref('Feil')), ForMange: svar('Rate-grense nådd', ref('Feil')),
      },
      schemas: {
        Feil: { type: 'object', properties: { feil: { type: 'string' }, kode: { type: 'string' } } },
        PlanInfo: { type: 'object', properties: { id: { type: 'string' }, navn: { type: 'string' }, versjon: { type: 'integer' }, endret: { type: 'string', format: 'date-time' }, areal: { type: 'number' }, antall: { type: 'integer' }, kommune: { type: 'string' }, kommunenr: { type: 'string' }, gnrbnr: { type: 'string' } } },
        Bestand: { type: 'object', properties: { id: { type: 'string' }, nr: { type: 'string' }, areal: { type: 'number', description: 'daa' }, treslag: { type: 'string', enum: ['G', 'F', 'L'] }, bonitet: { type: 'integer', description: 'H40' }, hogstklasse: { type: ['integer', 'null'] }, alder: { type: 'number' }, volumDaa: { type: 'number' }, treantall: { type: 'number' }, hoyde: { type: 'number' }, miljo: { type: 'boolean' }, vegetasjon: { type: ['string', 'null'] }, kantsone: { type: ['object', 'null'] }, antallTiltak: { type: 'integer' } } },
        Tiltak: { type: 'object', properties: { id: { type: 'string' }, bestandId: { type: 'string' }, bestandNr: { type: 'string' }, type: { type: 'string' }, navn: { type: 'string' }, aar: { type: 'integer' }, status: { type: 'string', enum: ['planlagt', 'utfort'] }, prioritet: { type: ['integer', 'null'] }, kommentar: { type: 'string' }, utfortDato: { type: ['string', 'null'], format: 'date' }, arealDaa: { type: ['number', 'null'] }, endret: { type: ['string', 'null'] }, kilde: { type: ['string', 'null'] } } },
        NyttTiltak: { type: 'object', required: ['bestandId', 'type', 'aar'], properties: { bestandId: { type: 'string', description: 'Bestand-id eller -nummer' }, type: { type: 'string', enum: ['sluttavvirkning', 'tynning', 'lukkethogst', 'planting', 'suppleringsplanting', 'markberedning', 'ungskogpleie', 'stammekvisting', 'gjodsling', 'groftrensk', 'vei', 'miljo', 'annet'] }, aar: { type: 'integer' }, prioritet: { type: 'integer', enum: [1, 2, 3] }, kommentar: { type: 'string' }, arealDaa: { type: 'number' } } },
        EndreTiltak: { type: 'object', properties: { status: { type: 'string', enum: ['planlagt', 'utfort'] }, utfortDato: { type: 'string', format: 'date' }, aar: { type: 'integer' }, prioritet: { type: 'integer', enum: [1, 2, 3] }, kommentar: { type: 'string' }, arealDaa: { type: 'number' } } },
      },
    },
    'x-interne-endepunkter': INTERNE.map(([metode, sti, tag, beskrivelse, tilgang]) => ({ metode, sti, tag, beskrivelse, tilgang })),
  };
}
