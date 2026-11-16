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

let today = new Date();
let referenceDate = new Date(); // used for navigation
let events = [];
let calendarName = "";
let missingEntrySymbol = "&#x2022;";
// mobile view on narrow screens (same width as index.html); there is no
// separate desktop/mobile switch here, so the view follows the screen width,
// also when a phone is rotated or a window resized
const mobileQuery = window.matchMedia("(max-width: 1300px)");
let is_mobile = mobileQuery.matches;
let calendarDrawn = false;
function onScreenWidthChange(query) {
    is_mobile = query.matches;
    if (calendarDrawn) {
        displayCalendar();
    };
}
if (mobileQuery.addEventListener) {
    mobileQuery.addEventListener('change', onScreenWidthChange);
} else { // older Safari
    mobileQuery.addListener(onScreenWidthChange);
};
let categoriesAll;

// main function to call the script
// name:       calendar title; a string, or an object like {de: '...', en: '...'}
// categories: CATEGORIES values from the ics file; these must not be translated
// options:    optional settings
//             options.lang – display language ('de', 'en'); default: lang attribute of <html>
function loadICS(icsFile, name, categories, options = {}) {
    initLanguage(options.lang);
    document.getElementById('calendar-header').innerHTML = t('loading');
    categoriesAll = categories;
    calendarName = translateValue(name);
    fetch(icsFile)
        .then(response => response.text())
        .then(data => parseICS(data))
        .catch(error => {
            console.error('FATAL ERROR: Could not load the ICS file:', error);
            parseICS("BEGIN:VCALENDAR\nEND:VCALENDAR");
            document.getElementById('calendar-error-message').innerHTML = t('loadError', {contact: CALENDAR_CONTACT + '.'});
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
    if (typeof clearMath === 'function') clearMath(); // forget old formulas before redrawing
    calendarDrawn = true;
    // the mobile styles apply whenever the mobile view is shown
    document.querySelector('.calendar-container').classList.toggle('calendar-mobile', is_mobile);
    let numberOfColumns = is_mobile ? 3 : 4; // no location column on mobile
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
    let header = document.getElementById('calendar-header');
    header.innerHTML = "";
    let title = document.createElement('div');
    title.id = 'calendar-title';
    title.title = t('tipCurrentSemester');
    title.addEventListener('click', function(event) {
        BackToToday();
    });
    // semester in its own span, so the mobile view can show it smaller
    // (built as one string: the span must be complete when it is assigned)
    let semesterName;
    if (winterterm) {
        semesterName = t('winterSemester', {
            y1: firstDayDisplayed.getFullYear(),
            y2: lastDayDisplayed.getFullYear()
        });
    } else {
        semesterName = t('summerSemester', {
            y: firstDayDisplayed.getFullYear()
        });
    };
    title.innerHTML = calendarName + "<br><span class='calendar-title-range'>" + semesterName + "</span>";

    let prev = document.createElement('button');
    prev.classList.add("setting-calendar-buttons");
    prev.title = t('tipLeftKey');
    prev.addEventListener('click', function() {
        changeTerm(-1);
    });
    let next = document.createElement('button');
    next.classList.add("setting-calendar-buttons");
    next.title = t('tipRightKey');
    next.addEventListener('click', function() {
        changeTerm(1);
    });

    let el;
    if (is_mobile) {
        // title on top, then large buttons: < Today >
        header.appendChild(title);
        let wrapper = document.createElement('div');
        wrapper.classList.add("mobile-calendar-button-wrapper");
        prev.innerHTML = "<";
        wrapper.appendChild(prev);
        el = document.createElement('button');
        el.classList.add("setting-calendar-buttons", "mobile-calendar-today-button");
        el.title = t('tipCurrentSemester');
        el.textContent = t('todayButton');
        el.addEventListener('click', function() {
            BackToToday();
        });
        wrapper.appendChild(el);
        next.innerHTML = ">";
        wrapper.appendChild(next);
        header.appendChild(wrapper);
    } else {
        prev.innerHTML = t('prevSemester');
        next.innerHTML = t('nextSemester');
        header.appendChild(prev);
        header.appendChild(title);
        header.appendChild(next);
    };

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
    if (!is_mobile) { // on mobile, the location is shown below the summary
        col = document.createElement('col');
        col.classList.add('semesterview-col-location');
        colGroup.appendChild(col);
    };
    calendar.appendChild(colGroup);

    let tableHead = document.createElement('thead');
    tableHead.id = "table-head";
    let elementTH = document.createElement('th');
    elementTH.textContent = t('colDate');
    elementTH.classList.add('semesterview-day');
    tableHead.appendChild(elementTH);
    elementTH = document.createElement('th');
    elementTH.textContent = t('colTime');
    tableHead.appendChild(elementTH);
    elementTH = document.createElement('th');
    elementTH.textContent = t('colSummary');
    tableHead.appendChild(elementTH);
    elementTH = document.createElement('th');
    elementTH.textContent = t('colLocation');
    tableHead.appendChild(elementTH);
    if (is_mobile) { // the column headings are self-evident and take up space on mobile
        tableHead.classList.add('calendar-hide-me');
    };
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
            TDelement.colSpan = numberOfColumns;
            let HRelement = document.createElement('hr');
            TDelement.appendChild(HRelement);
            currentRow.appendChild(TDelement);
            tbody.appendChild(currentRow);

            // thick horizontal separator
            currentRow = document.createElement('tr');
            currentRow.classList.add('calendar-today-separator');
            currentRow.classList.add('calendar-today-separator-top');
            TDelement = document.createElement('td');
            TDelement.colSpan = numberOfColumns;
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
            FirstColumnEntry.classList.add('semesterview-calendar-today-date');
            FirstColumnEntry.innerHTML = t('today') + "<br>" + currentDay.toLocaleDateString(locale, {
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
                eventTD.classList.add('semesterview-event', 'semesterview-event-time', 'semesterview-calendar-today-event');
                if (event.allDayEvent) {
                    eventTD.innerHTML = missingEntrySymbol;
                } else {
                    eventTD.innerHTML = event.startDate.toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit"
                    }) + "<br>–<br>" + event.endDate.toLocaleTimeString(locale, {
                        hour: "2-digit",
                        minute: "2-digit"
                    });
                };
                currentRow.appendChild(eventTD);

                // details
                eventTD = document.createElement('td');
                eventTD.classList.add('semesterview-event', 'semesterview-event-summary', 'semesterview-calendar-today-event', 'calendar-today-event');
                el = document.createElement('b');
                el.innerHTML = event.summary;
                eventTD.appendChild(el);
                if (is_mobile) {
                    addLocationLine(eventTD, event);
                };
                el = document.createElement('p');
                // now replace all line breaks with <br. tags
                // the following regex hack is taken from
                // https://stackoverflow.com/questions/784539/how-do-i-replace-all-line-breaks-in-a-string-with-br-elements
                el.innerHTML = linkifyStr(event.description,{className: "linkInCalendarAbstract"}).replace(/(?:\r\n|\r|\n)/g, '<br>');
                eventTD.appendChild(el);
                currentRow.appendChild(eventTD);
                if (is_mobile) {
                    tbody.appendChild(currentRow);
                    return; // no location column on mobile
                };

                // location
                eventTD = document.createElement('td');
                eventTD.classList.add('semesterview-event', 'semesterview-event-location', 'semesterview-calendar-today-event');
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
                eventTD.innerHTML = "<i>" + t('noEvents') + "</i>";
                eventTD.classList.add('no-events-to-display');
                currentRow.appendChild(eventTD);
                tbody.appendChild(currentRow);
            };

            // thick horizontal separator
            currentRow = document.createElement('tr');
            currentRow.classList.add('calendar-today-separator');
            currentRow.classList.add('calendar-today-separator-bottom');
            TDelement = document.createElement('td');
            TDelement.colSpan = numberOfColumns;
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
                    TDelement.colSpan = numberOfColumns;
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
                    FirstColumnEntry.textContent = currentDay.toLocaleDateString(locale, {
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
                    eventTD.textContent = event.startDate.toLocaleTimeString(locale, {
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
                if (is_mobile) {
                    addLocationLine(eventTD, event);
                    tbody.appendChild(currentRow);
                    return; // no location column on mobile
                };

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
        document.getElementById('table-head').classList.add('calendar-hide-me');
        let currentRow = document.createElement('tr');
        let TDelement = document.createElement('td');
        TDelement.colSpan = numberOfColumns;
        TDelement.innerHTML = "<i>" + t('noEvents') + "</i>";
        currentRow.appendChild(TDelement);
        tbody.appendChild(currentRow);
    };
    calendar.appendChild(tbody);
    if (typeof typesetMath === 'function') typesetMath(); // typeset TeX in the new content
}

// mobile view: location as a small line inside the summary cell (if known);
// the summary cell then also gets the rounded right end
function addLocationLine(summaryTD, event) {
    summaryTD.classList.add('semesterview-event-summary-mobile');
    if (event.location == missingEntrySymbol) {
        return;
    };
    let locationLine = document.createElement('div');
    locationLine.classList.add('semesterview-event-location-inline');
    locationLine.innerHTML = event.location;
    summaryTD.appendChild(locationLine);
}

function openModal(event) {
    if (typeof clearMath === 'function') clearMath(); // forget old formulas before redrawing
    document.body.classList.add('calendar-no-scroll');
    if (event.singleDayEvent) {
        document.getElementById('calendar-modal-title').textContent =
            event.startDate.toLocaleDateString(locale, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
    } else if (event.allDayEvent) {
        // event.singleDayEvent = false 
        document.getElementById('calendar-modal-title').textContent =
            event.startDate.toLocaleDateString(locale, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }) + " – " +
            event.endDate.toLocaleDateString(locale, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            });
    } else {
        document.getElementById('calendar-modal-title').textContent =
            event.startDate.toLocaleDateString(locale, {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
            }) +
            ", " +
            event.startDate.toLocaleTimeString(locale, {
                hour: "numeric",
                minute: "2-digit"
            }) +
            "–" +
            event.endDate.toLocaleTimeString(locale, {
                hour: "numeric",
                minute: "2-digit"
            });
    };
    document.getElementById('calendar-modal-body').innerHTML = "";
    el = document.createElement('div');
    el.classList.add("calendar-summary");
    el.innerHTML = event.summary;
    document.getElementById('calendar-modal-body').appendChild(el);
    el = document.createElement('div');
    el.classList.add("calendar-location");
    if (event.location == missingEntrySymbol) {
        el.innerHTML = t('unknownLocation');
    } else {
        el.innerHTML = event.location;
    };
    document.getElementById('calendar-modal-body').appendChild(el);

    //el = document.createElement('button');
    //el.classList.add('toggle-calendar-buttons');
    //el.disabled = true;
    //el.innerHTML = event.mainCategory;
    //el.style.backgroundColor = categoryColors[event.mainCategory];
    //document.getElementById('calendar-modal-body').appendChild(el);
    //console.log(event.allCategoriesRaw);
    //console.log(event.allCategories);
    event.allCategories.forEach(cat => {
        el = document.createElement('button');
        el.classList.add('toggle-calendar-buttons', 'dummy-calendar-button');
        el.disabled = true;
        el.innerHTML = cat;
        document.getElementById('calendar-modal-body').appendChild(el);
    });

    el = document.createElement('p');
    el.classList.add("calendar-abstract");
    // now replace all line breaks with <br. tags
    // the following regex hack is taken from
    // https://stackoverflow.com/questions/784539/how-do-i-replace-all-line-breaks-in-a-string-with-br-elements
    el.innerHTML = linkifyStr(event.description,{className: "linkInCalendarAbstract"}).replace(/(?:\r\n|\r|\n)/g, '<br>');
    document.getElementById('calendar-modal-body').appendChild(el);
    document.getElementById('calendar-modal-body').appendChild(closeModalButton());
    document.getElementById('event-calendar-modal').style.display = 'flex'; //necessary to show modal
    if (typeof typesetMath === 'function') typesetMath(); // typeset TeX in the new content
}

function closeModalButton() {
    let el = document.createElement('div');
    el.classList.add("calendar-modal-center-container");
    let button = document.createElement('button');
    button.classList.add('toggle-calendar-buttons', "setting-calendar-buttons");
    button.innerHTML = t('close');
    button.addEventListener('click', function() {
        document.getElementById('event-calendar-modal').style.display = 'none';
        document.body.classList.remove('calendar-no-scroll');
    });
    el.appendChild(button);
    return el;
};

// The event window must not be covered by fixed elements of the surrounding
// page (such as a website's header bar). A high z-index alone is not enough if
// the page puts the calendar into its own stacking context, so the window is
// moved to the end of <body>.
document.body.appendChild(document.getElementById('event-calendar-modal'));

// close modal
document.getElementById('event-calendar-modal').addEventListener('click', function(event) {
    // only close if we click in the transparent area outside the modal content
    if (event.currentTarget !== event.target) {
        return;
    }
    document.getElementById('event-calendar-modal').style.display = 'none';
    document.body.classList.remove('calendar-no-scroll');
});

function changeTerm(offset) {
    referenceDate.setMonth(referenceDate.getMonth() + offset * 6);
    displayCalendar();
}

// keyboard navigation
document.addEventListener("keydown", logKey);

// swipe left/right on the calendar to go to the next/previous semester (mobile only)
let swipeStart = null;
document.addEventListener('touchstart', function(event) {
    swipeStart = null;
    if (!is_mobile || event.touches.length != 1) { return; };
    if (!event.target.closest('.calendar-semesterview')) { return; };
    swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', function(event) {
    if (!swipeStart) { return; };
    let dx = event.changedTouches[0].clientX - swipeStart.x;
    let dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    // only clearly horizontal swipes, so that scrolling the page still works
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
        changeTerm(dx < 0 ? 1 : -1);
    };
}, { passive: true });

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
