# Fahrfolio – Datenschutz & Sicherheitsarchitektur

Dieses Dokument ist eine feste Bauvorgabe für die produktive Fahrfolio-Version. Datenschutz wird nicht nachträglich ergänzt, sondern von Anfang an in Datenmodell, Backend und Bedienung berücksichtigt.

## Grundprinzip

Jeder Händler besitzt einen eigenen, logisch getrennten Datenbereich. Fahrzeuge, Kunden und Dokumente müssen immer eindeutig einem Händlerkonto (`tenant_id` / `dealer_id`) zugeordnet sein.

Die Oberfläche allein darf niemals der einzige Schutz sein. Zugriffsregeln müssen serverseitig bzw. auf Datenbankebene durchgesetzt werden.

## Öffentliche GitHub-Version

- Im öffentlichen Repository liegen nur Programmcode, Design-Dateien und erfundene Demo-Daten.
- Keine echten Kunden-, Händler-, Vertrags-, Zahlungs- oder Zugangsdaten in GitHub.
- Keine API-Keys, Passwörter oder Datenbank-Zugangsdaten im Repository.
- Geheimnisse werden später ausschließlich über sichere Environment-Variablen / Secrets verwaltet.

## Produktives Hosting

Bevorzugt wird ein Hosting-/Datenbankstandort in der EU.

Für die produktive Version sind mindestens vorgesehen:

- HTTPS für die gesamte Anwendung
- verschlüsselte Speicherung / verschlüsselte Datenträger
- sichere Authentifizierung
- getrennte Händlerkonten
- serverseitige Berechtigungsprüfung
- regelmäßige Backups
- Wiederherstellungsprozess
- Sicherheits- und Fehlerprotokollierung

## Datenmodell

Alle geschäftlichen Haupttabellen enthalten eine Händler-Zuordnung.

Beispiel:

- `dealers`
- `users`
- `vehicles` → `dealer_id`
- `customers` → `dealer_id`
- `documents` → `dealer_id`
- `contracts` → `dealer_id`
- `audit_log` → `dealer_id`

Ein eingeloggter Nutzer darf nur Datensätze seines Händlerkontos lesen, ändern oder löschen.

## Kundendaten: Datenminimierung

Fahrfolio soll nur Daten abfragen, die für den jeweiligen Ablauf benötigt werden.

Vorgesehen:

- Vorname / Nachname
- Anschrift
- E-Mail optional
- Telefon optional
- Geburtsdatum nur soweit für Händler/Vertrag benötigt

Keine Personalausweiskopie oder andere besonders sensible Dokumente standardmäßig anfordern, nur weil es technisch möglich wäre.

Pflichtfelder und optionale Felder werden in der Oberfläche klar unterschieden.

## Verträge & Dokumente

Verträge werden nach Abschluss als eigener Dokumentstand gespeichert. Nachträgliche Änderungen an Fahrzeug- oder Kundendaten dürfen einen bereits abgeschlossenen Vertrag nicht unbemerkt verändern.

Vorgesehen:

- eindeutige Vertrags-/Dokumentnummer
- Erstellungszeitpunkt
- zugehöriges Fahrzeug
- zugehöriger Käufer
- unveränderlicher Vertragsstand / PDF
- Zeitpunkt der Unterschriften
- nachvollziehbarer Dokumentstatus

## Löschen, Aufbewahren und Exportieren

Die produktive Version erhält Funktionen für:

- Kundendaten exportieren
- Daten berichtigen
- Kundendaten löschen bzw. anonymisieren
- gesetzlich aufzubewahrende Dokumente getrennt behandeln
- Händlerkonto vollständig exportieren
- Händlerkonto nach Vertragsende geordnet löschen

Es wird ein Lösch- und Aufbewahrungskonzept umgesetzt, bevor echte Händlerdaten produktiv gespeichert werden.

## Händler als Verantwortlicher / Fahrfolio als Dienstleister

Vor dem Produktivstart werden folgende Unterlagen vorbereitet und rechtlich geprüft:

- Datenschutzerklärung für Fahrfolio
- Auftragsverarbeitungsvertrag (AVV) für Händler
- technische und organisatorische Maßnahmen (TOMs)
- Unterauftragnehmer-/Dienstleisterliste
- Verzeichnis der relevanten Verarbeitungstätigkeiten
- Lösch- und Aufbewahrungskonzept
- Prozess für Datenschutz-/Sicherheitsvorfälle

## Bedienungsregel

Datenschutz darf die Anwendung nicht unnötig kompliziert machen.

Fahrfolio bleibt nach dem Prinzip:

> Wenn eine alltägliche Funktion erklärt werden muss, ist sie noch nicht einfach genug gebaut.

Sicherheit und Datenschutz werden möglichst im Hintergrund technisch erzwungen, statt den Händler mit unnötigen Dialogen und Fachbegriffen zu belasten.

## Vor Produktivstart zwingend

Der aktuelle Browser-Prototyp ist ausschließlich für Demo- und Testdaten gedacht.

Bevor echte Händler oder Käuferdaten verarbeitet werden, müssen mindestens umgesetzt sein:

1. produktives Backend und Datenbank
2. Login / Authentifizierung
3. technische Trennung der Händlerdaten
4. Berechtigungsregeln auf Datenbank-/Serverebene
5. Backup- und Wiederherstellungskonzept
6. Export-, Lösch- und Aufbewahrungsfunktionen
7. AVV, Datenschutzinformationen und TOMs
8. Prüfung der finalen Vertragsvorlagen und Datenschutzunterlagen durch fachkundige Stelle
