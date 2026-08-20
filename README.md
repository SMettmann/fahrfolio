# Fahrfolio

**Einmal eintragen. Überall verwenden.**

Fahrfolio ist eine bewusst einfache Händler-Software für kleine und freie Gebrauchtwagenhändler. Ziel ist eine Bedienung, die ohne Schulung verständlich ist und doppelte Dateneingaben vermeidet.

## Produktidee

Ein Fahrzeug wird einmal angelegt. Dieselben Daten sollen anschließend für Fahrzeugakte, Verkaufsschild, Angebot, Kaufvertrag und spätere Dokumente wiederverwendet werden.

## Aktueller klickbarer Prototyp

Bereits umgesetzt:

- Fahrfolio-Branding und responsive Oberfläche
- Dashboard mit Bestand, Reservierungen, Verkäufen und Bestandswert
- Fahrzeugdatenbank mit Suche und Statusfilter
- Fahrzeuge neu anlegen und bearbeiten
- Fahrzeugakte mit FIN, Kennzeichen, EZ, HU, Kilometerstand, PS/kW, Haltern, Farbe, Ein-/Verkaufspreis, Ausstattung und bekannten Mängeln
- Status: im Bestand / reserviert / verkauft
- Kundenverwaltung mit Kontaktdaten und Adresse
- druckbares A4-Verkaufsschild aus vorhandenen Fahrzeugdaten
- Kaufvertrag-Workflow: Fahrzeug + Käufer auswählen und vorhandene Daten automatisch in eine Vertragsvorschau übernehmen
- lokale Speicherung im Browser für den Prototyp

## Als Nächstes

- vollständiger rechtlich geprüfter Kaufvertrag
- digitale Unterschriften
- PDF-Erzeugung und Dokumentenablage
- Angebots-PDF
- Fahrzeugbilder
- produktives Backend, Login und getrennte Händlerkonten
- später optional FIN/DAT-Schnittstelle

## Sicherheit im Prototyp

Der aktuelle Stand nutzt `localStorage` und ist ausschließlich für Testdaten gedacht. Es gibt noch kein produktives Backend. Bitte keine echten Kunden-, Zahlungs- oder Zugangsdaten eingeben.

## Produktregel

> Wenn eine alltägliche Funktion erklärt werden muss, ist sie noch nicht einfach genug gebaut.
