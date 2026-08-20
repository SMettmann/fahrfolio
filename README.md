# Fahrfolio

**Einmal eintragen. Überall verwenden.**

Fahrfolio ist eine bewusst einfache Händler-Software für kleine und freie Gebrauchtwagenhändler. Ziel ist eine Bedienung, die ohne Schulung verständlich ist und doppelte Dateneingaben vermeidet.

## Produktidee

Ein Fahrzeug wird einmal angelegt. Dieselben Daten sollen anschließend für Fahrzeugakte, Verkaufsschild, Angebot, Kaufvertrag und spätere Dokumente wiederverwendet werden.

## Aktueller klickbarer Prototyp

Bereits umgesetzt:

- Fahrfolio-Branding und responsive Oberfläche
- Dashboard mit Bestand, Reservierungen, Verkäufen und Verkaufswert des aktuellen Bestands
- Fahrzeugdatenbank mit Suche und Statusfilter
- Fahrzeuge neu anlegen und bearbeiten
- Fahrzeugakte mit FIN, Kennzeichen, EZ, HU, Kilometerstand, PS/kW, Haltern, Farbe, Ein-/Verkaufspreis, Ausstattung und bekannten Mängeln
- Status: im Bestand / reserviert / verkauft
- Kundenverwaltung mit Kontaktdaten und Adresse
- druckbares A4-Verkaufsschild aus vorhandenen Fahrzeugdaten
- Kaufvertrag-Workflow mit automatischer Übernahme vorhandener Fahrzeug- und Käuferdaten
- zusätzliche Verkaufsangaben wie Kaufpreis, Übergabekilometer, Übergabedatum, Zahlungsart, Schlüssel, Unfallangabe, Mängel, Zubehör und weitere Vereinbarungen
- lokale Speicherung im Browser für den Prototyp

## Als Nächstes

- Händlerprofil mit einmalig hinterlegten Verkäufer-/Firmendaten
- vollständiger rechtlich geprüfter Kaufvertrag
- digitale Unterschriften
- PDF-Erzeugung und Dokumentenablage
- Angebots-PDF
- Fahrzeugbilder
- produktives Backend, Login und technisch getrennte Händlerkonten
- Export-, Lösch- und Aufbewahrungsfunktionen
- später optional FIN/DAT-Schnittstelle

## Datenschutz & Sicherheit

Datenschutz ist eine feste Bauvorgabe und wird vor dem produktiven Backend berücksichtigt.

- Das öffentliche Repository enthält ausschließlich Code und erfundene Demo-Daten.
- Echte Kunden- oder Händlerdaten dürfen nicht im öffentlichen GitHub-Repository gespeichert werden.
- Jeder produktive Datensatz wird eindeutig einem Händlerkonto zugeordnet.
- Händler dürfen technisch ausschließlich auf ihre eigenen Fahrzeuge, Kunden, Verträge und Dokumente zugreifen.
- Für die produktive Version werden EU-Hosting, HTTPS, sichere Authentifizierung, Backups, Export/Löschung und ein Lösch-/Aufbewahrungskonzept eingeplant.
- Vor dem Einsatz mit echten Kundendaten werden AVV, Datenschutzinformationen, TOMs und die finalen Vertragsunterlagen vorbereitet und fachkundig geprüft.

Die ausführliche Bauvorgabe liegt unter `docs/datenschutz-architektur.md`.

## Sicherheit im Prototyp

Der aktuelle Stand nutzt `localStorage` und ist ausschließlich für Testdaten gedacht. Es gibt noch kein produktives Backend. Bitte keine echten Kunden-, Zahlungs- oder Zugangsdaten eingeben.

## Produktregel

> Wenn eine alltägliche Funktion erklärt werden muss, ist sie noch nicht einfach genug gebaut.
