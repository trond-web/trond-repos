// Kodelister fra matrikkelen, Askeladden (Riksantikvaren) og SOSI plan.

// Bygningstype (NS 3457, matrikkelen). Ukjente koder vises med nummeret.
export const BYGNINGSTYPE = {
  111: 'Enebolig', 112: 'Enebolig med hybel/sokkelleilighet', 113: 'Våningshus', 121: 'Tomannsbolig, vertikaldelt',
  122: 'Tomannsbolig, horisontaldelt', 123: 'Våningshus, tomannsbolig, vertikaldelt', 124: 'Våningshus, tomannsbolig, horisontaldelt',
  131: 'Rekkehus', 133: 'Kjedehus inkl. atriumhus', 135: 'Terrassehus', 136: 'Andre småhus med 3 boliger eller flere',
  141: 'Store frittliggende boligbygg på 2 etasjer', 142: 'Store frittliggende boligbygg på 3 og 4 etasjer',
  143: 'Store frittliggende boligbygg på 5 etasjer eller over', 144: 'Store sammenbygde boligbygg på 2 etasjer',
  145: 'Store sammenbygde boligbygg på 3 og 4 etasjer', 146: 'Store sammenbygde boligbygg på 5 etasjer og over',
  151: 'Bo- og servicesenter', 152: 'Studenthjem/studentboliger', 159: 'Annen bygning for bofellesskap',
  161: 'Fritidsbygning (hytte, sommerhus o.l.)', 162: 'Helårsbolig benyttet som fritidsbolig', 163: 'Våningshus benyttet som fritidsbolig',
  171: 'Seterhus, sel, rorbu o.l.', 172: 'Skogs- og utmarkskoie, gamme', 181: 'Garasje, uthus, anneks knyttet til bolig',
  182: 'Garasje, uthus, anneks knyttet til fritidsbolig', 183: 'Naust, båthus, sjøbu', 193: 'Boligbrakker', 199: 'Annen boligbygning',
  211: 'Fabrikkbygning', 212: 'Verkstedbygning', 214: 'Bygning for renseanlegg', 216: 'Bygning for vannforsyning', 219: 'Annen industribygning',
  221: 'Kraftstasjon', 223: 'Transformatorstasjon', 229: 'Annen energiforsyningsbygning', 231: 'Lagerhall', 232: 'Kjøle- og fryselager',
  233: 'Silobygning', 239: 'Annen lagerbygning', 241: 'Hus for dyr, fôrlager, strølager, frukt- og grønnsakslager, landbrukssilo, høy-/korntørke',
  243: 'Veksthus', 244: 'Driftsbygning for fiske og fangst', 245: 'Naust/redskapshus for fiske', 248: 'Annen fiskeri- og fangstbygning',
  249: 'Annen landbruksbygning', 311: 'Kontor- og administrasjonsbygning', 312: 'Bankbygning, posthus', 313: 'Mediebygning',
  319: 'Annen kontorbygning', 321: 'Kjøpesenter, varehus', 322: 'Butikkbygning', 323: 'Bensinstasjon', 329: 'Annen forretningsbygning',
  330: 'Messe- og kongressbygning', 411: 'Ekspedisjonsbygning, flyterminal, kontrolltårn', 412: 'Jernbane- og T-banestasjon',
  415: 'Godsterminal', 416: 'Postterminal', 419: 'Annen ekspedisjons- og terminalbygning', 429: 'Annen telekommunikasjonsbygning',
  431: 'Parkeringshus', 439: 'Annen garasje- hangarbygning', 441: 'Trafikktilsynsbygning', 449: 'Annen veg- og trafikktilsynsbygning',
  511: 'Hotellbygning', 512: 'Motellbygning', 519: 'Annen hotellbygning', 521: 'Hospits, pensjonat', 522: 'Vandrerhjem, feriehjem/-koloni, turisthytte',
  523: 'Appartement', 524: 'Campinghytte/utleiehytte', 529: 'Annen bygning for overnatting', 531: 'Restaurantbygning, kafébygning',
  532: 'Sentralkjøkken, kantinebygning', 533: 'Gatekjøkken, kioskbygning', 539: 'Annen restaurantbygning', 611: 'Lekepark', 612: 'Barnehage',
  613: 'Barneskole', 614: 'Ungdomsskole', 615: 'Kombinert barne- og ungdomsskole', 616: 'Videregående skole', 619: 'Annen skolebygning',
  621: 'Universitets- og høgskolebygning', 623: 'Laboratoriebygning', 629: 'Annen undervisningsbygning', 641: 'Museum, kunstgalleri',
  642: 'Bibliotek, mediatek', 643: 'Zoologisk og botanisk hage', 649: 'Annen museums- og bibliotekbygning', 651: 'Idrettshall', 652: 'Ishall',
  653: 'Svømmehall', 654: 'Tribune og idrettsgarderobe', 655: 'Helsestudio', 659: 'Annen idrettsbygning',
  661: 'Kino-, teater-, opera-, konserthus', 662: 'Samfunnshus, grendehus', 663: 'Diskotek', 669: 'Annet kulturhus', 671: 'Kirke, kapell',
  672: 'Bedehus, menighetshus', 673: 'Krematorium, gravkapell, bårehus', 674: 'Synagoge, moské', 675: 'Kloster',
  679: 'Annen bygning for religiøse aktiviteter', 719: 'Sykehus', 721: 'Sykehjem', 722: 'Bo- og behandlingssenter',
  723: 'Rehabiliteringsinstitusjon, kurbad', 729: 'Annet sykehjem', 731: 'Klinikk, legekontor/-senter/-vakt', 732: 'Helse- og sosialsenter, helsestasjon',
  739: 'Annen primærhelsebygning', 819: 'Fengselsbygning', 821: 'Politistasjon', 822: 'Brannstasjon, ambulansestasjon',
  823: 'Fyrstasjon, losstasjon', 824: 'Stasjon for radarovervåkning av fly- og/eller skipstrafikk', 825: 'Tilfluktsrom, bygd for seg selv',
  829: 'Annen beredskapsbygning', 830: 'Monument', 840: 'Offentlig toalett',
};
export const bygningstype = (k) => (k == null || k === '' ? 'Ukjent bygningstype' : BYGNINGSTYPE[parseInt(k, 10)] || `Bygningstype ${k}`);

export const BYGNINGSSTATUS = {
  RA: 'Rammetillatelse', IG: 'Igangsettingstillatelse', MB: 'Midlertidig brukstillatelse', FA: 'Ferdigattest', TB: 'Tatt i bruk',
  MT: 'Meldingssak, tiltak registrert', MF: 'Meldingssak, tiltak fullført', IP: 'Ikke pliktig registrert', GR: 'Godkjent revet',
  BR: 'Revet/brent', BF: 'Flyttet', BA: 'Bygging avlyst', BU: 'Bygningsnummer utgått',
};

// SEFRAK-status (feltet sefrakStatus). Tolket ut fra dateringene i datasettet: 2 = før 1850, 1 = 1850–1900 (og senere), 0 = revet/borte.
export const SEFRAK_STATUS = {
  2: { kort: 'Før 1850', tekst: 'Registrert som eldre enn 1850 (rød trekant i SEFRAK). Riving eller vesentlig endring skal forelegges fylkeskommunen.', nivaa: 'hoy', farge: 'rod' },
  1: { kort: '1850–1900', tekst: 'Registrert som stående bygning fra 1850–1900 (gul trekant). Ikke vernet bare fordi den er SEFRAK-registrert, men et signal om mulig verneverdi.', nivaa: 'middels', farge: 'gul' },
  0: { kort: 'Revet/borte', tekst: 'Registrert i SEFRAK, men oppført som revet, flyttet eller borte.', nivaa: 'lav', farge: 'graa' },
};

// Vernetype i Askeladden.
export const VERNETYPE = {
  AUT: { tekst: 'Automatisk fredet', fredet: true },
  VED: { tekst: 'Vedtaksfredet', fredet: true },
  FOR: { tekst: 'Forskriftsfredet', fredet: true },
  FPG: { tekst: 'Fredet etter eldre lov', fredet: true },
  MID: { tekst: 'Midlertidig fredet', fredet: true },
  LIST: { tekst: 'Listeført kirke', listet: true },
  STAT: { tekst: 'Statlig listeført (statens verneplaner)', listet: true },
  KOM: { tekst: 'Kommunalt listeført (verneverdig)', listet: true },
  PBL: { tekst: 'Regulert til bevaring etter plan- og bygningsloven', listet: true },
  FVERN: { tekst: 'Foreslått vernet', listet: true },
  UAV: { tekst: 'Uavklart vernestatus' },
  IKKEV: { tekst: 'Ikke vernet' },
  IKKE: { tekst: 'Ikke fredet' },
  FJE: { tekst: 'Fjernet' },
  OPP: { tekst: 'Fredning opphevet' },
  OPPV: { tekst: 'Vern opphevet' },
};
export const vernetype = (k) => VERNETYPE[k]?.tekst || (k ? `Vernetype ${k}` : 'Ukjent vernestatus');

export const KULTURMINNEKATEGORI = {
  'E-BYG': 'Bygning', 'E-UTE': 'Anlegg/utomhus', 'E-ARK': 'Arkeologisk minne', 'E-TEK': 'Teknisk/industrielt minne', 'E-MAR': 'Marint minne',
  'E-KRK': 'Kirke/kirkested', 'E-BER': 'Bergkunst', 'E-RUI': 'Ruin', 'E-FAR': 'Fartøy',
  'L-BVF': 'Bygninger, anlegg og faste kulturminner', 'L-ARK': 'Arkeologisk lokalitet', 'L-KRK': 'Kirkested',
  'M-KULA': 'Kulturmiljø (NB!-registeret / nasjonal interesse i by)', 'M-FRED': 'Fredet kulturmiljø', 'M-VERD': 'Verdensarv',
};

// SOSI plan: angitt hensyn, båndlegging, faresoner m.m. (pbl. § 11-8 og § 12-6)
export const HENSYNSSONE = {
  110: 'Nedslagsfelt drikkevann', 120: 'Andre sikringssoner', 130: 'Byggeforbud rundt veg, bane og flyplass', 140: 'Frisikt', 190: 'Annen sikringssone',
  210: 'Rød støysone', 220: 'Gul støysone', 290: 'Annen støysone',
  310: 'Faresone ras og skred', 320: 'Faresone flom', 330: 'Faresone radon', 350: 'Faresone brann/eksplosjon', 360: 'Faresone skytebane',
  370: 'Faresone høyspenningsanlegg', 380: 'Annen faresone', 390: 'Faresone militær virksomhet',
  410: 'Krav om infrastruktur (veg)', 420: 'Krav om infrastruktur (vann og avløp)', 430: 'Krav om annen infrastruktur', 440: 'Krav om infrastruktur',
  510: 'Hensyn landbruk', 520: 'Hensyn reindrift', 530: 'Hensyn friluftsliv', 540: 'Hensyn grønnstruktur', 550: 'Hensyn landskap',
  560: 'Hensyn bevaring naturmiljø', 570: 'Hensyn bevaring kulturmiljø', 580: 'Hensyn bevaring av kulturmiljø (annet)',
  610: 'Hensyn reindrift', 710: 'Båndlegging for regulering etter pbl.', 720: 'Båndlegging etter lov om naturvern',
  730: 'Båndlegging etter lov om kulturminner', 740: 'Båndlegging etter andre lover', 750: 'Båndlegging etter lov om kulturminner (planlagt)',
  810: 'Krav om felles planlegging', 820: 'Omforming', 830: 'Fornyelse', 910: 'Reguleringsplan skal fortsatt gjelde', 920: 'Detaljering',
};
// Soner som betyr noe for kulturminner og vern av bygninger.
export const KULTURHENSYN = new Set([570, 580, 730, 750, 910]);

// Arealformål (pbl. 2008, SOSI). Hovedgrupper og vanlige underformål.
export const AREALFORMAL = {
  1001: 'Bebyggelse og anlegg', 1110: 'Boligbebyggelse', 1111: 'Boligbebyggelse – frittliggende småhus', 1112: 'Boligbebyggelse – konsentrert småhus',
  1113: 'Boligbebyggelse – blokkbebyggelse', 1120: 'Fritidsbebyggelse', 1121: 'Fritidsbebyggelse – frittliggende', 1130: 'Sentrumsformål',
  1140: 'Kjøpesenter', 1150: 'Forretninger', 1160: 'Offentlig eller privat tjenesteyting', 1300: 'Næringsbebyggelse', 1400: 'Idrettsanlegg',
  1500: 'Andre typer bebyggelse og anlegg', 1550: 'Uthus/naust/badehus', 1588: 'Annen særskilt angitt bebyggelse',
  1600: 'Grav- og urnelund', 1700: 'Fritids- og turistformål', 1800: 'Kombinert bebyggelse og anleggsformål', 1900: 'Kombinert bebyggelse og anlegg',
  2001: 'Samferdselsanlegg og teknisk infrastruktur', 2010: 'Veg', 2011: 'Kjøreveg', 2012: 'Fortau', 2013: 'Torg', 2014: 'Gatetun',
  2015: 'Gang-/sykkelveg', 2016: 'Gangveg/gangareal', 2018: 'Annen veggrunn – tekniske anlegg', 2019: 'Annen veggrunn – grøntareal',
  2080: 'Parkering', 3001: 'Grønnstruktur', 3020: 'Naturområde', 3030: 'Turdrag', 3040: 'Friområde', 3050: 'Park',
  4001: 'Forsvaret', 5001: 'Landbruks-, natur- og friluftsformål samt reindrift (LNFR)',
  5100: 'LNFR-areal for nødvendige tiltak for landbruk og reindrift og gårdstilknyttet næringsvirksomhet',
  5110: 'Landbruksformål', 5111: 'Jordbruk', 5112: 'Skogbruk', 5120: 'Naturformål', 5130: 'Friluftsformål',
  5200: 'LNFR-areal for spredt bolig-, fritids- eller næringsbebyggelse', 5210: 'Spredt boligbebyggelse', 5220: 'Spredt fritidsbebyggelse',
  5230: 'Spredt næringsbebyggelse', 6001: 'Bruk og vern av sjø og vassdrag', 6100: 'Ferdsel', 6600: 'Naturområde i sjø og vassdrag',
  6700: 'Friluftsområde i sjø og vassdrag', 6800: 'Kombinerte formål i sjø og vassdrag',
};
export const arealformal = (k) => (k == null ? null : AREALFORMAL[parseInt(k, 10)] || `Arealformål ${k}`);

export const PLANTYPE = { 20: 'Kommuneplanens arealdel', 21: 'Kommunedelplan', 22: 'Mindre endring av kommune(del)plan', 30: 'Eldre reguleringsplan', 31: 'Mindre reguleringsendring', 32: 'Bebyggelsesplan ihht. reguleringsplan', 33: 'Bebyggelsesplan ihht. kommuneplanens arealdel', 34: 'Områderegulering', 35: 'Detaljregulering' };
export const PLANSTATUS = { 1: 'Planlegging igangsatt', 2: 'Planforslag', 3: 'Endelig vedtatt arealplan', 4: 'Opphevet', 5: 'Utgått/erstattet', 6: 'Vedtatt plan med utsatt rettsvirkning', 8: 'Overstyrt' };

// Fylkesnummer (kommunenummerets to første siffer) → regional kulturminnemyndighet.
export const FYLKE = {
  '03': { navn: 'Oslo', myndighet: 'Byantikvaren i Oslo', url: 'https://www.oslo.kommune.no/etater-foretak-og-ombud/byantikvaren/' },
  11: { navn: 'Rogaland', myndighet: 'Rogaland fylkeskommune', url: 'https://www.rogfk.no/' },
  15: { navn: 'Møre og Romsdal', myndighet: 'Møre og Romsdal fylkeskommune', url: 'https://mrfylke.no/' },
  18: { navn: 'Nordland', myndighet: 'Nordland fylkeskommune', url: 'https://www.nfk.no/' },
  31: { navn: 'Østfold', myndighet: 'Østfold fylkeskommune', url: 'https://www.ostfoldfk.no/' },
  32: { navn: 'Akershus', myndighet: 'Akershus fylkeskommune', url: 'https://www.afk.no/' },
  33: { navn: 'Buskerud', myndighet: 'Buskerud fylkeskommune', url: 'https://bfk.no/' },
  34: { navn: 'Innlandet', myndighet: 'Innlandet fylkeskommune', url: 'https://innlandetfylke.no/' },
  39: { navn: 'Vestfold', myndighet: 'Vestfold fylkeskommune', url: 'https://www.vestfoldfylke.no/' },
  40: { navn: 'Telemark', myndighet: 'Telemark fylkeskommune', url: 'https://www.telemarkfylke.no/' },
  42: { navn: 'Agder', myndighet: 'Agder fylkeskommune', url: 'https://agderfk.no/' },
  46: { navn: 'Vestland', myndighet: 'Vestland fylkeskommune', url: 'https://www.vestlandfylke.no/' },
  50: { navn: 'Trøndelag', myndighet: 'Trøndelag fylkeskommune', url: 'https://www.trondelagfylke.no/' },
  55: { navn: 'Troms', myndighet: 'Troms fylkeskommune', url: 'https://www.tromsfylke.no/' },
  56: { navn: 'Finnmark', myndighet: 'Finnmark fylkeskommune', url: 'https://www.ffk.no/' },
};
export const fylkeFor = (kommunenr) => FYLKE[String(kommunenr).padStart(4, '0').slice(0, 2)] ||{ navn: 'fylket', myndighet: 'fylkeskommunen (kulturarv)', url: 'https://www.ra.no/' };
