import { Doc, contactLine, operator } from './company';

const o = operator('de');

export const privacyDe: Doc = {
  title: 'Datenschutzerklärung',
  intro: [
    `Diese Datenschutzerklärung erläutert, welche personenbezogenen Daten ${o.full} („CIFRA“, „wir“) verarbeitet, wenn du CIFRA nutzt, wofür wir sie verwenden, an wen wir sie weitergeben, wie lange wir sie speichern und welche Rechte du hast. Sie gilt für die installierbare Web-App (PWA), die mobilen Apps und alle Funktionen des Dienstes, im persönlichen Bereich und im Business-Bereich.`,
    'In wenigen Zeilen: Wir nutzen deine Telefonnummer und deinen Namen, um dein Konto zu erstellen; wir speichern deine Nachrichten und Dateien, um sie zuzustellen und dir anzuzeigen; wir verkaufen deine Daten nicht und nutzen sie nicht für Werbung; wir lesen deine Chats nicht, außer was uns gemeldet wird oder das Gesetz verlangt; du kannst dein Konto und alles Deine direkt in der App löschen.',
  ],
  sections: [
    { h: '1. Wer verantwortlich ist', p: [
      `Verantwortlich für die Daten deines Kontos und deine Nutzung des Dienstes ist ${o.full}.`,
      `Bei allen Datenschutzfragen kannst du uns über ${contactLine('de')} erreichen.`,
      'Im Business-Bereich gibt es zwei verschiedene Rollen: Für die Daten deines Nutzerkontos ist CIFRA verantwortlich; für die Kundendaten, die ein Business verwaltet (Gespräche, CRM-Einträge, Termine, Tags, Notizen), ist das Business verantwortlich, und CIFRA handelt als Auftragsverarbeiter, der sie nach den Weisungen des Business hostet und verarbeitet (siehe Abschnitt 12).',
    ] },
    { h: '2. Welche Daten wir verarbeiten', p: [
      'Konto- und Profildaten:',
      '• Telefonnummer (deine Kennung), Anzeigename, optionaler Benutzername (@), optionale Biografie, optionales Profilfoto und Titelbild, Sprache, Zeitzone und Datenschutzeinstellungen (zum Beispiel ob man dich über die Nummer finden kann oder ob dein Telefon verborgen ist).',
      '• Dein Passwort, das wir nie im Klartext speichern: nur ein verschlüsselter Hash, der vom Authentifizierungsanbieter verwaltet wird.',
      '• Wiederherstellungs-E-Mail und deren Bestätigungsstatus sowie der Wiederherstellungscode, von dem wir nur einen verschlüsselten Fingerabdruck (Hash) speichern, nie den Code selbst.',
      'Inhalte, die du erstellst:',
      '• Textnachrichten, Fotos, Videos, Sprachnachrichten, Dokumente und andere Dateien, Antworten, Reaktionen, markierte Nachrichten, geplante Nachrichten, Umfragen und Stimmen, Status und Beiträge sowie Anrufe (deren Bestehen, Dauer und Status; den Inhalt zeichnen wir nicht auf).',
      '• Im Business: Unternehmensdaten (Name, Beschreibung, Kontaktdaten, Öffnungszeiten, Logo, Katalog, Beiträge), Team und Rollen, Kundeneinträge (Name, Telefon, E-Mail, Phase, Tags, Notizen, Wert), Termine, Aufgaben, Schnellantworten, Begrüßungen und automatische Nachrichten sowie gesendete Rundsendungen.',
      'Nutzungs- und technische Daten:',
      '• Zustell- und Lesestatus von Nachrichten, Sendezeit, wer an welchem Gespräch teilnimmt, von dir hinzugefügte Kontakte und blockierte Personen, von dir gesendete oder empfangene Meldungen.',
      '• Geräte- und Verbindungsdaten: Browser- und Systemtyp, App-Version, IP-Adresse, technische Kennungen und Fehlerprotokolle, die für Sicherheit und Betrieb nötig sind.',
      '• Wenn du Benachrichtigungen aktivierst: eine Abonnementkennung (Endpoint und Schlüssel) deines Geräts, die wir nur nutzen, um dir Hinweise zu senden, sowie deine Benachrichtigungseinstellungen je Bereich.',
      'Daten Dritter, die du uns gibst:',
      '• Wenn du eine Person als Kontakt oder Kunden hinzufügst oder jemandem schreibst, verarbeiten wir die Daten, die du über sie eingibst (Name, Telefon, E-Mail). Stelle sicher, dass du dazu berechtigt bist. Das Adressbuch deines Telefons laden wir nicht auf unsere Server hoch.',
      'Wir fragen nicht nach besonders sensiblen Daten (Gesundheit, Überzeugungen, sexuelle Orientierung, biometrische Daten usw.). Wenn du sie in deine Nachrichten oder das CRM aufnimmst, behandeln wir sie wie jeden anderen Inhalt, um den Dienst zu erbringen; sei vorsichtig mit dem, was du teilst.',
    ] },
    { h: '3. Wofür wir deine Daten verwenden und auf welcher Rechtsgrundlage', p: [
      '• Bereitstellung des Dienstes (Vertrag): Erstellen und Verwalten deines Kontos, Zustellen von Nachrichten und Anrufen, Anzeigen von Status und Beiträgen, Synchronisieren zwischen deinen Geräten, Senden der von dir gewünschten Benachrichtigungen und Erinnerungen und Ermöglichen der Business-Funktionen.',
      '• Sicherheit und Missbrauchsprävention (berechtigtes Interesse und rechtliche Verpflichtung): Überprüfen deiner Identität bei der Kontowiederherstellung, Begrenzen von Sendungen, Erkennen von Spam, Betrug und schädlichem Verhalten, Prüfen von Meldungen, Sperren von Konten und Schutz von Personen und Dienst.',
      '• Betrieb und Verbesserung des Dienstes (berechtigtes Interesse): Fehler diagnostizieren, Leistung messen und Störungen beheben mittels Protokollen und Fehlerüberwachung, ohne Werbeprofile zu erstellen.',
      '• Dienstmitteilungen (Vertrag und berechtigtes Interesse): Senden von Bestätigungscodes, Sicherheitshinweisen und wichtigen Änderungen. Wir senden dir keine Werbung.',
      '• Hilfe- und Aufgabenassistenten (Vertrag und gegebenenfalls Einwilligung): Verarbeiten deiner Anfragen, um dir zu antworten oder Aktionen vorzuschlagen.',
      '• Erfüllung rechtlicher Verpflichtungen und Beantwortung von Anfragen von Behörden (rechtliche Verpflichtung) sowie Verteidigung unserer Rechte (berechtigtes Interesse).',
      '• Mit deiner Einwilligung, wenn das Gesetz sie verlangt (zum Beispiel für Gerätebenachrichtigungen). Du kannst sie jederzeit widerrufen, ohne dass das bereits Geschehene berührt wird.',
      'Wir verkaufen deine personenbezogenen Daten nicht, geben sie nicht für zielgerichtete Werbung weiter und nutzen den Inhalt deiner Nachrichten nicht, um eigene KI-Modelle zu trainieren.',
    ] },
    { h: '4. Wer deine Informationen innerhalb von CIFRA sieht', p: [
      'Deine Nachrichten sehen die Personen im Gespräch. In einem Chat mit einem Business können sie außer dem Kunden auch die Teammitglieder des Business mit Zugriff gemäß ihrer Rolle sehen.',
      'Dein Name, Profilfoto, @Benutzername, deine Biografie und dein Titelbild werden Personen angezeigt, mit denen du interagierst, und je nach deinen Einstellungen denen, die nach dir suchen. Deine Telefonnummer wird nur denen angezeigt, die ein Gespräch mit dir teilen, außer du aktivierst „Telefon verbergen“. Du kannst deaktivieren, dass man dich über die Nummer findet.',
      'Status sehen deine Kontakte; Beiträge eines Business sind für dessen Kunden sichtbar und, wenn das Business sie öffentlich macht, für jeden, der sein öffentliches Profil öffnet.',
      'Umfragen zeigen den Teilnehmern des Chats die Zahlen, aber nicht, wer für welche Option gestimmt hat. Wer sie erstellt, kann sie schließen.',
    ] },
    { h: '5. Sicherheit', p: [
      'Wir schützen Daten mit angemessenen technischen und organisatorischen Maßnahmen: verschlüsselte Verbindungen (HTTPS/TLS) zwischen deinem Gerät und unseren Servern, Verschlüsselung von Datenbank und Speicher im Ruhezustand durch unsere Anbieter, gehashte Passwörter, zeilenbasierte Zugriffsrichtlinien in der Datenbank (jede Person kann nur auf das zugreifen, was ihr zusteht), Ratenbegrenzungen, Protokolle über Moderationsentscheidungen und eingeschränkter Zugriff von Mitarbeitenden.',
      'Wichtig: Heute bietet CIFRA keine Ende-zu-Ende-Verschlüsselung. Das bedeutet: Obwohl die Daten verschlüsselt übertragen und gespeichert werden, kann der Dienst technisch auf Inhalte zugreifen, um zu funktionieren (zum Beispiel um eine Nachricht zuzustellen, eine Vorschau zu erstellen oder eine Meldung zu bearbeiten). Kein System ist völlig unverwundbar; wenn wir eine Sicherheitsverletzung feststellen, die deine Daten betrifft, informieren wir dich und benachrichtigen die Behörde, wenn das Gesetz es verlangt.',
    ] },
    { h: '6. An wen wir Daten weitergeben', p: [
      'Wir geben personenbezogene Daten nur in folgenden Fällen weiter:',
      '• An andere Personen im Dienst, wie in Abschnitt 4 erläutert.',
      '• An Anbieter, die Daten in unserem Auftrag verarbeiten (Auftragsverarbeiter), vertraglich gebunden und nur, um uns den Dienst zu ermöglichen: Anbieter für Datenbank, Authentifizierung und Dateispeicher (Supabase); Hosting und Server-Funktionen (Netlify); Versand von Bestätigungs- und Wiederherstellungs-E-Mails (Brevo); Fehlerüberwachung (Sentry); künstliche Intelligenz für die Assistenten (Anthropic); und die Benachrichtigungsdienste deines Geräts oder Browsers (Apple, Google, Mozilla oder andere).',
      '• An Behörden, Gerichte oder Dritte, wenn das Gesetz es verlangt, um die Sicherheit von Personen zu schützen, Missbrauch oder Betrug zu untersuchen oder Rechte auszuüben oder zu verteidigen.',
      '• Bei gesellschaftsrechtlichen Vorgängen (Fusion, Übernahme oder Verkauf von Vermögenswerten), mit gleichwertigen Schutzmaßnahmen und mit Information an dich, wenn sich der Verantwortliche für deine Daten ändert.',
      'Anbieter können sich im Lauf der Zeit ändern; wir halten diese Liste aktuell und informieren dich über wichtige Änderungen.',
    ] },
    { h: '7. Internationale Übermittlungen', p: [
      'Einige unserer Anbieter können Daten außerhalb des Europäischen Wirtschaftsraums verarbeiten, einschließlich der Vereinigten Staaten. Dann stellen wir sicher, dass angemessene Garantien bestehen, etwa Angemessenheitsbeschlüsse der Europäischen Kommission, Standardvertragsklauseln und gegebenenfalls ergänzende Maßnahmen. Du kannst bei uns weitere Informationen dazu anfordern.',
    ] },
    { h: '8. Wie lange wir Daten speichern', p: [
      '• Konto und Profil: solange du das Konto hast. Beim Löschen entfernen wir dein Profil, deine Nachrichten, Status, Kontakte, Dateien und Benachrichtigungsgeräte sowie die Businesses, deren einziges Mitglied du bist. Daten können für einen begrenzten Zeitraum (höchstens 90 Tage) in verschlüsselten Sicherungen verbleiben, bis sie überschrieben werden.',
      '• Nachrichten und Dateien: bis du oder die andere Person sie löscht, bis sie ablaufen, wenn ein Timer gesetzt ist (selbstlöschende Nachrichten, Inkognito-Chats), oder bis das Konto gelöscht wird. Eine gelöschte Nachricht wird ausgeblendet und aus unseren Systemen gelöscht; sie kann aus technischen oder Sicherheitsgründen kurz aufbewahrt werden.',
      '• Status und Beiträge: 24 Stunden (Status) oder 7 Tage (Business-Beiträge), danach werden sie gelöscht.',
      '• E-Mail-Bestätigungscodes: Sie verfallen nach 10 Minuten und werden bei Verwendung oder Überschreiten der erlaubten Versuche gelöscht.',
      '• Meldungen und Moderationsentscheidungen: solange es zum Schutz von Personen und Plattform nötig ist, und für die gesetzlich vorgeschriebenen Zeiträume.',
      '• Technische Protokolle und Fehlerprotokolle: für die zur Diagnose und Sicherheit unbedingt nötige Zeit (normalerweise Wochen oder wenige Monate).',
      '• Daten, die wir aufgrund einer rechtlichen Verpflichtung oder zur Verteidigung gegen Ansprüche aufbewahren müssen: für die geltenden gesetzlichen Fristen, gesperrt und nur für diese Zwecke zugänglich.',
    ] },
    { h: '9. Deine Rechte und wie du sie ausübst', p: [
      'Nach dem anwendbaren Recht (zum Beispiel der EU-Datenschutz-Grundverordnung und gleichwertigen Vorschriften) hast du das Recht auf:',
      '• Auskunft über deine Daten und eine Kopie.',
      '• Berichtigung unrichtiger Daten (du kannst dein Profil in der App bearbeiten).',
      '• Löschung deiner Daten („Recht auf Vergessenwerden“): Du kannst das selbst unter Einstellungen → Mein Konto löschen tun.',
      '• Einschränkung oder Widerspruch gegen die auf berechtigtem Interesse beruhende Verarbeitung.',
      '• Datenübertragbarkeit: die Daten, die du uns gegeben hast, in einem strukturierten, gängigen Format zu erhalten, soweit anwendbar.',
      '• Widerruf der Einwilligung jederzeit, wenn sie die Grundlage der Verarbeitung ist.',
      '• Nicht einer ausschließlich auf automatisierter Verarbeitung beruhenden Entscheidung mit erheblicher rechtlicher Wirkung unterworfen zu werden. Wir treffen solche Entscheidungen nicht; Kontosperrungen durchlaufen eine menschliche Prüfung.',
      `Um deine Rechte auszuüben, schreibe uns über ${contactLine('de')}. Wir können dich bitten, deine Identität zu bestätigen. Wir antworten innerhalb der gesetzlichen Frist (normalerweise einen Monat).`,
      'Wenn du glaubst, dass wir deine Daten fehlerhaft verarbeiten, hast du das Recht, Beschwerde bei der Datenschutzbehörde deines Landes oder des Ortes unserer Niederlassung einzulegen.',
      'Wenn sich deine Daten im CRM-Eintrag eines Business befinden, wende dich zuerst an das Business als Verantwortlichen; wir unterstützen es bei der Bearbeitung deiner Anfrage.',
    ] },
    { h: '10. Privatsphäre anderer und deine Kontrollmöglichkeiten', p: [
      'Du kannst jede Person blockieren (sie kann dir nicht schreiben oder dich anrufen), Kontakte oder Businesses melden, entscheiden, ob man dich über die Telefonnummer finden kann, deine Nummer verbergen, Chats stummschalten, selbstlöschende Nachrichten und Inkognito-Chats nutzen, die App mit einer PIN schützen und dich auf deinen Geräten abmelden.',
      'Respektiere die Privatsphäre anderer: Teile keine Screenshots, Daten oder Gespräche anderer ohne deren Erlaubnis und nutze Informationen aus CIFRA nicht gegen das Gesetz.',
    ] },
    { h: '11. Benachrichtigungen, lokaler Speicher und Cookies', p: [
      'CIFRA verwendet keine Werbe- oder Tracking-Cookies von Dritten. Es nutzt Browser- oder Gerätespeicher (zum Beispiel lokalen Speicher, lokale Datenbanken und den Service Worker der installierbaren App), um deine Sitzung zu halten, Einstellungen zu merken (Sprache, Design, gewähltes Symbol, gesehene Status), Entwürfe zu speichern und den Offline-Betrieb sowie Benachrichtigungen zu ermöglichen. Das ist für den Betrieb des Dienstes nötig und dient nicht dazu, dich über Websites hinweg zu verfolgen. Du kannst diese Daten in deinem Browser löschen, wodurch du allerdings abgemeldet wirst.',
      'Wenn du Benachrichtigungen aktivierst, speichern wir das Abonnement deines Geräts, um dir Hinweise zu senden; du kannst sie in den Einstellungen oder auf deinem Gerät deaktivieren, und wir löschen das Abonnement.',
    ] },
    { h: '12. Informationen für Businesses: unsere Rolle als Auftragsverarbeiter', p: [
      'Wenn ein Business CIFRA nutzt, um mit seinen Kunden zu kommunizieren und sein CRM, seinen Kalender, Katalog und seine Rundsendungen zu verwalten, verarbeitet es personenbezogene Daten seiner Kunden als Verantwortlicher. CIFRA verarbeitet sie als Auftragsverarbeiter, ausschließlich um den Dienst zu erbringen und nach den dokumentierten Weisungen des Business (den Funktionen, die das Business selbst nutzt), wendet die beschriebenen Sicherheitsmaßnahmen an, unterstützt es bei der Erfüllung der Rechte der Personen, informiert es über Sicherheitsverletzungen, nutzt sie nicht für eigene Zwecke und löscht oder gibt sie zurück, wenn der Dienst endet. Diese Bedingungen und diese Erklärung bilden den Auftragsverarbeitungsvertrag mit dem Business; bei Bedarf können wir eine zusätzliche Vereinbarung unterzeichnen.',
      'Das Business muss seine Kunden darüber informieren, wie es ihre Daten verarbeitet, eine Rechtsgrundlage dafür und für Rundsendungen und kommerzielle Kommunikation haben und keine Daten eingeben, die es nicht rechtmäßig verarbeiten darf.',
    ] },
    { h: '13. Assistenten mit künstlicher Intelligenz', p: [
      'Wenn du Maestro CIFRA oder Doer nutzt, senden wir deine Anfrage, den jüngsten Verlauf dieses Gesprächs mit dem Assistenten und den nötigen Mindestkontext (etwa die Liste der Namen deiner Kunden in Doer) an unseren Anbieter von Sprachmodellen, um die Antwort zu erzeugen. Den Rest deiner Gespräche senden wir nicht. Der Anbieter verarbeitet diese Daten als unser Auftragsverarbeiter und nutzt sie nach den für unsere Nutzung geltenden Bedingungen nicht zum Training seiner Modelle. Du kannst die Assistenten jederzeit nicht mehr nutzen; vermeide sensible Daten in deinen Anfragen.',
    ] },
    { h: '14. Kinder', p: [
      'CIFRA richtet sich nicht an Kinder unter 16 Jahren (oder das in deinem Land geltende Mindestalter für die digitale Einwilligung). Wir erheben wissentlich keine Daten von Kindern unter diesem Alter. Stellen wir fest, dass wir es getan haben, löschen wir das Konto und seine Daten. Wenn du Elternteil oder Erziehungsberechtigter bist und glaubst, dass ein Kind uns Daten gegeben hat, kontaktiere uns.',
    ] },
    { h: '15. Änderungen dieser Erklärung', p: [
      'Wir können diese Erklärung aktualisieren. Wir geben oben das Datum der aktuellen Fassung an und informieren dich bei wichtigen Änderungen in der App oder auf andere angemessene Weise, bevor sie gelten.',
    ] },
    { h: '16. Kontakt', p: [
      `Verantwortlicher: ${o.full}.`,
      `Für jede Datenschutzfrage oder -anfrage: ${contactLine('de')}.`,
    ] },
  ],
};
