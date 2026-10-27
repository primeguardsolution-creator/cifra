import { COMPANY, Doc, contactLine, operator } from './company';

const o = operator('de');
const law = COMPANY.law.de.trim();

export const termsDe: Doc = {
  title: 'Nutzungsbedingungen',
  intro: [
    `Diese Nutzungsbedingungen („Bedingungen“) regeln die Nutzung von CIFRA, der Messaging-App mit einem persönlichen Bereich und einem Business-Bereich, die von ${o.full} („CIFRA“, „wir“) angeboten wird. Mit dem Erstellen eines Kontos oder der Nutzung von CIFRA akzeptierst du diese Bedingungen und unsere Datenschutzerklärung. Wenn du nicht einverstanden bist, nutze den Dienst nicht.`,
    'Wir haben versucht, sie verständlich zu schreiben. Die Überschriften dienen der Orientierung und schränken den Inhalt der einzelnen Abschnitte nicht ein.',
  ],
  sections: [
    { h: '1. Was CIFRA ist', p: [
      'CIFRA ist ein Messaging-Dienst für Privatpersonen und Unternehmen. Er umfasst Einzel- und Gruppenchats, Sprach- und Videoanrufe, Status (24-Stunden-Beiträge), Sprachnachrichten, Dateien, Inkognito-Chats, selbstlöschende Nachrichten, Umfragen, einen Hilfeassistenten und im Business-Bereich einen Kundenposteingang, Kalender, CRM, Katalog, Beiträge, Rundsendungen, Schnellantworten, ein öffentliches Profil und einen Aufgabenassistenten (Doer).',
      'Der Dienst wird als installierbare Web-App (PWA) bereitgestellt und kann auch als iOS- und Android-App angeboten werden. Einige Funktionen können je nach Gerät, Browser oder Version abweichen.',
    ] },
    { h: '2. Begriffe', p: [
      '• „Dienst“: CIFRA mit allen Funktionen, Websites, Apps und zugehörigen Mitteilungen.',
      '• „Nutzer“ oder „du“: die Person, die CIFRA verwendet.',
      '• „Inhalte“: alles, was du sendest, hochlädst, veröffentlichst oder teilst (Nachrichten, Fotos, Videos, Audio, Dateien, Status, Beiträge, Umfragen, Namen, Profilbilder, Kataloge, Notizen usw.).',
      '• „Business“: ein Konto eines Unternehmens, Selbstständigen oder einer Organisation im Business-Bereich.',
      '• „Kunde“: eine Person, die mit einem Business kommuniziert oder in dessen CRM geführt wird.',
    ] },
    { h: '3. Wer CIFRA nutzen darf', p: [
      'Du musst mindestens 16 Jahre alt sein (oder das in deinem Land geltende Mindestalter für die Einwilligung in die Datenverarbeitung, falls höher) und die Fähigkeit haben, diese Bedingungen anzunehmen. Wenn du CIFRA im Namen eines Unternehmens nutzt, erklärst du, dass du befugt bist, es zu verpflichten.',
      'Du darfst CIFRA nicht nutzen, wenn wir dich gesperrt haben, wenn das Gesetz es dir verbietet oder wenn du den Dienst aus einem Land nutzen würdest, das Sanktionen unterliegt, die dies untersagen.',
      'Wenn du Elternteil oder Erziehungsberechtigter bist und glaubst, dass ein Kind unter dem Mindestalter CIFRA nutzt, kontaktiere uns über die im Abschnitt Kontakt genannten Kanäle; wir löschen das Konto.',
    ] },
    { h: '4. Dein Konto', p: [
      'Du registrierst dich mit deiner Telefonnummer, deinem Namen und einem Passwort. Du musst uns wahrheitsgemäße Angaben machen und sie aktuell halten. Pro Telefonnummer ist nur ein Konto erlaubt, und du musst die Person sein, die sie kontrolliert.',
      'Du bist für die Aktivitäten deines Kontos verantwortlich und dafür, dein Passwort und deinen Wiederherstellungscode geheim zu halten. Informiere uns unverzüglich, wenn du glaubst, dass jemand ohne Erlaubnis auf dein Konto zugreift.',
      'Du kannst unter Einstellungen → Kontosicherheit eine bestätigte Wiederherstellungs-E-Mail hinzufügen und einen einmaligen Wiederherstellungscode erstellen. Wenn du dein Passwort vergisst und weder das eine noch das andere hast, können wir dein Konto nicht wiederherstellen, weil wir nicht anders überprüfen können, dass du es bist.',
      'Du kannst dich jederzeit abmelden und dein Konto unter Einstellungen → Mein Konto löschen entfernen (siehe Abschnitt 20).',
    ] },
    { h: '5. Zulässige Nutzung', p: [
      'Damit CIFRA ein sicherer Ort bleibt, verpflichtest du dich, Folgendes weder zu tun noch zuzulassen:',
      '• Spam, unerwünschte Werbung, Kettennachrichten, Massennachrichten oder kommerzielle Kommunikation ohne die gesetzlich erforderliche Einwilligung zu versenden.',
      '• Andere zu belästigen, zu bedrohen, einzuschüchtern, zu verleumden, zu demütigen oder zu diskriminieren oder zu Hass oder Gewalt aufgrund von Herkunft, Rasse, Religion, Geschlecht, sexueller Orientierung, Behinderung, Alter oder anderen geschützten Merkmalen aufzustacheln.',
      '• Nicht einvernehmliche sexuell explizite Inhalte, Inhalte, die Minderjährige sexualisieren (die wir den Behörden melden), oder Inhalte mit extremer Gewalt zu veröffentlichen oder zu senden.',
      '• Dich als andere Person, Firma oder Einrichtung auszugeben oder Identitätsdaten anderer zu verwenden.',
      '• Betrug, Täuschung, Identitätsmissbrauch, Phishing, Geldwäsche oder den Verkauf illegaler Waren oder Dienstleistungen zu begehen oder zu fördern.',
      '• Rechte Dritter an geistigem Eigentum, Geschäftsgeheimnisse, Privatsphäre oder das Recht am eigenen Bild zu verletzen.',
      '• Schadsoftware oder schädlichen Code hochzuladen oder zu versuchen, ohne Erlaubnis auf Konten, Systeme oder Daten zuzugreifen; Schwachstellen ohne unsere schriftliche Genehmigung zu prüfen, zu scannen oder zu testen.',
      '• Den Dienst zu stören: ihn zu überlasten, die Kontoerstellung oder den Nachrichtenversand zu automatisieren, Daten anderer Nutzer massenhaft zu sammeln (Scraping), den Code zu dekompilieren, soweit das Gesetz es nicht erlaubt, oder technische Grenzen, Sperren oder Sicherheitsmaßnahmen zu umgehen.',
      '• CIFRA zu nutzen, um personenbezogene Daten anderer unter Verstoß gegen geltendes Recht zu erheben oder zu verarbeiten.',
      '• Den Dienst für Zwecke zu nutzen, die das Gesetz verbietet oder die die Sicherheit von Personen gefährden.',
      'Wir können angemessene Grenzen anwenden (zum Beispiel Nachrichten pro Stunde oder Rundsendungen pro Tag), um den Dienst und seine Nutzer zu schützen.',
    ] },
    { h: '6. Deine Inhalte und die Erlaubnis, die du uns erteilst', p: [
      'Deine Inhalte gehören dir. Wir beanspruchen kein Eigentum daran. Du bist dafür verantwortlich und sicherst zu, dass du die nötigen Rechte hast, sie zu senden, und dass sie weder gegen Gesetze noch gegen Rechte Dritter verstoßen.',
      'Damit wir den Dienst erbringen können, räumst du uns eine weltweite, nicht ausschließliche, unentgeltliche, beschränkte Lizenz ein, deine Inhalte zu hosten, zu speichern, zu übertragen, technisch zu verarbeiten (zum Beispiel Bilder zu verkleinern, Videos zu komprimieren oder Linkvorschauen zu erzeugen), den von dir gewählten Empfängern anzuzeigen und zu vervielfältigen, ausschließlich um CIFRA zu betreiben, zu warten und dessen Sicherheit und Funktion zu verbessern. Die Lizenz endet, wenn der Inhalt gelöscht wird, mit Ausnahme von Sicherungskopien und der in der Datenschutzerklärung beschriebenen Fälle.',
      'Wir verwenden den Inhalt deiner Nachrichten nicht für Werbung und verkaufen ihn nicht an Dritte.',
      'Status, öffentliche Beiträge eines Business, Profilfotos, Titelbilder und das öffentliche Profil eines Business können je nach deinen Sichtbarkeitseinstellungen für andere sichtbar sein. Überlege, bevor du etwas veröffentlichst.',
    ] },
    { h: '7. Nachrichten, Anrufe und besondere Funktionen', p: [
      'Nachrichten werden an die Geräte der Empfänger zugestellt. Sobald eine Nachricht zugestellt ist, kann eine Person sie kopieren, weiterleiten oder einen Screenshot machen; wir können das weder verhindern noch kontrollieren.',
      'Selbstlöschende Nachrichten: Wenn du in einem Chat einen Timer einstellst, werden neue Nachrichten nach Ablauf ausgeblendet und aus unseren Systemen gelöscht. Wir können nicht garantieren, dass sie von fremden Geräten, aus von anderen angefertigten Kopien (Screenshots, Weiterleitungen, Gerätesicherungen) oder aus bereits heruntergeladenen Anhängen gelöscht werden.',
      'Inkognito-Chats: Sie werden nach einer Zeit der Inaktivität oder auf Wunsch beider Personen automatisch gelöscht. Es gelten dieselben Einschränkungen wie bei selbstlöschenden Nachrichten.',
      'Gelöschte Nachrichten: Das Löschen einer Nachricht entfernt sie für die Teilnehmer aus dem Chat, sie kann aber aus technischen oder Sicherheitsgründen kurz aufbewahrt werden.',
      'Anrufe: Sprach- und Videoanrufe nutzen Gerät-zu-Gerät-Kommunikationstechnik (WebRTC) und bei Bedarf Relay-Server. Du kannst jeden blockieren, der dich ohne deine Zustimmung anruft. Nutze CIFRA nicht für Notrufe: Es ersetzt keinen Telefondienst und garantiert nicht die Ortung des Anrufers.',
      'Umfragen: Antworten sind privat (es werden die Zahlen angezeigt, nicht wer wofür gestimmt hat). Wer eine Umfrage erstellt, ist für deren Inhalt verantwortlich.',
      'Status: Persönliche Status dauern 24 Stunden und Business-Beiträge 7 Tage; danach werden sie nicht mehr angezeigt und gelöscht.',
    ] },
    { h: '8. Business-Bereich', p: [
      'Wenn du ein Business erstellst, bist du dessen Inhaber innerhalb von CIFRA. Du bist verantwortlich für die Richtigkeit seiner Angaben (Name, Beschreibung, Öffnungszeiten, Preise und Katalog), für Beiträge, automatische Antworten, die Nachrichten deines Teams und die Einhaltung des für deine Tätigkeit geltenden Rechts: Verbraucher-, Werbe-, E-Commerce-, Steuer-, Datenschutzrecht usw.',
      'Team und Rollen: Du kannst andere Personen als Administrator, Supervisor, Agent oder nur lesend einladen. Wer Zugriff hat, kann je nach Rolle die Gespräche und Daten des Business sehen. Du bist verantwortlich für das, was Personen tun, denen du Zugriff gibst, und dafür, ihnen den Zugriff zu entziehen, wenn es angebracht ist. Interne Notizen sind nur für das Team sichtbar.',
      'Kunden und personenbezogene Daten: Für die Daten deiner Kunden (Gespräche, CRM-Einträge, Termine, Tags, Notizen) bist du in der Regel der Verantwortliche, und CIFRA handelt als Auftragsverarbeiter, der sie nach deinen Weisungen hostet und verarbeitet, wie in der Datenschutzerklärung erläutert. Du musst deine Kunden darüber informieren, wie du ihre Daten verarbeitest, eine Rechtsgrundlage dafür haben und ihre Rechte erfüllen.',
      'Ein Business darf CIFRA nicht nutzen, um Personen ohne Bezug zu ihm zu kontaktieren, und auch nicht, um die Daten seiner Kunden zu verkaufen, weiterzuverkaufen oder abzutreten.',
      'Wenn ein Business weitere Teammitglieder hat, kannst du dein Konto als Inhaber nicht löschen, bevor du es übergeben oder das Team entfernt hast.',
    ] },
    { h: '9. Rundsendungen und kommerzielle Kommunikation', p: [
      'Mit der Rundsendefunktion kann die Leitung eines Business eine Nachricht an Kunden mit CIFRA-Konto senden. Du darfst sie nur für Mitteilungen nutzen, die mit deiner Tätigkeit zusammenhängen und die Empfänger vernünftigerweise erwarten oder zu erhalten zugestimmt haben, unter Beachtung der Vorschriften zur kommerziellen Kommunikation (zum Beispiel E-Commerce- und Datenschutzrecht) der Orte, an denen sich die Empfänger befinden.',
      'Jede Rundsendung ist als solche gekennzeichnet und bietet einen Link, um sie nicht mehr zu erhalten. Wir respektieren diese Abmeldung, und du musst sie auch über jeden anderen Kanal respektieren. Wir wenden Grenzen an (derzeit drei Rundsendungen pro Business alle 24 Stunden) und können sie bei Missbrauch senken oder die Funktion aussetzen.',
    ] },
    { h: '10. Links, Vorschauen und Inhalte Dritter', p: [
      'CIFRA kann Linkvorschauen anzeigen (Titel, Beschreibung und Bild einer Seite). Um sie zu erstellen, rufen unsere Server die verlinkte Seite mit Sicherheitsbeschränkungen ab. Wir kontrollieren Websites Dritter nicht und sind weder für deren Inhalte noch für deren Datenschutzpraxis verantwortlich; wenn du einem Link folgst, geschieht das auf eigenes Risiko.',
      'Profile, Kataloge und Beiträge von Businesses sind Inhalte dieser Businesses, nicht unsere.',
    ] },
    { h: '11. Assistenten mit künstlicher Intelligenz', p: [
      'CIFRA enthält einen Hilfeassistenten („Maestro CIFRA“) und für Businesses einen Assistenten, der Aufgaben vorschlägt und ausführt (Doer). Sie können auf KI-Modelle Dritter zurückgreifen. Wenn du den Assistenten nutzt, werden der Text deiner Frage und der nötige Mindestkontext (zum Beispiel die Liste der Namen deiner Kunden, damit Doer versteht, wen du meinst) an den Modellanbieter gesendet, um die Antwort zu erzeugen.',
      'Antworten können falsch, unvollständig oder veraltet sein und stellen keine professionelle Beratung dar (rechtlich, steuerlich, medizinisch, finanziell oder sonstige). Doer zeigt dir die vorgeschlagenen Aktionen und führt sie erst aus, wenn du bestätigst; prüfe immer, was du freigibst. Gib keine besonders sensiblen Daten in Anfragen an den Assistenten ein.',
    ] },
    { h: '12. Benachrichtigungen', p: [
      'Wenn du sie aktivierst, senden wir dir Systembenachrichtigungen (zum Beispiel zu neuen Nachrichten oder Terminerinnerungen) über die Benachrichtigungsdienste von Apple, Google, Mozilla oder anderen, je nach deinem Gerät. Du kannst sie für deinen persönlichen Bereich und für Business getrennt in den Einstellungen und in den Geräteeinstellungen ein- oder ausschalten. Aus Datenschutzgründen zeigen Benachrichtigungen von Inkognito-Chats den Inhalt nicht an.',
    ] },
    { h: '13. Moderation, Meldungen und Blockierungen', p: [
      'Du kannst andere blockieren und Kontakte, Nachrichten, Businesses oder Inhalte melden, die gegen diese Bedingungen verstoßen. Wir prüfen Meldungen und können Inhalte entfernen, Funktionen einschränken sowie Konten vorübergehend oder dauerhaft sperren oder schließen, wenn du gegen diese Bedingungen verstößt, wenn das Gesetz oder die Sicherheit anderer es verlangt oder wenn eine Behörde es von uns verlangt.',
      'Soweit angemessen und rechtlich zulässig, teilen wir dir den Grund der Maßnahme mit und wie du antworten oder eine Überprüfung verlangen kannst, indem du uns über die Kontaktkanäle schreibst. Chats sind privat: Wir überwachen den Inhalt von Gesprächen nicht allgemein, können aber uns gemeldete Inhalte prüfen und darauf reagieren.',
      'Wenn wir in gutem Glauben annehmen, dass eine Gefahr für Leben oder körperliche Unversehrtheit einer Person oder eine Straftat vorliegt, können wir die erforderlichen Informationen an die zuständigen Behörden weitergeben.',
    ] },
    { h: '14. Geistiges Eigentum und Verletzungsmeldungen', p: [
      'CIFRA, sein Name, Logos, Design, Software und eigene Inhalte sind durch Rechte des geistigen und gewerblichen Eigentums geschützt und gehören ihren Inhabern. Wir räumen dir eine persönliche, beschränkte, widerrufliche, nicht ausschließliche, nicht übertragbare Lizenz ein, den Dienst gemäß diesen Bedingungen zu nutzen. Du darfst den Dienst nicht kopieren, verändern, verbreiten, verkaufen oder abgeleitete Werke davon erstellen, außer soweit das Gesetz oder eine auf bestimmte Komponenten anwendbare Open-Source-Lizenz es erlaubt.',
      `Wenn du glaubst, dass ein Inhalt auf CIFRA deine Rechte verletzt (zum Beispiel Urheber- oder Markenrechte), teile es uns mit deinen Kontaktdaten, der Bezeichnung des Inhalts, der Beschreibung deines Rechts und einer Erklärung nach bestem Wissen über ${contactLine('de')} mit. Wir entfernen oder sperren offensichtlich rechtsverletzende Inhalte und können die Konten wiederholter Verletzer schließen.`,
    ] },
    { h: '15. Dienste und Anbieter Dritter', p: [
      'Um CIFRA bereitzustellen, stützen wir uns auf Anbieter von Infrastruktur, Datenbank und Authentifizierung, Hosting, E-Mail, Benachrichtigungen, Fehlerüberwachung und künstlicher Intelligenz. Sie werden in der Datenschutzerklärung beschrieben. Ihre Nutzung kann zusätzlich deren eigenen Bedingungen unterliegen (zum Beispiel denen deines Browsers, Betriebssystems oder App-Stores). Apple, Google und andere sind nicht Partei dieser Bedingungen und nicht für den Dienst verantwortlich.',
    ] },
    { h: '16. Verfügbarkeit, Testversion und Änderungen am Dienst', p: [
      'Wir arbeiten daran, dass CIFRA durchgehend funktioniert, garantieren aber nicht, dass der Dienst immer verfügbar oder fehlerfrei ist. Es kann zu Unterbrechungen durch Wartung, Ausfälle Dritter oder Ursachen außerhalb unserer Kontrolle kommen.',
      'Solange der Dienst als Testversion („Beta“) gekennzeichnet ist, kann es Änderungen, Fehler, Einschränkungen oder das Löschen von Testdaten geben, und du solltest ihm keine Informationen anvertrauen, die du nicht verlieren kannst. Sichere, was wichtig ist.',
      'Wir können Funktionen hinzufügen, ändern oder entfernen, Nutzungsgrenzen anwenden oder künftig kostenpflichtige Tarife anbieten. Wenn wir Preise einführen, sagen wir es dir, bevor wir etwas berechnen, und berechnen nichts ohne deine ausdrückliche Zustimmung.',
    ] },
    { h: '17. Zahlungen', p: [
      'Heute verlangt CIFRA kein Entgelt für den Dienst und wickelt keine Zahlungen zwischen Personen oder mit Businesses ab. Sollten künftig Zahlungen, Abonnements oder Gebühren eingeführt werden, gelten dafür zusätzliche Bedingungen, die wir dir zeigen, bevor du einer Abbuchung zustimmst. Käufe und Zahlungen, die ein Business außerhalb von CIFRA mit seinen Kunden vereinbart, liegen allein in der Verantwortung beider Parteien.',
    ] },
    { h: '18. Gewährleistung und Haftungsbeschränkung', p: [
      'Der Dienst wird „wie besehen“ und „wie verfügbar“ bereitgestellt. Soweit gesetzlich zulässig, übernehmen wir keine Gewähr dafür, dass er deine konkreten Anforderungen erfüllt, ohne Unterbrechung oder Fehler funktioniert oder dass Inhalte anderer Personen oder Antworten der Assistenten richtig sind.',
      'Soweit gesetzlich zulässig, haften wir nicht für mittelbare Schäden, entgangenen Gewinn, den Verlust von Daten, Kunden oder Gelegenheiten oder für Schäden aus Inhalten oder dem Verhalten anderer Nutzer oder Dritter, aus unbefugtem Zugriff, der nicht auf unserer Fahrlässigkeit beruht, oder aus höherer Gewalt.',
      'Unsere Gesamthaftung dir gegenüber für Ansprüche im Zusammenhang mit dem Dienst ist, soweit gesetzlich zulässig, auf das beschränkt, was du in den 12 Monaten vor dem Ereignis an CIFRA gezahlt hast, oder, falls du nichts gezahlt hast, auf 100 Euro.',
      'Nichts in diesen Bedingungen schließt eine Haftung aus oder beschränkt sie, die gesetzlich nicht ausgeschlossen oder beschränkt werden kann, einschließlich der Haftung für Vorsatz oder grobe Fahrlässigkeit, für Schäden an Leben, Körper oder Gesundheit sowie unverzichtbare Verbraucherrechte.',
    ] },
    { h: '19. Freistellung', p: [
      'Soweit gesetzlich zulässig, verpflichtest du dich, uns von Ansprüchen, Schäden und angemessenen Kosten (einschließlich Anwaltskosten) Dritter freizustellen, die aus deinen Inhalten, deinem Verstoß gegen diese Bedingungen oder gegen das Gesetz oder deiner Nutzung des Dienstes für deine Tätigkeit entstehen. Wenn du Verbraucher bist, gilt diese Klausel nur in den Grenzen, die das Verbraucherschutzrecht erlaubt.',
    ] },
    { h: '20. Beendigung und Kontolöschung', p: [
      'Du kannst CIFRA jederzeit nicht mehr nutzen und dein Konto unter Einstellungen → Mein Konto löschen löschen. Wir fragen nach deinem Passwort und einer Bestätigung. Beim Löschen werden dein Profil, deine Nachrichten, Status, Kontakte, Benachrichtigungsgeräte und die von dir hochgeladenen Dateien entfernt sowie die Businesses, deren einziges Mitglied du bist. Gemeinsame Gespräche bleiben für die anderen Personen ohne deine Nachrichten bestehen. Das kann nicht rückgängig gemacht werden. Wenn du Inhaber eines Business mit Team bist, musst du es zuvor übergeben oder das Team entfernen.',
      'Wir können dein Konto sperren oder schließen oder Funktionen einschränken, wenn du gegen diese Bedingungen verstößt, wenn eine Gefahr für andere Personen oder den Dienst besteht, wenn das Gesetz es verlangt oder wenn du es lange nicht genutzt hast, und informieren dich, wenn es angemessen ist. Abschnitte, die ihrer Natur nach fortgelten sollen (zum Beispiel geistiges Eigentum, Haftungsgrenzen und anwendbares Recht), bleiben nach der Beendigung in Kraft.',
    ] },
    { h: '21. Änderungen dieser Bedingungen', p: [
      'Wir können diese Bedingungen aktualisieren, um Änderungen des Dienstes, der Rechtslage oder unserer Praxis abzubilden. Ist die Änderung wesentlich, informieren wir dich in der App oder auf andere angemessene Weise, bevor sie in Kraft tritt. Wenn du CIFRA nach diesem Datum weiter nutzt, verstehen wir das als Zustimmung zur neuen Fassung; wenn du nicht einverstanden bist, kannst du den Dienst nicht mehr nutzen und dein Konto löschen.',
    ] },
    { h: '22. Anwendbares Recht und Streitbeilegung', p: [
      law
        ? `Diese Bedingungen unterliegen dem Recht von ${law}, unbeschadet zwingender Verbraucherschutzvorschriften des Landes, in dem du wohnst, die weiter gelten, wenn sie für dich günstiger sind. Zuständig sind die nach dem anwendbaren Recht zuständigen Gerichte; als Verbraucher kannst du dich auch an die Gerichte deines Wohnsitzlandes wenden.`
        : 'Diese Bedingungen unterliegen dem Recht des Landes, in dem der Anbieter des Dienstes niedergelassen ist, unbeschadet zwingender Verbraucherschutzvorschriften des Landes, in dem du wohnst, die weiter gelten, wenn sie für dich günstiger sind. Als Verbraucher kannst du dich auch an die Gerichte deines Wohnsitzlandes wenden.',
      'Bevor du ein Gericht anrufst, bitten wir dich, uns zu schreiben, um den Streit in gutem Glauben zu lösen. Wenn du in der Europäischen Union wohnst, kannst du außerdem die Online-Streitbeilegung und die Verbraucherbehörden deines Landes nutzen.',
    ] },
    { h: '23. Allgemeine Bestimmungen', p: [
      'Ist ein Teil dieser Bedingungen ungültig oder nicht durchsetzbar, bleibt der Rest wirksam. Dass wir ein Recht nicht ausüben, bedeutet nicht, dass wir darauf verzichten. Du darfst deine Rechte oder Pflichten nicht ohne unsere Zustimmung abtreten; wir dürfen unsere an eine Einheit abtreten, die den Dienst fortführt, und informieren dich. Diese Bedingungen und die Datenschutzerklärung sind die vollständige Vereinbarung zwischen dir und uns über den Dienst. Wir können sie in mehreren Sprachen anbieten; bei Abweichungen gilt die spanische Fassung, sofern das Gesetz nichts anderes verlangt.',
    ] },
    { h: '24. Kontakt', p: [
      `Anbieter des Dienstes: ${o.full}.`,
      `Für Fragen, Meldungen, rechtliche oder Datenschutzanfragen schreibe uns über ${contactLine('de')}.`,
    ] },
  ],
};
