/*
    web-calendar to display multiple ics-calendars in a browser
    source code available at https://github.com/cbz20/Web-Calendar/
    Copyright (C) 2025–2026 Claudius Zibrowius

    This program is free software: you can redistribute it and/or modify
    it under the terms of the GNU Affero General Public License as published
    by the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU Affero General Public License for more details.

    You should have received a copy of the GNU Affero General Public License
    along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

// Translations for the web calendar.
// This file must be loaded before weekmonthview.js / semesterview.js.
//
// The display language is taken from the lang attribute of the <html> tag
// (which TYPO3 sets from the site language), unless loadICS(...) is given
// an explicit language via its options parameter.
//
// To add a language: add a block to I18N and HELP, and a locale to LOCALES.

const CALENDAR_CONTACT = 'Termine-Mathe@ruhr-uni-bochum.de';

const LOCALES = {
    de: 'de-DE',
    en: 'en-GB'
};

const I18N = {
    de: {
        loading: '...Kalender wird geladen...',
        loadError: 'Fehler beim Laden der Kalender-Quelldateien.<br/>Bitte kontaktieren Sie <div class=\'calendar-modal-center-container\'>{contact}</div>',

        prevWeek: '< Vorherige Woche',
        nextWeek: 'Nächste Woche >',
        prevMonth: '< Vorheriger Monat',
        nextMonth: 'Nächster Monat >',
        prevSemester: '< Früheres Semester',
        nextSemester: 'Nächstes Semester >',
        tipLeftKey: 'linke Pfeiltaste drücken',
        tipRightKey: 'rechte Pfeiltaste drücken',
        tipCurrentWeek: 'springe zur aktuellen Woche',
        tipCurrentMonth: 'springe zum aktuellen Monat',
        tipCurrentSemester: 'springe zum aktuellen Semester',

        weekRange: 'Woche vom {from} bis {to}',
        winterSemester: 'Wintersemester {y1}&shy;/{y2}',
        summerSemester: 'Sommersemester {y}',

        colDate: 'Datum',
        colTime: 'Uhrzeit',
        colSummary: 'Beschreibung',
        colLocation: 'Ort',
        weekdaysShort: ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'], // starting with Sunday

        today: 'heute',
        noEvents: 'keine Veranstaltungen',
        unknownLocation: 'Ort unbekannt',
        close: 'Schließen',

        viewDesktop: 'Kalender im Desktopmodus betrachten',
        viewMobile: 'Kalender im Mobilmodus betrachten',
        tipToMonth: 'zur Monatsansicht wechseln',
        tipToWeek: 'zur Wochenansicht wechseln',
        tipToggleCalendar: 'Kalender ein- bzw. ausschalten',
        tipSaveSettings: 'kopiere alle Anzeigeeinstellungen in die URL\n(z.B. um sie als Lesezeichen im Browser zu speichern)',
        tipCopyUrl: 'URL kopieren',
        help: 'Hilfe',
        tipHelp: 'Hilfe anzeigen',

        helpTitle: 'Hilfe zur Benutzung des Fakultätskalenders',
        helpBasicsTitle: 'Grundlegende Anzeigefunktionen des Kalenders',
        helpSubscribeTitle: 'Kalender abonnieren',
        helpEditTitle: 'Kalender editieren',
        helpAboutTitle: 'Weitergehende Informationen',
        allCalendars: 'alle Kalender'
    },
    en: {
        loading: '...loading calendar...',
        loadError: 'Error loading the calendar source files.<br/>Please contact <div class=\'calendar-modal-center-container\'>{contact}</div>',

        prevWeek: '< Previous week',
        nextWeek: 'Next week >',
        prevMonth: '< Previous month',
        nextMonth: 'Next month >',
        prevSemester: '< Previous semester',
        nextSemester: 'Next semester >',
        tipLeftKey: 'press the left arrow key',
        tipRightKey: 'press the right arrow key',
        tipCurrentWeek: 'jump to the current week',
        tipCurrentMonth: 'jump to the current month',
        tipCurrentSemester: 'jump to the current semester',

        weekRange: 'Week from {from} to {to}',
        winterSemester: 'Winter semester {y1}&shy;/{y2}',
        summerSemester: 'Summer semester {y}',

        colDate: 'Date',
        colTime: 'Time',
        colSummary: 'Description',
        colLocation: 'Location',
        weekdaysShort: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], // starting with Sunday

        today: 'today',
        noEvents: 'no events',
        unknownLocation: 'Location unknown',
        close: 'Close',

        viewDesktop: 'View calendar in desktop mode',
        viewMobile: 'View calendar in mobile mode',
        tipToMonth: 'switch to month view',
        tipToWeek: 'switch to week view',
        tipToggleCalendar: 'show or hide this calendar',
        tipSaveSettings: 'copy all display settings into the URL\n(e.g. to bookmark them in your browser)',
        tipCopyUrl: 'copy URL',
        help: 'Help',
        tipHelp: 'show help',

        helpTitle: 'How to use the faculty calendar',
        helpBasicsTitle: 'Basic display functions',
        helpSubscribeTitle: 'Subscribing to the calendars',
        helpEditTitle: 'Editing the calendars',
        helpAboutTitle: 'Further information',
        allCalendars: 'all calendars'
    }
};

let lang = 'de';
let locale = LOCALES.de;

// Set the display language.
// requested: optional language code such as 'en' or 'en-US';
// if omitted, the lang attribute of the <html> tag is used.
function initLanguage(requested) {
    const raw = (requested || document.documentElement.lang || 'de').toLowerCase();
    const code = raw.split('-')[0];
    lang = (code in I18N) ? code : 'de';
    locale = LOCALES[lang];
}

// Look up a translation. Placeholders like {name} are filled from params.
// Falls back to German, then to the key itself.
function t(key, params = {}) {
    let s = I18N[lang][key];
    if (s === undefined) {
        s = I18N.de[key];
    }
    if (s === undefined) {
        console.warn("WARNING: missing translation for key '" + key + "'");
        return key;
    }
    if (typeof s !== 'string') {
        return s;
    }
    return s.replace(/\{(\w+)\}/g, (match, k) => (k in params ? params[k] : match));
}

// Pick the right language from a configuration value.
// value can be a plain string (used for all languages) or an object like
// {de: 'Oberseminar Topologie', en: 'Topology Research Seminar'}.
function translateValue(value) {
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (lang in value) {
        return value[lang];
    }
    if ('de' in value) {
        return value.de;
    }
    return Object.values(value)[0];
}

// Help texts (week/month view only). Each function returns finished HTML.
// svg:          the svgs object passed to loadICS
// urls:         <li> list of subscription URLs
// urlsWithAuth: <li> list of CalDAV URLs with write access
const HELP = {
    de: {
        basics: (svg) => `<p> 
		<b class='calendar-blue'>Zwischen Wochen- und Monatsansicht wechseln</b>
		</p>
		<p> 
			Klicken Sie dazu den Schalter 
			<button class='toggle-calendar-buttons setting-calendar-buttons dummy-calendar-button' disabled>
			<img src="${svg['week']}" class="calendar-svg-icon">
			</button> 
			bzw.
			<button class='toggle-calendar-buttons setting-calendar-buttons dummy-calendar-button' disabled>
			<img src="${svg['month']}" class="calendar-svg-icon">
			</button>
			oben links über dem Kalender.
		</p>
		<p> 
		<b class='calendar-blue'>Veranstaltungen bestimmter Fachbereiche ein- und ausblenden</b>
		</p>
		<p> 
			Klicken Sie dazu die Kontrollkästchen
			<a class="toggle-calendar-buttons calendar-dummy-checkbox">
			<input type="checkbox" class="calendar-dummy-checkbox calendar-checkbox" checked>
			<label class='calendar-dummy-checkbox calendar-label'>
			Fachbereich
			</label>
			</a>
			direkt über dem Kalender.
		</p>
		<p> 
		<b class='calendar-blue'>Gewählte Anzeigeeinstellungen abspeichern</b>
		</p>
		<p>
			Klicken Sie den Schalter 
			</p>
			<div class="calendar-modal-center-container">
			<button class='toggle-calendar-buttons setting-calendar-buttons dummy-calendar-button' disabled>
			<img src="${svg['save']}" class="calendar-svg-icon">
			</button> 
			</div>
			<p>
			rechts oberhalb des Kalenders, so werden die gewählten Anzeigeeinstellungen als Parameter in die URL übertragen. Diese URL können Sie nun bequem als Lesezeichen in Ihrem Browser setzen.
			</p>
		</p>
		<p> 
		<b class='calendar-blue'>Navigation</b>
		</p>
		<p> 
			Mit der rechten oder linken Pfeiltaste (←/→) auf Ihrer Tastatur können Sie eine Woche bzw. einen Monat vor oder zurück navigieren.  Alternativ klicken Sie die entsprechenden Schalter oberhalb des Kalenders. 
		</p>
		<p> 
		<b class='calendar-blue'>Details zu Veranstaltungen anzeigen</b>
		</p>
		<p> 
			Klicken Sie einfach auf eine Veranstaltung, so erscheint ein Fenster mit allen verfügbaren Details.
		</p>`,

        subscribe: (urls) => `<p> 
			Um die Kalender der Fachbereiche in einem Programm wie Thunderbird anzuzeigen, können folgende URLs genutzt werden:
			</p>
			<ul>${urls}
			</ul>
			<p>
			Diese URLs geben Sie als Adresse beim Hinzufügen eines neuen Kalenders in dem entsprechenden Dialog bzw. den Einstellungen Ihres Kalenderprogramms an.
			</p>
			<p> 
			<b class='calendar-blue'>Wichtige Hinweise fürs Abonnieren</b>
			<ul>
			<li>	
			Abonnieren Sie keinen Kalender, den Sie auch editieren möchten, sondern folgen Sie stattdessen den Anweisungen im nächsten Abschnitt.
			</li>
			<li>
			Die Kalender sind öffentlich. Zum Lesen brauchen Sie sich nicht zu authentifizieren.
			</li>
			</ul>
			</p>`,

        edit: (urlsWithAuth) => `<p> 
			Kalendereinträge hinzufügen, bearbeiten und löschen können nur authentifizierte Benutzer.  
			Die Authentifizierung erfolgt über die RUB-LoginID. 
			Zudem müssen für den Benutzer entsprechende Zugriffsrechte im SOGo-System hinterlegt sein.
			Professoren und deren Sekretariate haben in der Regel nur Zugriffsrecht auf den Kalender ihres jeweiligen Fachbereichs. 
			Falls Sie neue Zugriffsrechte wünschen, wenden Sie sich bitte per E-Mail an 
			<div class="calendar-modal-center-container">${CALENDAR_CONTACT}.</div>
			</p>
			<p>
			Kalendereinträge können auf zwei Arten editiert werden: 
			</p>
			<p>
			<b class='calendar-blue'>Option 1:</b> 
			Falls Sie bereits ein Kalenderprogramm benutzen, 
			ist das die einfachste Option.
			</p>
			<p>
			Voraussetzung ist, 
			dass Ihr Kalenderprogramm den offenen Standard CalDAV unterstützt. 
			Dies ist bei Programmen wie beispielsweise Thunderbird und Apple iCal der Fall, bei Google Calendar jedoch nicht; siehe auch <b class='calendar-blue'><a href="https://de.wikipedia.org/wiki/CalDAV#Client" target="_blank">diese Liste</a></b> bei Wikipedia.
			</p>
			<p>
			Abonnieren Sie den Kalender in Ihrem Programm mit Schreibberechtigungen unter Verwendung der folgenden URLs (die von den oben angegebenen URLs abweichen!): 
			</p>
			<ul>${urlsWithAuth}
			</ul>
			<p>
			Anschließend können Sie jederzeit Einträge bequem über Ihr Kalenderprogramm editieren. 
			</p>
			<p>
			<b class='calendar-blue'>Option 2:</b> Alternativ können Sie im Browser über die Benutzeroberfläche des SOGo-Kalenders den entsprechenden Kalender abonnieren.  Folgen Sie dazu <b class='calendar-blue'><a href="https://mail.ruhr-uni-bochum.de/SOGo/" target="_blank">diesem Link</a></b> und melden sich mit Ihrer RUB-Benutzerkennung und Passwort an. Sie gelangen so zu Ihrem persönlichen SOGo-Kalender.  Dort klicken Sie in der linken Spalte auf <i>Abonnements</i> und suchen in dem neu geöffneten Feld nach dem virtuellen Benutzer <i>Termine-Mathe</i>. Es erscheint eine Liste aller verfügbaren Kalender. Wählen Sie nun die Kalender aus, die Sie abonnieren wollen.  Falls Sie Schreibberechtigungen haben (siehe oben), können Sie nun Termine editieren.
			</p>
			
			<p> 
			<b class='calendar-blue'>Wichtige Hinweise fürs Editieren</b>
			<ul>
			<li>
			Die Kalender sind primär für solche Veranstaltungen an der Fakultät bestimmt, die sich an einen größeren Kreis von Personen innerhalb der Fakultät richten. 
			Darunter fallen Konferenzen, Workshops, Oberseminare und ggf. auch andere Forschungsveranstaltungen wie Seminare oder Lesekurse. 
			Lehrveranstaltungen fallen in der Regel nicht darunter.
			</li>
			<li>
			Alle Einträge erscheinen <b class='calendar-blue'>öffentlich</b>!
			Daher ist bei neuen Einträgen Vorsicht geboten, dass Sie tatsächlich den richtigen Kalender auswählen, insbesondere bei privaten Terminen.  
			</li>
			<li>
			Soll ein Eintrag auch in Semesterkalendern (siehe beispielsweise <b class='calendar-blue'><a href="https://math.ruhr-uni-bochum.de/fakultaet/arbeitsbereiche/topologie/oberseminar-topologie/" target="_blank">hier</a></b>) angezeigt werden, so muss für den Termin die entsprechende Kategorie (wie etwa <i>Oberseminar Topologie</i>) angegeben werden. 
			Es empfiehlt sich, Kalendereinträge zu kopieren statt neu zu erstellen.
			</li>
			<li>
			Sich wiederholende Veranstaltungen (technisch: VEVENTS mit RRULE) werden grundsätzlich nicht angezeigt.
			</li>
			<li>
			Mehrtägige Veranstaltungen werden grundsätzlich als ganztägige Veranstaltungen angezeigt.
			</li>
			<li>
			Titel und Beschreibungen können Formeln in TeX-Notation enthalten:
			<code>$...$</code> oder <code>\\(...\\)</code> für Formeln im Fließtext,
			<code>$$...$$</code> oder <code>\\[...\\]</code> für abgesetzte Formeln.
			Dabei ist Folgendes zu beachten:
			<ul>
			<li>Im Titel bitte <code>\\lt</code> statt <code>&lt;</code> schreiben, da der Titel sonst nicht korrekt angezeigt wird.</li>
			<li>Eine Formel in der Beschreibung darf nicht über einen Zeilenumbruch hinweggehen.</li>
			<li>Ein Dollarzeichen, das keine Formel einleiten soll, schreibt man als <code>\\$</code>.</li>
			<li>Kalenderprogramme speichern Backslashes automatisch korrekt. Nur wer ICS-Dateien direkt bearbeitet, muss Backslashes verdoppeln (also <code>\\\\alpha</code> statt <code>\\alpha</code>).</li>
			</ul>
			</li>
			</ul>
			</p>`,

        about: () => `<p>
			Der Quellcode für den Kalender ist unter AGPL-3.0-Lizenz 
			<a href="https://github.com/cbz20/Web-Calendar" target="_blank"><b class='calendar-blue'>hier</b></a> veröffentlicht. 
			</p>
			<p> 
			Dank an die Autoren der verwendeten Javascript-Plugins:
			<ul>
			<li>
			<i>ical.js</i> 
			von u.a.
			<a href="https://github.com/kewisch/ical.js" target="_blank"><b class='calendar-blue'>Philipp Kewisch (Mozilla)</b></a>,
			bereitgestellt über 
			<a href="https://cdnjs.com/" target="_blank"><b class='calendar-blue'>cdnjs</b></a>
			</li>
			<li>
			<i>linkify.js</i>
			von 
			<a href="https://linkify.js.org/" target="_blank"><b class='calendar-blue'>Nick Frasser</b></a>
			</li>
			</ul>
			</p>
			<p>
			<i>
			Bei technischen Problemen oder Fragen wenden Sie sich bitte per E-Mail an 
			</i>
			<div class="calendar-modal-center-container"><i>${CALENDAR_CONTACT}.</i></div>
			</p>`
    },

    en: {
        basics: (svg) => `<p> 
		<b class='calendar-blue'>Switching between week and month view</b>
		</p>
		<p> 
			Click the button 
			<button class='toggle-calendar-buttons setting-calendar-buttons dummy-calendar-button' disabled>
			<img src="${svg['week']}" class="calendar-svg-icon">
			</button> 
			or
			<button class='toggle-calendar-buttons setting-calendar-buttons dummy-calendar-button' disabled>
			<img src="${svg['month']}" class="calendar-svg-icon">
			</button>
			at the top left above the calendar.
		</p>
		<p> 
		<b class='calendar-blue'>Showing and hiding events of particular research areas</b>
		</p>
		<p> 
			Click the checkboxes
			<a class="toggle-calendar-buttons calendar-dummy-checkbox">
			<input type="checkbox" class="calendar-dummy-checkbox calendar-checkbox" checked>
			<label class='calendar-dummy-checkbox calendar-label'>
			Research area
			</label>
			</a>
			directly above the calendar.
		</p>
		<p> 
		<b class='calendar-blue'>Saving your display settings</b>
		</p>
		<p>
			Click the button 
			</p>
			<div class="calendar-modal-center-container">
			<button class='toggle-calendar-buttons setting-calendar-buttons dummy-calendar-button' disabled>
			<img src="${svg['save']}" class="calendar-svg-icon">
			</button> 
			</div>
			<p>
			at the top right above the calendar. This adds your current display settings to the URL as parameters, so you can simply bookmark the page in your browser.
			</p>
		</p>
		<p> 
		<b class='calendar-blue'>Navigation</b>
		</p>
		<p> 
			Use the left and right arrow keys (←/→) on your keyboard to go back or forward by one week or month.  Alternatively, click the corresponding buttons above the calendar. 
		</p>
		<p> 
		<b class='calendar-blue'>Viewing event details</b>
		</p>
		<p> 
			Click on any event to open a window with all available details.
		</p>`,

        subscribe: (urls) => `<p> 
			To display the calendars of the research areas in a program such as Thunderbird, use the following URLs:
			</p>
			<ul>${urls}
			</ul>
			<p>
			Enter one of these URLs as the address when you add a new calendar in your calendar program, either in the corresponding dialog or in the program's settings.
			</p>
			<p> 
			<b class='calendar-blue'>Important notes on subscribing</b>
			<ul>
			<li>	
			Do not subscribe to a calendar that you also want to edit. Follow the instructions in the next section instead.
			</li>
			<li>
			The calendars are public. You do not need to log in to read them.
			</li>
			</ul>
			</p>`,

        edit: (urlsWithAuth) => `<p> 
			Only authenticated users can add, edit and delete calendar entries.  
			Authentication uses your RUB LoginID. 
			In addition, the appropriate access rights must be set up for you in the SOGo system.
			Professors and their secretariats usually only have access to the calendar of their own research area. 
			If you need additional access rights, please email 
			<div class="calendar-modal-center-container">${CALENDAR_CONTACT}.</div>
			</p>
			<p>
			There are two ways to edit calendar entries: 
			</p>
			<p>
			<b class='calendar-blue'>Option 1:</b> 
			If you already use a calendar program, 
			this is the easiest option.
			</p>
			<p>
			Your calendar program must support the open CalDAV standard. 
			Programs such as Thunderbird and Apple Calendar do, but Google Calendar does not; see also the <b class='calendar-blue'><a href="https://en.wikipedia.org/wiki/CalDAV" target="_blank">CalDAV article</a></b> on Wikipedia.
			</p>
			<p>
			Subscribe to the calendar in your program with write access, using the following URLs (which differ from the URLs given above!): 
			</p>
			<ul>${urlsWithAuth}
			</ul>
			<p>
			You can then edit entries at any time directly from your calendar program. 
			</p>
			<p>
			<b class='calendar-blue'>Option 2:</b> Alternatively, you can subscribe to the calendar in your browser using the SOGo web interface.  Follow <b class='calendar-blue'><a href="https://mail.ruhr-uni-bochum.de/SOGo/" target="_blank">this link</a></b> and log in with your RUB LoginID and password. This takes you to your personal SOGo calendar.  In the left-hand column, click <i>Subscriptions</i> and search for the virtual user <i>Termine-Mathe</i> in the field that opens. A list of all available calendars appears. Select the calendars you want to subscribe to.  If you have write access (see above), you can now edit events.
			</p>
			
			<p> 
			<b class='calendar-blue'>Important notes on editing</b>
			<ul>
			<li>
			The calendars are primarily intended for events at the faculty that are aimed at a larger group of people within the faculty. 
			This includes conferences, workshops, research seminars and possibly other research events such as seminars or reading courses. 
			Teaching events are generally not included.
			</li>
			<li>
			All entries are <b class='calendar-blue'>public</b>!
			So when you create a new entry, make sure that you select the right calendar, especially for private appointments.  
			</li>
			<li>
			If an entry should also appear in semester calendars (see for example <b class='calendar-blue'><a href="https://math.ruhr-uni-bochum.de/fakultaet/arbeitsbereiche/topologie/oberseminar-topologie/" target="_blank">here</a></b>), the event must be given the corresponding category (such as <i>Oberseminar Topologie</i>). 
			It is best to copy existing calendar entries rather than create new ones.
			</li>
			<li>
			Recurring events (technically: VEVENTs with an RRULE) are never displayed.
			</li>
			<li>
			Events lasting several days are always displayed as all-day events.
			</li>
			<li>
			Titles and descriptions can contain formulas in TeX notation:
			<code>$...$</code> or <code>\\(...\\)</code> for inline formulas,
			<code>$$...$$</code> or <code>\\[...\\]</code> for displayed formulas.
			Please note:
			<ul>
			<li>In titles, write <code>\\lt</code> instead of <code>&lt;</code>; otherwise the title is not displayed correctly.</li>
			<li>A formula in a description must not span a line break.</li>
			<li>To write a dollar sign that does not start a formula, use <code>\\$</code>.</li>
			<li>Calendar programs store backslashes correctly by themselves. Only if you edit ICS files directly do you need to double backslashes (<code>\\\\alpha</code> instead of <code>\\alpha</code>).</li>
			</ul>
			</li>
			</ul>
			</p>`,

        about: () => `<p>
			The source code for this calendar is published 
			<a href="https://github.com/cbz20/Web-Calendar" target="_blank"><b class='calendar-blue'>here</b></a> under the AGPL-3.0 licence. 
			</p>
			<p> 
			Thanks to the authors of the JavaScript plugins used:
			<ul>
			<li>
			<i>ical.js</i> 
			by, among others,
			<a href="https://github.com/kewisch/ical.js" target="_blank"><b class='calendar-blue'>Philipp Kewisch (Mozilla)</b></a>,
			provided via 
			<a href="https://cdnjs.com/" target="_blank"><b class='calendar-blue'>cdnjs</b></a>
			</li>
			<li>
			<i>linkify.js</i>
			by 
			<a href="https://linkify.js.org/" target="_blank"><b class='calendar-blue'>Nick Frasser</b></a>
			</li>
			</ul>
			</p>
			<p>
			<i>
			For technical problems or questions, please email 
			</i>
			<div class="calendar-modal-center-container"><i>${CALENDAR_CONTACT}.</i></div>
			</p>`
    }
};

function helpText(section, ...args) {
    const help = HELP[lang] || HELP.de;
    return help[section](...args);
}
