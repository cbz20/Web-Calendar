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
let calendarName = "";
let missingEntrySymbol = "&#x2022;";
let categoriesAll;

// main function to call the script
function loadICS(icsFile, name, categories) {
    categoriesAll = categories;
    calendarName = name;
    fetch(icsFile)
        .then(response => response.text())
        .then(data => parseICS(data))
        .catch(error => {
            console.error('FATAL ERROR: Fehler beim Laden der ICS-Datei:', error);
            parseICS("BEGIN:VCALENDAR\nEND:VCALENDAR");
            document.getElementById('error-message').innerHTML = "Fehler beim Laden der Kalender-Quelldateien.<br/>Bitte kontaktieren Sie <div class='modal-center-container'>Termine-Mathe@ruhr-uni-bochum.de.</div>";
        });
}

function parseICS(icsData) {
    let jcalData = ICAL.parse(icsData);
    let vcalendar = new ICAL.Component(jcalData);
    let vevents = vcalendar.getAllSubcomponents('vevent');

    events = vevents.map(event => {
        // see https://icalendar.org/iCalendar-RFC-5545/3-6-1-event-component.html

        // if an event has no start date or no summary, we ignore the event
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
        let allCategories = [];

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
        if (allCategories.length == 0) {
            allCategories.push("none");
        };
        let mainCategory = allCategories[0];
        
        // filter out those events with no matching categories
        let matchingCategories = categoriesAll.filter( cat => allCategories.includes(cat));
        if (matchingCategories.length == 0){
            return {};
        };

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
            // note: display order is reversed in semesterview
            startDate.setHours(23, 59, 59, 999);
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
    });
    //console.log(events);
    events = events.filter(event => Object.keys(event).length > 0);
    displayCalendar();
}

function displayCalendar() {
    let referenceMonth = (referenceDate.getMonth() + 3) % 6;
    // first day of semester containing referenceDate
    let firstDayDisplayed = new Date(referenceDate.valueOf());
    firstDayDisplayed.setMonth(firstDayDisplayed.getMonth() - referenceMonth);
    firstDayDisplayed.setDate(1);
    firstDayDisplayed.setHours(0, 0, 0, 0);
    // last day of semester containing referenceDate
    let lastDayDisplayed = new Date(referenceDate.valueOf());
    lastDayDisplayed.setMonth(lastDayDisplayed.getMonth() - referenceMonth + 6);
    lastDayDisplayed.setDate(0);
    lastDayDisplayed.setHours(23, 59, 59, 999);
    // decide if semester is a winter term
    let winterterm = true;
    let currentYear = firstDayDisplayed.getYear();
    if (firstDayDisplayed.getMonth() == 3) {
        winterterm = false;
    };
    // iterator for date
    // compare with beginning of the day (safer than end of day)
    let currentDay = new Date(lastDayDisplayed.valueOf());
    currentDay.setHours(0, 0, 0, 0);
    //console.log(referenceDate);
    //console.log(firstDayDisplayed);
    //console.log(lastDayDisplayed);

    // page title with navigation buttons
    document.getElementById('calendar-header').innerHTML = "";
    let el = document.createElement('button');
    el.classList.add("setting-buttons");
    el.title = "linke Pfeiltaste drücken";
    el.innerHTML = "< Früheres Semester";
    el.addEventListener('click', function() {
        changeTerm(-1);
    });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('div');
    el.id = 'calendar-title';
    el.title = "springe zum aktuellen Semester";
    el.addEventListener('click', function(event) {
        BackToToday();
    });
    el.innerHTML = calendarName;
    if (winterterm) {
        el.innerHTML += "<br>Wintersemester " +
            firstDayDisplayed.toLocaleString('de-DE', {
                year: 'numeric'
            }) +
            "­/" +
            lastDayDisplayed.toLocaleString('de-DE', {
                year: 'numeric'
            });
    } else {
        el.innerHTML += "<br>Sommersemester " +
            firstDayDisplayed.toLocaleString('de-DE', {
                year: 'numeric'
            })
    };
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('button');
    el.classList.add("setting-buttons");
    el.title = "rechte Pfeiltaste drücken";
    el.addEventListener('click', function() {
        changeTerm(1);
    });
    el.innerHTML = "Nächstes Semester >";
    document.getElementById('calendar-header').appendChild(el);

    // calendar headings
    let calendar = document.getElementById('calendar-semesterview');
    calendar.innerHTML = '';

    let colGroup = document.createElement('colgroup');
    let col = document.createElement('col');
    col.classList.add('semesterview-col-date');
    colGroup.appendChild(col);
    col = document.createElement('col');
    col.classList.add('semesterview-col-time');
    colGroup.appendChild(col);
    col = document.createElement('col');
    col.classList.add('semesterview-col-summary');
    colGroup.appendChild(col);
    col = document.createElement('col');
    col.classList.add('semesterview-col-location');
    colGroup.appendChild(col);
    calendar.appendChild(colGroup);

    let tableHead = document.createElement('thead');
    tableHead.id = "table-head";
    let elementTH = document.createElement('th');
    elementTH.textContent = "Datum";
    elementTH.classList.add('semesterview-day');
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
    let termEvents = events.filter(event => {
        if (event.endDate < firstDayDisplayed) {
            return false;
        };
        if (event.startDate > lastDayDisplayed) {
            return false;
        };
        return true;
    });

    // iterate through all displayed days
    let tbody = document.createElement('tbody');
    let noEventsShown = true;
    for (let day = 0; day < 365; day++) {
        let isToday = currentDay.toDateString() == today.toDateString();
        // for testing only
        //isToday = 
        //    currentDay.getDate() == today.getDate()-3 &&
        //    currentDay.getMonth() == today.getMonth() &&
        //    currentDay.getYear() == today.getYear();

        // Ereignisse für den Tag filtern
        let dayEvents = termEvents.filter(event => {
            // Zeige alle eintägigen und mehrtägigen Ereignisse korrekt an
            return (((event.startDate.toDateString() === currentDay.toDateString()) ||
                (currentDay >= event.startDate && currentDay <= event.endDate)));
        });
        // sort events by start date
        dayEvents.sort((a, b) => a.startDate - b.startDate);
        let NumberOfDayEvents = dayEvents.length;

        if (isToday) {
            // standard horizontal separator
            let currentRow = document.createElement('tr');
            let TDelement = document.createElement('td');
            TDelement.colSpan = "4";
            let HRelement = document.createElement('hr');
            TDelement.appendChild(HRelement);
            currentRow.appendChild(TDelement);
            tbody.appendChild(currentRow);

            // thick horizontal separator
            currentRow = document.createElement('tr');
            currentRow.classList.add('today-separator');
            currentRow.classList.add('today-separator-top');
            TDelement = document.createElement('td');
            TDelement.colSpan = "4";
            HRelement = document.createElement('hr');
            TDelement.appendChild(HRelement);
            currentRow.appendChild(TDelement);
            tbody.appendChild(currentRow);

            // event row
            // day entry
            currentRow = document.createElement('tr');
            let FirstColumnEntry = document.createElement('td');
            FirstColumnEntry.classList.add('semesterview-day');
            if (NumberOfDayEvents > 1) {
                FirstColumnEntry.rowSpan = NumberOfDayEvents;
            };
            FirstColumnEntry.classList.add('semesterview-today-date');
            FirstColumnEntry.innerHTML = "heute<br>" + currentDay.toLocaleDateString('de', {
                weekday: "short",
                month: "numeric",
                day: "numeric",
            });
            currentRow.appendChild(FirstColumnEntry);

            // event entries
            var firstevent = true;
            dayEvents.forEach(event => {
                noEventsShown = false;
                if (firstevent) {
                    firstevent = false;
                } else {
                    currentRow = document.createElement('tr');
                };

                // time
                let eventTD = document.createElement('td');
                eventTD.classList.add('semesterview-event', 'semesterview-event-time', 'semesterview-today-event');
                if (event.allDayEvent) {
                    eventTD.innerHTML = missingEntrySymbol;
                } else {
                    eventTD.innerHTML = event.startDate.toLocaleTimeString('de', {
                        hour: "2-digit",
                        minute: "2-digit"
                    }) + "<br>–<br>" + event.endDate.toLocaleTimeString('de', {
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                };
                currentRow.appendChild(eventTD);

                // details
                eventTD = document.createElement('td');
                eventTD.classList.add('semesterview-event', 'semesterview-event-summary', 'semesterview-today-event', 'today-event');
                el = document.createElement('b');
                el.innerHTML = event.summary;
                eventTD.appendChild(el);
                el = document.createElement('p');
                // now replace all line breaks with <br. tags
                // the following regex hack is taken from
                // https://stackoverflow.com/questions/784539/how-do-i-replace-all-line-breaks-in-a-string-with-br-elements
                el.innerHTML = event.description.replace(/(?:\r\n|\r|\n)/g, '<br>');
                eventTD.appendChild(el);
                currentRow.appendChild(eventTD);

                // location
                eventTD = document.createElement('td');
                eventTD.classList.add('semesterview-event', 'semesterview-event-location', 'semesterview-today-event');
                eventTD.innerHTML = event.location;
                currentRow.appendChild(eventTD);
                //
                tbody.appendChild(currentRow);
            });
            if (NumberOfDayEvents == 0) {
                // time column
                let eventTD = document.createElement('td');
                currentRow.appendChild(eventTD);
                // summary column
                eventTD = document.createElement('td');
                eventTD.innerHTML = "<i> — keine Veranstaltungen —</i>";
                eventTD.classList.add('no-events-to-display');
                currentRow.appendChild(eventTD);
                tbody.appendChild(currentRow);
            };

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

        } else { // isToday=false
            var firstevent = true;
            dayEvents.forEach(event => {
                noEventsShown = false;
                let currentRow = document.createElement('tr');
                if (firstevent) {
                    firstevent = false;
                    // horizontal separator
                    let TDelement = document.createElement('td');
                    TDelement.colSpan = "4";
                    let HRelement = document.createElement('hr');
                    TDelement.appendChild(HRelement);
                    currentRow.appendChild(TDelement);
                    tbody.appendChild(currentRow);

                    // day entry
                    currentRow = document.createElement('tr');
                    let FirstColumnEntry = document.createElement('td');
                    if (currentDay < today) {
                        FirstColumnEntry.classList.add('semesterview-day-past');
                    } else {
                        FirstColumnEntry.classList.add('semesterview-day');
                    };
                    FirstColumnEntry.rowSpan = NumberOfDayEvents;
                    FirstColumnEntry.textContent = currentDay.toLocaleDateString('de', {
                        weekday: "short",
                        month: "numeric",
                        day: "numeric",
                    });
                    currentRow.appendChild(FirstColumnEntry);
                };

                // time
                let eventTD = document.createElement('td');
                if (currentDay < today) {
                    eventTD.classList.add('semesterview-event-past', 'semesterview-event-time');
                } else {
                    eventTD.classList.add('semesterview-event', 'semesterview-event-time');
                };
                if (event.allDayEvent) {
                    eventTD.innerHTML = missingEntrySymbol;
                } else {
                    eventTD.textContent = event.startDate.toLocaleTimeString('de', {
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                };
                eventTD.addEventListener('click', function() {
                    openModal(event);
                });
                currentRow.appendChild(eventTD);

                // summary
                eventTD = document.createElement('td');
                if (currentDay < today) {
                    eventTD.classList.add('semesterview-event-past', 'semesterview-event-summary');
                } else {
                    eventTD.classList.add('semesterview-event', 'semesterview-event-summary');
                };
                eventTD.innerHTML = event.summary;
                eventTD.addEventListener('click', function() {
                    openModal(event);
                });
                currentRow.appendChild(eventTD);

                // location
                eventTD = document.createElement('td');
                if (currentDay < today) {
                    eventTD.classList.add('semesterview-event-past', 'semesterview-event-location');
                } else {
                    eventTD.classList.add('semesterview-event', 'semesterview-event-location');
                };
                eventTD.innerHTML = event.location;
                eventTD.addEventListener('click', function() {
                    openModal(event);
                });
                currentRow.appendChild(eventTD);
                tbody.appendChild(currentRow);
            });

        };
        // increment currentDay
        currentDay.setDate(currentDay.getDate() - 1);
        if (currentDay < firstDayDisplayed) {
            break;
        };
    }
    if (noEventsShown) {
        document.getElementById('table-head').classList.add('hide-me');
        let currentRow = document.createElement('tr');
        let TDelement = document.createElement('td');
        TDelement.colSpan = "4";
        TDelement.innerHTML = "<i>— keine Veranstaltungen eingetragen —</i>";
        currentRow.appendChild(TDelement);
        tbody.appendChild(currentRow);
    };
    calendar.appendChild(tbody);
}

function openModal(event) {
    document.body.classList.add('no-scroll');
    if (event.singleDayEvent) {
        document.getElementById('modal-title').textContent =
            event.startDate.toLocaleDateString('de-de', {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
    } else if (event.allDayEvent) {
        // event.singleDayEvent = false 
        document.getElementById('modal-title').textContent =
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
        document.getElementById('modal-title').textContent =
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
    document.getElementById('modal-body').innerHTML = "";
    el = document.createElement('div');
    el.classList.add("summary");
    el.innerHTML = event.summary;
    document.getElementById('modal-body').appendChild(el);
    el = document.createElement('div');
    el.classList.add("location");
    if (event.location == missingEntrySymbol) {
        el.innerHTML = "Ort unbekannt";
    } else {
        el.innerHTML = event.location;
    };
    document.getElementById('modal-body').appendChild(el);

    //el = document.createElement('button');
    //el.classList.add('toggle-buttons');
    //el.disabled = true;
    //el.innerHTML = event.mainCategory;
    //el.style.backgroundColor = categoryColors[event.mainCategory];
    //document.getElementById('modal-body').appendChild(el);
    //console.log(event.allCategoriesRaw);
    //console.log(event.allCategories);
    event.allCategories.forEach(cat => {
        el = document.createElement('button');
        el.classList.add('toggle-buttons', 'dummy-button');
        el.disabled = true;
        el.innerHTML = cat;
        document.getElementById('modal-body').appendChild(el);
    });

    el = document.createElement('p');
    el.classList.add("abstract");
    // now replace all line breaks with <br. tags
    // the following regex hack is taken from
    // https://stackoverflow.com/questions/784539/how-do-i-replace-all-line-breaks-in-a-string-with-br-elements
    el.innerHTML = linkifyStr(event.description,{className: "linkInAbstract"}).replace(/(?:\r\n|\r|\n)/g, '<br>');
    document.getElementById('modal-body').appendChild(el);
    document.getElementById('modal-body').appendChild(closeModalButton());
    document.getElementById('event-modal').style.display = 'flex'; //necessary to show modal
}

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

function changeTerm(offset) {
    referenceDate.setMonth(referenceDate.getMonth() + offset * 6);
    displayCalendar();
}

// keyboard navigation
document.addEventListener("keydown", logKey);

function logKey(event) {
    if (event.which == '37') {
        // left arrow: backwards
        changeTerm(-1);
    } else if (event.which == '39') {
        // right arrow: forwards
        changeTerm(1);
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

setInterval(updateToday, 60000); // check every minute if today's date has changed
