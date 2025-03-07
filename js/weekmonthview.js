/*
    web-calendar to display multiple ics-calendars in a browser
    source code available at https://github.com/cbz20/Web-Calendar/
    Copyright (C) 2025 Claudius Zibrowius

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

let today = new Date();
let referenceDate = new Date(); // used for navigation
let events = [];
let categoriesSelected = []; // toggled catgeories
let calendarName = "";
let missingEntrySymbol = "&#x2022;";
let categoriesAll;
let categoryColors;
let svgFiles;
let weekview = true;

// main function to call the script
function loadICS(name, colours, links,svgs) {
    categoriesAll = Object.keys(colours);
    categoryColors = colours;
    calendarName = name;
    svgFiles = svgs;
    parseURLparams();
    parseICS(links)
    	.then(() => displayCalendar())
    	.catch(error => {
            console.error('FATAL ERROR: Fehler beim Laden der ICS-Dateien:', error);
            displayCalendar()
            document.getElementById('error-message').innerHTML = "Fehler beim Laden der Kalender-Quelldateien.<br/>Bitte kontaktieren Sie <div class='modal-center-container'>Termine-Mathe@ruhr-uni-bochum.de.</div>";
        });
}

async function parseICS(links) {
    //console.log(links);
    await Promise.all(categoriesAll.map(async category => {
    	const response = await fetch(links[category]);
	if (!response.ok) {
	   throw new Error(`Response status: ${response.status}`);
	}
	let data = await response.text();
	let jcalData = ICAL.parse(data);
	let vcalendar = new ICAL.Component(jcalData);
	let vevents = vcalendar.getAllSubcomponents('vevent');
	let newevents = vevents.map(event => parse_event(event,category));
	newevents = newevents.filter(event => Object.keys(event).length > 0);
	events.push(...newevents);
        //console.log(events);
    }));
}

function parse_event(event,category) {
        // see https://icalendar.org/iCalendar-RFC-5545/3-6-1-event-component.html

        // if an event has no start date or no summary or no categories, we ignore the event
        // this seems to be done by ical.js already, so this step is probably redundant
        if (!event.hasProperty('dtstart') || !event.hasProperty('summary')) {
            console.warn("WARNING: An event in the ics file was ignored because it does not contain a start date (DTSTART) or because it does not contain a summary (SUMMARY).");
            return {};
        };
        let summary = event.getFirstPropertyValue('summary');
        let startDate;
        try {
            startDate = event.getFirstPropertyValue('dtstart').toJSDate();
        } catch {
            // this step might also be redundant, but better safe than sorry
            console.warn("WARNING: An event in the ics file was ignored because the date could not be converted into javascript format.");
            return {};
        };

        // we ignore any recurring events because they seem complicated to implement
        if (event.hasProperty('rrule')) {
            console.warn("WARNING: The event on " + startDate.toDateString() + " entitled '" + summary + "' in the ics file was ignored because it is a recurring event (i.e. VEVENT contains an RRULE).");
            return {};
        };

        // other event details are optional
        let description = event.getFirstPropertyValue('description') || '';
        let location = event.getFirstPropertyValue('location') || missingEntrySymbol;
        let allCategories = [category];

        try {
            let allCategoriesRaw = event.getAllProperties('categories');
            allCategoriesRaw.forEach(e => {
                cats = e.jCal;
                cats = cats.slice(3, cats.length);
                allCategories = allCategories.concat(cats);
            });
        } catch {
            console.warn("WARNING: The event on " + startDate.toDateString() + " entitled '" + summary + "' in the ics file was ignored because its event categories could not be parsed.");
            return {};
        }

        // Remove whitespace from both ends of each category
        // Also replace multiple consecutive whitespaces by a single whitespace
        allCategories = allCategories.map(cat => cat.trim().replace(/[ ]+/g, ' '));
        let mainCategory = category;

        // LOGIC FOR THE NEXT BIT:
        // 
        // IF — no end.date
        //      (=> singleDayEvent)
        //      (=> allDayEvent)
        //      [set end.date = start.date]
        // ELSE 
        //      IF ­— (end.time == 00:00)
        //          [set end.date = end.date - 1 minute]
        //      IF — ((end.date == start.date) AND (start.time == 00:00) AND (end.time == 23:59))
        //              (=> singleDayEvent)
        //              (=> allDayEvent)
        //      IF — end.date != start.date
        //          (=> allDayEvent)

        let allDayEvent = false;
        let singleDayEvent = false;

        let endDate;
        try {
            endDate = event.getFirstPropertyValue('dtend').toJSDate();
        } catch {
            allDayEvent = true;
            singleDayEvent = true;
            endDate = startDate;
        };
        if (!allDayEvent) {
            let starttime = startDate.toLocaleTimeString('de', {
                hour: "2-digit",
                minute: "2-digit"
            });
            let endtime = endDate.toLocaleTimeString('de', {
                hour: "2-digit",
                minute: "2-digit"
            });
            if (endtime == "00:00") {
                endDate.setMinutes(endDate.getMinutes() - 1);
                endtime = "23:59";
            };

            if (startDate.toDateString() == endDate.toDateString() && starttime == "00:00" && endtime == "23:59") {
                allDayEvent = true;
                singleDayEvent = true;
            };
            if (startDate.toDateString() != endDate.toDateString()) {
                allDayEvent = true;
            };
        };
        if (allDayEvent) {
            // display all day events at the top
            startDate.setHours(0, 0, 0, 0);
        };

        return {
            summary,
            description,
            allDayEvent,
            singleDayEvent,
            startDate,
            endDate,
            location,
            mainCategory,
            allCategories
        };
}

function displayCalendar() {
    if (weekview) {
        drawWeekView();
    } else {
        drawMonthView();
    };
    drawToggleButtons();
}

function drawWeekView() {
    let referenceDay = referenceDate.getDay();
    if (referenceDay == 0) { // make sure that firstDayDisplayed ≤ referenceDate ≤ lastDayDisplayed
        referenceDay = 7;
    };
    // first day of week containing referenceDate
    let firstDayDisplayed = new Date(referenceDate.valueOf());
    firstDayDisplayed.setDate(firstDayDisplayed.getDate() + 1 - referenceDay);
    firstDayDisplayed.setHours(0, 0, 0, 0);
    // last day of week containing referenceDate
    let lastDayDisplayed = new Date(referenceDate.valueOf());
    lastDayDisplayed.setDate(lastDayDisplayed.getDate() + 7 - referenceDay);
    lastDayDisplayed.setHours(23, 59, 59, 999);
    // iterator for date
    let currentDay = new Date(firstDayDisplayed.valueOf());
    //console.log(referenceDate);
    //console.log(firstDayDisplayed);

    // page title with navigation buttons
    document.getElementById('calendar-header').innerHTML = "";
    let el = document.createElement('button');
    el.classList.add("setting-buttons");
    el.title = "linke Pfeiltaste drücken";
    el.innerHTML = "< Vorherige Woche";
    el.addEventListener('click', function() {
        changeWeek(-1);
    });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('div');
    el.id = 'calendar-title';
    el.title = "springe zur aktuellen Woche";
    el.addEventListener('click', function(event) {
        BackToToday();
    });
    el.innerHTML = calendarName + "<br>Woche vom " +
        firstDayDisplayed.toLocaleString('de-DE', {
            month: 'numeric',
            year: 'numeric',
            day: 'numeric'
        }) +
        "­ bis " +
        lastDayDisplayed.toLocaleString('de-DE', {
            month: 'numeric',
            year: 'numeric',
            day: 'numeric'
        });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('button');
    el.classList.add("setting-buttons");
    el.title = "rechte Pfeiltaste drücken";
    el.addEventListener('click', function() {
        changeWeek(1);
    });
    el.innerHTML = "Nächste Woche >";
    document.getElementById('calendar-header').appendChild(el);

    // calendar headings
    document.getElementById('calendar-monthview').innerHTML = '';
    let calendar = document.getElementById('calendar-weekview');
    calendar.innerHTML = '';

    let colGroup = document.createElement('colgroup');
    let col = document.createElement('col');
    col.classList.add('weekview-col-date');
    colGroup.appendChild(col);
    col = document.createElement('col');
    col.classList.add('weekview-col-time');
    colGroup.appendChild(col);
    col = document.createElement('col');
    col.classList.add('weekview-col-summary');
    colGroup.appendChild(col);
    col = document.createElement('col');
    col.classList.add('weekview-col-location');
    colGroup.appendChild(col);
    calendar.appendChild(colGroup);

    let tableHead = document.createElement('thead');
    let elementTH = document.createElement('th');
    elementTH.textContent = "Datum";
    elementTH.classList.add('weekview-day');
    tableHead.appendChild(elementTH);
    elementTH = document.createElement('th');
    elementTH.textContent = "Uhrzeit";
    tableHead.appendChild(elementTH);
    elementTH = document.createElement('th');
    elementTH.textContent = "Beschreibung";
    tableHead.appendChild(elementTH);
    elementTH = document.createElement('th');
    elementTH.textContent = "Ort";
    tableHead.appendChild(elementTH);
    calendar.appendChild(tableHead);

    // prefilter events (for better performance)
    let weekEvents = events.filter(event => {
        if (event.endDate < firstDayDisplayed) {
            return false;
        };
        if (event.startDate > lastDayDisplayed) {
            return false;
        };
        // strict display selection rule:
        return categoriesSelected.includes(event.mainCategory);
        // non-strict display selection rule: (allows cross-listing)
        //let foundCat = false;
        //event.allCategories.forEach(cat => {
        //    if (categoriesSelected.includes(cat)) {foundCat = true;};
        //});
        //return foundCat;
    });

    // iterate through all displayed days   
    let tbody = document.createElement('tbody');
    for (let day = 0; day < 7; day++) {
        let isToday = currentDay.toDateString() == today.toDateString();
        // for testing only
        //isToday = 
        //    currentDay.getDate() == today.getDate()-3 &&
        //    currentDay.getMonth() == today.getMonth() &&
        //    currentDay.getYear() == today.getYear();

        // Ereignisse für den Tag filtern
        let dayEvents = weekEvents.filter(event => {
            // Zeige alle eintägigen und mehrtägigen Ereignisse korrekt an
            return (((event.startDate.toDateString() === currentDay.toDateString()) ||
                (currentDay >= event.startDate && currentDay <= event.endDate)));
        });
        // sort events by start date
        dayEvents.sort((a, b) => a.startDate - b.startDate);
        let NumberOfDayEvents = dayEvents.length;

        // horizontal separators
        let currentRow = document.createElement('tr');
        let TDelement = document.createElement('td');
        TDelement.colSpan = "4";
        let HRelement = document.createElement('hr');
        TDelement.appendChild(HRelement);
        currentRow.appendChild(TDelement);
        tbody.appendChild(currentRow);

        if (isToday) {
            // thick horizontal separator
            let currentRow = document.createElement('tr');
            currentRow.classList.add('today-separator');
            currentRow.classList.add('today-separator-top');
            TDelement = document.createElement('td');
            TDelement.colSpan = "4";
            HRelement = document.createElement('hr');
            TDelement.appendChild(HRelement);
            currentRow.appendChild(TDelement);
            tbody.appendChild(currentRow);
        };

        // event row
        // day entry
        currentRow = document.createElement('tr');
        let FirstColumnEntry = document.createElement('td');
        FirstColumnEntry.classList.add('weekview-day');
        if (NumberOfDayEvents > 1) {
            FirstColumnEntry.rowSpan = NumberOfDayEvents;
        };
        if (isToday) {
            FirstColumnEntry.classList.add('weekview-today-date');
            FirstColumnEntry.innerHTML = "heute<br>" + currentDay.toLocaleDateString('de', {
                weekday: "short",
                month: "numeric",
                day: "numeric",
            });
        } else {
            FirstColumnEntry.textContent = currentDay.toLocaleDateString('de', {
                weekday: "short",
                month: "numeric",
                day: "numeric",
            });
        };
        currentRow.appendChild(FirstColumnEntry);

        // event entries
        var firstevent = true;
        dayEvents.forEach(event => {
            if (firstevent) {
                firstevent = false;
            } else {
                currentRow = document.createElement('tr');
            };

            // time
            let eventTD = document.createElement('td');
            eventTD.classList.add('weekview-event', 'weekview-event-time');
            eventTD.style.backgroundColor = categoryColors[event.mainCategory];
            if (event.allDayEvent) {
                eventTD.innerHTML = missingEntrySymbol;
            } else {
                eventTD.textContent = event.startDate.toLocaleTimeString('de', {
                    hour: "2-digit",
                    minute: "2-digit"
                })
            };
            eventTD.addEventListener('click', function() {
                openModal(event);
            });
            currentRow.appendChild(eventTD);

            // details
            eventTD = document.createElement('td');
            eventTD.classList.add('weekview-event', 'weekview-event-summary');
            eventTD.style.backgroundColor = categoryColors[event.mainCategory];
            eventTD.textContent = event.summary;
            eventTD.addEventListener('click', function() {
                openModal(event);
            });
            currentRow.appendChild(eventTD);

            // location
            eventTD = document.createElement('td');
            eventTD.classList.add('weekview-event');
            eventTD.classList.add('weekview-event-location');
            eventTD.style.backgroundColor = categoryColors[event.mainCategory];
            eventTD.innerHTML = event.location;
            eventTD.addEventListener('click', function() {
                openModal(event);
            });
            currentRow.appendChild(eventTD);
            //
            tbody.appendChild(currentRow);
        });
        if (NumberOfDayEvents == 0) {
            // time column
            if (isToday) {
                // Only clarify empty field for today. 
                // Do not spam the weekview with identical messages.
                let eventTD = document.createElement('td');
                currentRow.appendChild(eventTD);
                // summary column
                eventTD = document.createElement('td');
                eventTD.innerHTML = "<i> — keine Veranstaltungen —</i>";
                eventTD.classList.add('no-events-to-display');
                currentRow.appendChild(eventTD);
            };
            tbody.appendChild(currentRow);
        };
        if (isToday) {
            // thick horizontal separator
            currentRow = document.createElement('tr');
            currentRow.classList.add('today-separator');
            currentRow.classList.add('today-separator-bottom');
            TDelement = document.createElement('td');
            TDelement.colSpan = "4";
            HRelement = document.createElement('hr');
            TDelement.appendChild(HRelement);
            currentRow.appendChild(TDelement);
            tbody.appendChild(currentRow);
        };

        // increment currentDay
        currentDay.setDate(currentDay.getDate() + 1);
    }
    calendar.appendChild(tbody);
}

function drawMonthView() {
    // first and last date of month containing referenceDate
    let firstDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth(), 1);
    let lastDay = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0);
    // first day (=Sunday) of week including firstDay
    let firstDayDisplayed = new Date(firstDay.valueOf());
    firstDayDisplayed.setDate(firstDayDisplayed.getDate() - firstDay.getDay());
    firstDayDisplayed.setHours(0, 0, 0, 0);
    // last day (=Saturday) of week including lastDay
    let lastDayDisplayed = new Date(lastDay.valueOf());
    lastDayDisplayed.setDate(lastDayDisplayed.getDate() + 6 - lastDay.getDay());
    lastDayDisplayed.setHours(23, 59, 59, 999);
    // iterator for date
    let currentDay = new Date(firstDayDisplayed.valueOf());

    // page title with navigation buttons
    document.getElementById('calendar-header').innerHTML = "";
    let el = document.createElement('button');
    el.classList.add("setting-buttons");
    el.title = "linke Pfeiltaste drücken";
    el.innerHTML = "< Vorheriger Monat";
    el.addEventListener('click', function() {
        changeMonth(-1);
    });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('div');
    el.id = 'calendar-title';
    el.title = "springe zum aktuellen Monat";
    el.addEventListener('click', function(event) {
        BackToToday();
    });
    el.innerHTML = calendarName + "<br>" + firstDay.toLocaleString('de-DE', {
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('button');
    el.classList.add("setting-buttons");
    el.title = "rechte Pfeiltaste drücken";
    el.addEventListener('click', function() {
        changeMonth(1);
    });
    el.innerHTML = "Nächster Monat >";
    document.getElementById('calendar-header').appendChild(el);

    // calendar headings
    let calendar = document.getElementById('calendar-monthview');
    calendar.innerHTML = '';
    document.getElementById('calendar-weekview').innerHTML = '';
    // table header with week days
    let daysOfWeek = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
    daysOfWeek.forEach(day => {
        let dayHeader = document.createElement('div');
        dayHeader.textContent = day;
        if (day == 'So' || day == 'Sa') {
            dayHeader.classList.add('monthview-weekend-header');
        } else {
            dayHeader.classList.add('monthview-day-header');
        };
        calendar.appendChild(dayHeader);
    });

    // prefilter events (for better performance)
    let monthEvents = events.filter(event => {
        if (event.endDate < firstDayDisplayed) {
            return false;
        };
        if (event.startDate > lastDayDisplayed) {
            return false;
        };
        // strict display selection rule:
        return categoriesSelected.includes(event.mainCategory);
        // non-strict display selection rule: (allows cross-listing)
        //let foundCat = false;
        //event.allCategories.forEach(cat => {
        //    if (categoriesSelected.includes(cat)) {foundCat = true;};
        //});
        //return foundCat;
    });

    // iterate through all displayed days
    for (let day = 0; day < 50; day++) {
        let isToday = currentDay.toDateString() == today.toDateString();
        // for testing only
        //isToday = 
        //    currentDay.getDate() == today.getDate()-3 &&
        //    currentDay.getMonth() == today.getMonth() &&
        //    currentDay.getYear() == today.getYear();

        // Ereignisse für den Tag anzeigen
        let dayEvents = monthEvents.filter(event => {
            // Zeige alle eintägigen und mehrtägigen Ereignisse korrekt an
            return (((event.startDate.toDateString() === currentDay.toDateString()) ||
                (currentDay >= event.startDate && currentDay <= event.endDate)));
        });
        // sort events by start date
        dayEvents.sort((a, b) => a.startDate - b.startDate);

        let dayCell = document.createElement('div');
        if (currentDay.getMonth() == firstDay.getMonth()) {
            dayCell.classList.add('monthview-day');
        } else {
            dayCell.classList.add('monthview-day', 'monthview-day-outside-month');
        };
        if (currentDay.getDay() == 0 || currentDay.getDay() == 6) {
            dayCell.classList.add('monthview-weekend');
        };
        if (isToday) {
            dayCell.classList.add('monthview-today');
        };
        dayCell.textContent = currentDay.getDate();

        // event entries
        dayEvents.forEach(event => {
            let eventDiv = document.createElement('div');
            eventDiv.classList.add('monthview-day-event');
            eventDiv.style.backgroundColor = categoryColors[event.mainCategory];
            if (event.allDayEvent) {
                eventDiv.textContent = event.summary;
            } else {
                eventDiv.textContent = event.startDate.toLocaleTimeString('de', {
                    hour: "2-digit",
                    minute: "2-digit"
                }) + " " + event.summary;
            };
            eventDiv.addEventListener('click', function() {
                openModal(event);
            });
            dayCell.appendChild(eventDiv);
        });
        calendar.appendChild(dayCell);
        // increment currentDay
        currentDay.setDate(currentDay.getDate() + 1);
        if (currentDay > lastDayDisplayed) {
            break;
        };
    }
}

function drawToggleButtons() {
    let buttons = document.getElementById('toggle-buttons-header');
    buttons.innerHTML = '';
    // Toggle Week/Month View Button
    button = document.createElement('button');
    buttonImage = document.createElement('img');
    if (weekview) {
        buttonImage.src = svgFiles['month'];
        button.title = "zur Monatsansicht wechseln";
    } else {
        buttonImage.src = svgFiles['week'];
        button.title = "zur Wochenansicht wechseln";
    };
    buttonImage.classList.add('svg-icon');
    button.classList.add('toggle-buttons');
    button.classList.add('setting-buttons');
    button.appendChild(buttonImage);
    button.addEventListener('click', function() {
        toggleWeekMonth();
    });
    buttons.appendChild(button);
    // Toggle-Buttons generieren
    for (const category of categoriesAll) {
        button = document.createElement('a');
        button.classList.add("toggle-buttons");
        input = document.createElement('input');
        input.type = "checkbox";
        input.id = category;
        input.title = "Kalender ein- bzw. ausschalten";
        if (categoriesSelected.includes(category)) { // Kategorie an
            //button.classList.remove('button-switched-off');
            //.classList.add('button-switched-on');
            input.checked = true;
            input.style.accentColor = categoryColors[category];
        } else { // Kategorie aus
            //button.classList.remove('button-switched-on');
            input.checked = false;
            input.classList.add('button-switched-off');
        };
        input.addEventListener('click', function() {
            toggleCategory(category); // Kategorie ein/ausschalten
        });
        button.appendChild(input);
        label = document.createElement('label');
        label.textContent = category;
        label.htmlFor = category;
        if (categoriesSelected.includes(category)) { // Kategorie an
            button.classList.remove('label-switched-off');
            label.style.color = categoryColors[category];
        } else { // Kategorie aus
            button.classList.add('label-switched-off');
        };
        button.appendChild(label);
        buttons.appendChild(button);
    };
    // Show Help Button
    help = document.createElement('a');
    help.title = "Hilfe anzeigen";
    help.innerHTML = "Hilfe";
    help.id = "help";
    help.addEventListener('click', function() {
        showHelp();
    });
    buttons.appendChild(help);
    // Save URL Parameters Button
    button = document.createElement('button');
    buttonImage = document.createElement('img');
    buttonImage.classList.add('svg-icon');
    buttonImage.src = svgFiles['save'];
    button.classList.add('toggle-buttons', 'setting-buttons');
    button.title = "kopiere alle Anzeigeeinstellungen in die URL\n(z.B. um sie als Lesezeichen im Browser zu speichern)";
    button.appendChild(buttonImage);
    button.addEventListener('click', function() {
        addParamsToURL();
    });
    buttons.appendChild(button);
}

function openModal(event) {
    document.body.classList.add('no-scroll');
    if (event.singleDayEvent) {
        document.getElementById('my-modal-title').textContent =
            event.startDate.toLocaleDateString('de-de', {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
    } else if (event.allDayEvent) {
        // event.singleDayEvent = false 
        document.getElementById('my-modal-title').textContent =
            event.startDate.toLocaleDateString('de-de', {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }) + " – " +
            event.endDate.toLocaleDateString('de-de', {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
    } else {
        document.getElementById('my-modal-title').textContent =
            event.startDate.toLocaleDateString('de-de', {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }) +
            ", " +
            event.startDate.toLocaleTimeString('de-de', {
                hour: "numeric",
                minute: "2-digit"
            }) +
            "–" +
            event.endDate.toLocaleTimeString('de-de', {
                hour: "numeric",
                minute: "2-digit"
            });
    };
    document.getElementById('my-modal-body').innerHTML = "";
    el = document.createElement('div');
    el.classList.add("eventsummary");
    el.innerHTML = event.summary;
    document.getElementById('my-modal-body').appendChild(el);
    el = document.createElement('div');
    el.classList.add("eventlocation");
    if (event.location == missingEntrySymbol) {
        el.innerHTML = "Ort unbekannt";
    } else {
        el.innerHTML = event.location;
    };
    document.getElementById('my-modal-body').appendChild(el);

    //el = document.createElement('button');
    //el.classList.add('toggle-buttons');
    //el.disabled = true;
    //el.innerHTML = event.mainCategory;
    //el.style.backgroundColor = categoryColors[event.mainCategory];
    //document.getElementById('my-modal-body').appendChild(el);
    //console.log(event.allCategoriesRaw);
    //console.log(event.allCategories);
    event.allCategories.forEach(cat => {
        el = document.createElement('button');
        el.classList.add('toggle-buttons', 'dummy-button');
        el.disabled = true;
        el.innerHTML = cat;
        if (categoriesAll.includes(cat)) {
            el.style.backgroundColor = categoryColors[cat];
        } else {
            el.style.backgroundColor = categoryColors[event.mainCategory];
        };
        document.getElementById('my-modal-body').appendChild(el);
    });

    el = document.createElement('p');
    el.classList.add("eventabstract");
    // now replace all line breaks with <br. tags
    // the following regex hack is taken from
    // https://stackoverflow.com/questions/784539/how-do-i-replace-all-line-breaks-in-a-string-with-br-elements
    el.innerHTML = event.description.replace(/(?:\r\n|\r|\n)/g, '<br>');
    document.getElementById('my-modal-body').appendChild(el);
    document.getElementById('my-modal-body').appendChild(closeModalButton());
    document.getElementById('event-modal').style.display = 'flex'; //necessary to show modal
}

function showHelp(event) {
    document.body.classList.add('no-scroll');
    document.getElementById('my-modal-title').textContent = "Hilfe zur Benutzung des Fakultätskalenders";
    let urls = "<li><b>";
    urls += "alle Kalender";
    urls += ": </b>"; 
    urls += copyButton("https://mail.ruhr-uni-bochum.de/SOGo/dav/public/termixxd/Calendar/");
    urls += "https://mail.ruhr-uni-bochum.de/SOGo/dav/public/termixxd/Calendar/"
    urls += "</li>";
    for (const category of categoriesAll){
    	urls += "<li><b>";
    	urls += category;
    	urls += ": </b>";
    	urls += copyButton(links[category]);
    	urls += links[category];
    	urls += "</li>";
    };
    let urls_with_auth = "";
    for (const category of categoriesAll){
    	urls_with_auth += "<li><b>";
    	urls_with_auth += category;
    	urls_with_auth += ": </b>";
    	urls_with_auth += copyButton(links[category].replace(/public\//g,'').replace(/.ics/g,'\/'));
    	urls_with_auth += links[category].replace(/public\//g,'').replace(/.ics/g,'\/');
    	urls_with_auth += "</li>";
    };
    
    document.getElementById('my-modal-body').innerHTML = "";
    
    document.getElementById('my-modal-body').innerHTML += accordionElement(
    	"Grundlegende Anzeigefunktionen des Kalenders",
    	`<p> 
	<b>Zwischen Wochen- und Monatsansicht wechseln</b>
	</p>
	<p> 
		Klicken Sie dazu den Schalter 
		<button class='toggle-buttons setting-buttons dummy-button' disabled>
		<img src="`+svgFiles['week']+`" class="svg-icon">
		</button> 
		bzw.
		<button class='toggle-buttons setting-buttons dummy-button' disabled>
		<img src="`+svgFiles['month']+`" class="svg-icon">
		</button>
		oben links über dem Kalender.
	</p>
	<p> 
	<b>Veranstaltungen bestimmter Fachbereiche ein- und ausblenden</b>
	</p>
	<p> 
		Klicken Sie dazu die Kontrollkästchen
		<a class="toggle-buttons dummy-checkbox">
		<input type="checkbox" class="dummy-checkbox" checked>
		<label class='dummy-checkbox'>
		Fachbereich
		</label>
		</a>
		direkt über dem Kalender.
	</p>
	<p> 
	<b>Gewählte Anzeigeeinstellungen abspeichern</b>
	</p>
	<p>
		Klicken Sie den Schalter 
		</p>
		<div class="modal-center-container">
		<button class='toggle-buttons setting-buttons dummy-button' disabled>
		<img src="`+svgFiles['save']+`" class="svg-icon">
		</button> 
		</div>
		<p>
		rechts oberhalb des Kalenders, so werden die gewählten Anzeigeeinstellungen als Parameter in die URL übertragen. Diese URL können Sie nun bequem als Lesezeichen in Ihrem Browser setzen.
		</p>
	</p>
	<p> 
	<b>Navigation</b>
	</p>
	<p> 
		Mit der rechten oder linken Pfeiltaste (←/→) auf Ihrer Tastatur können Sie eine Woche bzw. einen Monat vor oder zurück navigieren.  Alternativ klicken Sie die entsprechenden Schalter oberhalb des Kalenders. 
	</p>
	<p> 
	<b>Details zu Veranstaltungen anzeigen</b>
	</p>
	<p> 
		Klicken Sie einfach auf eine Veranstaltung, so erscheint ein Fenster mit allen verfügbaren Details.
	</p>`);
	document.getElementById('my-modal-body').innerHTML += accordionElement(
		"Kalender abonnieren",
		`<p> 
		Um die Kalender der Fachbereiche in einem Programm wie Thunderbird anzuzeigen, können folgende URLs genutzt werden:
		</p>
		<ul>` + urls + `
		</ul>
		<p>
		Diese URLs geben Sie als Adresse beim Hinzufügen eines neuen Kalenders in dem entsprechenden Dialog bzw. den Einstellungen Ihres Kalenderprogramms an.
		</p>
		<p> 
		<b>Wichtige Hinweise fürs Abonnieren</b>
		<ul>
		<li>	
		Abonnieren Sie keinen Kalender, den Sie auch editieren möchten, sondern folgen Sie stattdessen den Anweisungen im nächsten Abschnitt.
		</li>
		<li>
		Die Kalender sind öffentlich. Zum Lesen brauchen Sie sich nicht authentifizieren.
		</li>
		</ul>
		</p>`);
	document.getElementById('my-modal-body').innerHTML += accordionElement(
		"Kalender editieren",
		`<p> 
		Kalendereinträge hinzufügen, bearbeiten und löschen können nur authentifizierte Benutzer. 
		In der Regel sind dies Professoren und deren Sekretariate.  
		Die Authentifizierung erfolgt über die RUB-LoginID. 
		Zudem muss dem Benutzer eine entsprechende Zugangsberechtigung gegeben werden.  
		Falls Sie eine neue Zugangsberechtigung wünschen, wenden Sie sich bitte per E-Mail an 
		<div class="modal-center-container">Termine-Mathe@ruhr-uni-bochum.de.</div>
		</p>
		<p>
		Ist die Zugangsberechtigung erteilt, können Kalendereinträge auf zwei Art und Weisen editiert werden:
		</p>
		<p>
		<b>Option 1:</b> 
		Falls Sie bereits ein Kalenderprogramm benutzen, 
		ist das die einfachste Option.
		</p>
		<p>
		Voraussetzung ist, 
		dass Ihr Kalenderprogramm den offenen Standard CalDAV unterstützt. 
		Dies ist bei Programmen wie beispielsweise Thunderbird und Apple iCal der Fall, bei Google Calendar jedoch nicht; siehe auch <b><a href="https://de.wikipedia.org/wiki/CalDAV#Client" target="_blank">diese Liste</a></b> bei Wikipedia.
		</p>
		<p>
		Abonnieren Sie den Kalender in Ihrem Programm mit Schreibberechtigungen unter Verwendung der folgenden URLs (die von den oben angegebenen URLs abweichen!): 
		</p>
		<ul>` + urls_with_auth + `
		</ul>
		<p>
		Anschließend können Sie jederzeit Einträge bequem über Ihr Kalenderprogramm editieren. 
		</p>
		<p>
		<b>Option 2:</b> Alternativ können Sie im Browser über die Benutzeroberfläche des SOGo-Kalenders den entsprechenden Kalender abonnieren.  Folgen Sie dazu <b><a href="https://mail.ruhr-uni-bochum.de/SOGo/" target="_blank">diesem Link</a></b> und melden sich mit Ihrer RUB-Benutzerkennung und Passwort an. Sie gelangen so zu Ihrem persönlichem SOGo-Kalender.  Dort klicken Sie in der linken Spalte auf <i>Abonnements</i> und suchen in dem neu geöffneten Feld nach dem virtuellen Benutzer <i>Termine-Mathe</i>. Es erscheint eine Liste aller verfügbaren Kalender. Wählen Sie nun die Kalender aus, die Sie abonnieren wollen.  Falls Sie Schreibberechtigungen haben (siehe oben), können sie nun Termine editieren.
		</p>
		
		<p> 
		<b>Wichtige Hinweise fürs Editieren</b>
		<ul>
		<li>
		Die Kalender sind primär für solche Veranstaltungen an der Fakultät bestimmt, die sich an einen größeren Kreis von Personen innerhalb der Fakultät richten. 
		Darunter fallen Konferenzen, Workshops, Oberseminare und ggf. auch andere Forschungsveranstaltungen wie Seminare oder Lesekurse. 
		Lehrveranstaltungen fallen in der Regel nicht darunter.
		</li>
		<li>
		Alle Einträge erscheinen <b>öffentlich</b>!
		Daher ist bei neuen Einträgen Vorsicht geboten, dass Sie tatsächlich den richtigen Kalender auswählen, insbesondere bei privaten Terminen.  
		</li>
		<li>
		Soll ein Eintrag auch in Semesterkalendern (siehe beispielweise <b><a href="https://math.ruhr-uni-bochum.de/fakultaet/arbeitsbereiche/topologie/oberseminar-topologie/" target="_blank">hier</a></b>) angezeigt werden, so muss für den Termin die entsprechende Kategorie (wie etwa <i>Oberseminar Topologie</i>) angegeben werden. 
		Es empfielt sich, Kalendereinträge zu kopieren statt neu zu erstellen.
		</li>
		<li>
		Sich wiederholende Veranstaltungen (technisch: VEVENTS mit RRULE) werden grundsätzlich nicht angezeigt.
		</li>
		<li>
		Mehrtägige Veranstaltungen werden grundsätzlich als ganztägige Veranstaltungen angezeigt.
		</li>
		</ul>
		</p>`);
	document.getElementById('my-modal-body').innerHTML += accordionElement(
		"Weitergehende Informationen",
		`<p>
		Der Quellcode für den Kalender ist unter AGPL-3.0-Lizenz 
		<a href="https://github.com/cbz20/Web-Calendar" target="_blank"><b>hier</b></a> veröffentlicht.
		</p>
		<p>
		<i>
		Bei technischen Problemen oder Fragen wenden Sie sich bitte per E-Mail an 
		</i>
		<div class="modal-center-container"><i>Termine-Mathe@ruhr-uni-bochum.de.</i></div>
		</p>`);
    document.getElementById('my-modal-body').appendChild(closeModalButton());
    document.getElementById('event-modal').style.display = 'flex'; //necessary to show modal
}

function copyButton(url) {
    return `<button 
    	class='toggle-buttons setting-buttons' 
    	title="url kopieren" 
    	onclick='navigator.clipboard.writeText("` + url + `").then(function() {
	    console.log("copied url");
	}, function() {
	    console.warn("error trying to copy url");
	});'>
	<img 
		src="`+svgFiles['copy']+`" 
		class="svg-icon">
	</button> `
};

function closeModalButton() {
    let el = document.createElement('div');
    el.classList.add("modal-center-container");
    let button = document.createElement('button');
    button.classList.add('toggle-buttons', "setting-buttons");
    button.innerHTML = "Schließen";
    button.addEventListener('click', function() {
        document.getElementById('event-modal').style.display = 'none';
        document.body.classList.remove('no-scroll');
    });
    el.appendChild(button);
    return el;
};

// close modal 
document.getElementById('event-modal').addEventListener('click', function(event) {
    // only close if we click in the transparent area outside the modal content
    if (event.currentTarget !== event.target) {
        return;
    }
    document.getElementById('event-modal').style.display = 'none';
    document.body.classList.remove('no-scroll');
});

// Funktion, um den Monat zu ändern
function changeMonth(offset) {
    referenceDate.setMonth(referenceDate.getMonth() + offset);
    displayCalendar();
}

function changeWeek(offset) {
    referenceDate.setDate(referenceDate.getDate() + offset * 7);
    displayCalendar();
}

function toggleCategory(category) {
    let switchon = true;
    categoriesSelected = categoriesSelected.filter(function(item) {
        if (item !== category) {
            return true;
        } else {
            switchon = false;
            return false;
        };
    });
    if (switchon) {
        categoriesSelected.push(category);
    };
    displayCalendar();
}

function toggleWeekMonth() {
    weekview = !weekview;
    displayCalendar();
};

function parseURLparams() {
    // Parse URL parameters to toggle categories
    const queryString = window.location.search;
    var urlParams = new URLSearchParams(queryString);

    if (urlParams.get("weekview") == "0") {
        weekview = false;
    };
    // test if all URL parameters are equal to one
    var notAllParamsOne = false;
    for (const category of categoriesAll) {
        if (urlParams.get(category) == "0") {
            notAllParamsOne = true;
        };
    };
    // select categories
    for (const category of categoriesAll) {
        if (urlParams.has(category)) {
            if (urlParams.get(category) != "0") {
                categoriesSelected.push(category);
            };
        } else if (notAllParamsOne) {
            categoriesSelected.push(category);
        };
    };
    // if no parameters are given, show all categories
    if (categoriesSelected.length == 0) {
        categoriesSelected = categoriesAll;
    };
}

function addParamsToURL() {
    // determine if parameters exclude items or include items
    var categoriesNotSelected = categoriesAll.filter((e) => !categoriesSelected.includes(e));
    var bit = "1";
    var categoriesParams = categoriesSelected;
    if (categoriesNotSelected.length < categoriesSelected.length) {
        bit = "0";
        categoriesParams = categoriesNotSelected;
    };
    //
    var ParamString = "";
    for (const category of categoriesParams) {
        ParamString += category + "=" + bit + "&";
    };
    if (weekview == false) {
        ParamString += "weekview=0&";
    };
    // prepend '?' and remove tailing '&'
    if (ParamString != "") {
        ParamString = "?" + ParamString.slice(0, -1);
    };
    //
    var newURL = location.href.split("?")[0]; //current URL without parameter
    window.history.pushState('object', document.title, newURL + ParamString); //update URL without reloading website
};

// keyboard navigation
document.addEventListener("keydown", logKey);

function logKey(event) {
    if (event.which == '37') {
        // left arrow: backwards
        if (weekview) {
            changeWeek(-1);
        } else {
            changeMonth(-1);
        };
    } else if (event.which == '39') {
        // right arrow: forwards
        if (weekview) {
            changeWeek(1);
        } else {
            changeMonth(1);
        };
    }
};

function BackToToday() {
    today = new Date();
    referenceDate = new Date();
    displayCalendar();
}

function updateToday() {
    let newtoday = new Date();
    if (newtoday.toDateString() != today.toDateString()) {
        today = new Date();
        referenceDate = new Date();
        displayCalendar();
    };
}

function accordionElement(title,content){
	return `<div class="accordion">
        <div class="accordion-header" onclick="toggleAccordion(this)">`+title+`<span class="arrow">&#xf054;</span></div>
        <div class="accordion-content">`+content+`</div>
    </div>
    `
}
function toggleAccordion(element) {
            var content = element.nextElementSibling;
            var arrow = element.querySelector('.arrow');
            
            if (element.classList.contains("active")) {
                element.classList.remove("active");
            } else {
                element.classList.add("active");
            }
       }
function toggleAccordion(element) {
            var accordions = document.querySelectorAll('.accordion-header');
            accordions.forEach(header => {
                if (header !== element) {
                    header.classList.remove("active");
                    header.nextElementSibling.style.maxHeight = null;
                    header.nextElementSibling.style.padding = "0 10px";
                }
            });
            
            element.classList.toggle("active");
            var content = element.nextElementSibling;
            if (element.classList.contains("active")) {
                content.style.maxHeight = "2000px";
                content.style.padding = "10px";
                element.scrollIntoView({ behavior: "smooth", block: "start" });
            } else {
                content.style.maxHeight = null;
                content.style.padding = "0 10px";
            }
        }

setInterval(updateToday, 60000); // check every minute if today's date has changed
