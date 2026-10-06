# ❤️ Therese & Helge

En kjærlighets- og forelskelsesapp for **Therese og Helge**, med humor, økologisk mat,
randonee, fjellturer og geologi. Ren statisk HTML/CSS/JS uten byggesteg. Alt lagres i nettleseren (`localStorage`), og kan
synkes mellom Therese og Helges telefoner via Firebase Firestore.

Åpen adresse: <https://trond-web.github.io/trond-repos/therese-helge/>

## Fanene

| Fane | Hva |
|---|---|
| **Oss to** | Dagens geologiske kjærlighetserklæring, *Forholdsvarsel* (skredvarsel-parodi der laveste dagsform styrer faregraden, akkurat som det svakeste laget i snødekket), eventyrgenerator og ukens kjærlighetsoppdrag. |
| **Turer** | Loggfør randonee- og fjellturer med høydemeter, forhold, romantikk-score og hvem som kokte kaffen. Høydeprofil og milepæler (Galdhøpiggen, Everest, Kármán-linjen …) og ei ønskeliste med topper. |
| **Øko-kjøkken** | Handleliste med øko-måler og ærlige kommentarer, økologiske turmatoppskrifter som kan legges rett på lista, og sesongkalender for norske råvarer. |
| **Geologi** | «Hvilken bergart er forholdet i dag?», en steinhard quiz, steinsamlingen fra turdagboka og forholdets egen geologiske tidsskala. |
| **Lapper** | Kjærlighetslapper på den digitale kjøleskapsdøra. |

## Kom i gang

Åpne `index.html` i en nettleser, eller server mappen statisk (f.eks. `npx serve .`).
Appen starter med noen eksempler merket *eksempel*. Under **Oss to → Innstillinger**
kan dere endre datoen dere ble kjærester (satt til 4. oktober 2026) og fjerne eksemplene.

## Synk mellom telefonene

Når `firebase-config.js` er fylt ut, får **Oss to** et kort for synk. Den ene lager en
parkode, den andre åpner lenken som vises. Deretter deler de turer, ønskeliste, handleliste,
lapper, kjærestedato, dagsform og ukens oppdrag i sanntid. Quizen er personlig og synkes ikke.

Data ligger i Firestore under `par/<parkode>`, med én samling per liste, slik at begge kan
endre samtidig uten å overskrive hverandre. Parkoden er 20 tilfeldige tegn og fungerer som
nøkkel: den som kjenner koden kan lese og endre, og reglene i `firestore.rules` hindrer
at noen kan liste opp par.

### Engangsoppsett av Firebase (ca. 5 minutter)

1. Gå til <https://console.firebase.google.com> og velg **Legg til prosjekt**
   (Google Analytics kan slås av).
2. **Build → Firestore Database → Create database**. Velg en europeisk lokasjon
   (f.eks. `eur3`) og **production mode**.
3. Åpne fanen **Rules**, lim inn innholdet i `firestore.rules` og trykk **Publish**.
4. **Prosjektinnstillinger (tannhjulet) → Dine apper → Web (`</>`)**. Registrer appen
   (Hosting trengs ikke) og kopier `firebaseConfig`-objektet.
5. Lim objektet inn i `firebase-config.js` som `window.FIREBASE_CONFIG = { ... };` og push
   til `main`. Verdiene er ikke hemmelige.

Gratisnivået i Firebase (Spark) er langt mer enn nok for to personer.
