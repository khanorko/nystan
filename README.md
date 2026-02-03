# Kontextlager

Ett platsbaserat prototypverktyg för designstudenter. Skapa medieobjekt som aktiveras av kontext – GPS, sensorer, QR-koder eller närvaro.

## Kom igång

### Installation (utveckling)

```bash
npm install
npm run dev
```

### Använd som PWA

1. Öppna appen i Chrome/Safari på din mobil
2. Klicka på "Lägg till på hemskärmen" / "Installera"
3. Appen fungerar nu offline

## Skapa objekt

1. **Ge GPS-tillstånd** – appen behöver veta var du är
2. **Tryck på +** – skapar ett objekt på din nuvarande plats
3. **Fyll i:**
   - Titel (obligatoriskt)
   - Text (valfritt)
   - Bild (kamera eller galleri)
   - Ljud (spela in eller välj fil)
   - Trigger-typ (hur objektet aktiveras)
   - Radie (hur nära man måste vara)

## Trigger-typer

| Trigger | Beskrivning |
|---------|-------------|
| 📍 GPS | Aktiveras när du är inom radien |
| 📷 QR-kod | Aktiveras genom att skanna en QR-kod |
| 📳 Skaka | Aktiveras när du skakar telefonen |
| 📱 Luta | Aktiveras när du lutar telefonen |
| 🧭 Kompass | Aktiveras när du tittar i rätt riktning |
| 👆 Tryck | Aktiveras vid tryck på skärmen |
| ✋ Håll | Aktiveras efter att hålla inne på skärmen |
| ⏱️ Timer | Aktiveras efter en fördröjning |
| 👥 Närvaro | Aktiveras när flera enheter är nära |

## Upplevelseläge

Tryck på ▶ (play-knappen) för att starta upplevelseläget:

- Objekten aktiveras automatiskt baserat på triggers
- Skanna QR-koder med kameraknappen
- Sensorer (skaka, luta, kompass) kräver att du ger tillstånd
- Närvarosystemet visar andra enheter i samma session

## Session & Närvaro

För att uppleva tillsammans med andra:

1. Tryck på 👥-knappen i upplevelseläget
2. **Skapa session** – får en kod att dela
3. **Gå med** – ange en kod från någon annan
4. Nu ser ni varandras positioner

## Export & Import

- **Exportera:** Spara alla objekt som JSON-fil (backup eller dela)
- **Importera:** Läs in objekt från en JSON-fil

## Tekniskt

- **PWA** – Fungerar offline, installerbar
- **IndexedDB** – All data sparas lokalt i telefonen
- **Leaflet/OpenStreetMap** – Kartor (cacheas för offline)
- **Web Audio API** – Ljudinspelning och uppspelning
- **DeviceOrientation API** – Sensorer (gyro, kompass)

## För lärare

Kontextlager är designat för Research through Design-kurser. Några övningar:

1. **Ljudvandring** – Skapa en serie GPS-triggade ljudobjekt
2. **Skattjakt** – Använd QR-koder utspridda i området
3. **Kollektiv upplevelse** – Proximity-triggers som kräver flera deltagare
4. **Sensorexperiment** – Utforska kompass och lutning

## Begränsningar

- GPS fungerar bäst utomhus
- Sensorer kräver tillstånd (iOS 13+)
- Ljud spelas bara när appen är öppen (iOS-begränsning)
- Närvarosystemet kräver en relay-server för full funktion

---

Skapat för HKR och STI designstudenter.
