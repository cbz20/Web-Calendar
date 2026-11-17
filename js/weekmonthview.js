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
let categoriesSelected = []; // toggled catgeories
let calendarName = "";
let missingEntrySymbol = "&#x2022;";
let categoriesAll;
let categoryColors;
let svgFiles;
let icsLinks;
let categoryLabels = {};
let weekview = true;
let is_mobile = window.matchMedia("(max-width: 1300px)").matches;

// main function to call the script
// name:    calendar title; a string, or an object like {de: '...', en: '...'}
// options: optional settings
//          options.lang   – display language ('de', 'en'); default: lang attribute of <html>
//          options.labels – display names of the categories per language, e.g.
//                           {en: {'Topologie': 'Topology'}}; categories without a label show their key
function loadICS(name, colours, links, svgs, options = {}) {
    initLanguage(options.lang);
    document.getElementById('calendar-header').innerHTML = t('loading');
    categoriesAll = Object.keys(colours);
    categoryColors = colours;
    calendarName = translateValue(name);
    svgFiles = svgs;
    icsLinks = links;
    categoryLabels = options.labels || {};
    parseURLparams();
    parseICS(links)
    	.then(() => displayCalendar())
    	.catch(error => {
            console.error('FATAL ERROR: Could not load the ICS files:', error);
            displayCalendar()
            document.getElementById('calendar-error-message').innerHTML = t('loadError', {contact: CALENDAR_CONTACT + '.'});
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

// title of the week view, e.g. "Woche vom 16.11.2026 bis 22.11.2026"
function weekTitle(firstDay, lastDay) {
    let options = {
        month: 'numeric',
        year: 'numeric',
        day: 'numeric'
    };
    return calendarName + "<br><span class='calendar-title-range'>" + t('weekRange', {
        from: firstDay.toLocaleDateString(locale, options),
        to: lastDay.toLocaleDateString(locale, options)
    }) + "</span>";
}

// display name of a category in the current language
// (the category itself stays the key for colours, links and URL parameters)
function categoryLabel(category) {
    let labels = categoryLabels[lang] || {};
    return labels[category] || category;
}

function displayCalendar() {
    if (typeof clearMath === 'function') clearMath(); // forget old formulas before redrawing
    // the mobile styles apply whenever the mobile view is shown, whatever the screen width
    document.querySelector('.calendar-container').classList.toggle('calendar-mobile', is_mobile);
    if (weekview || is_mobile) {
        drawWeekView();
    } else {
        drawMonthView();
    };
    drawToggleButtons();
    toggleMode();
    if (typeof typesetMath === 'function') typesetMath(); // typeset TeX in the new content
}

function toggleMode() {
    let div = document.getElementById('calendar-togglemode');
    // onclick (not addEventListener): this runs on every redraw,
    // and the handler must be replaced, not added once more
    if (is_mobile){
        div.innerHTML = t('viewDesktop');
        div.onclick = function() {
            is_mobile = false;
            displayCalendar();
        };
    } else {
        div.innerHTML = t('viewMobile');
        div.onclick = function() {
            is_mobile = true;
            displayCalendar();
        };
    };
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
    if (is_mobile){
        el = document.createElement('div');
        el.id = 'calendar-title';
        el.title = t('tipCurrentWeek');
        el.addEventListener('click', function(event) {
            BackToToday();
        });
        el.innerHTML = weekTitle(firstDayDisplayed, lastDayDisplayed);
        document.getElementById('calendar-header').appendChild(el);
        
        let wrapper = document.createElement('div');
        el = document.createElement('button');
        el.classList.add("setting-calendar-buttons");
        el.title = t('tipLeftKey');
        el.innerHTML = "<";
        el.addEventListener('click', function() {
            changeWeek(-1);
        });
        wrapper.appendChild(el);
        wrapper.classList.add("mobile-calendar-button-wrapper");

        el = document.createElement('button');
        el.classList.add("setting-calendar-buttons", "mobile-calendar-today-button");
        el.title = t('tipCurrentWeek');
        el.textContent = t('todayButton');
        el.addEventListener('click', function() {
            BackToToday();
        });
        wrapper.appendChild(el);

        el = document.createElement('button');
        el.classList.add("setting-calendar-buttons");
        el.title = t('tipRightKey');
        el.addEventListener('click', function() {
            changeWeek(1);
        });
        el.innerHTML = ">";
        wrapper.appendChild(el);
        
        document.getElementById('calendar-header').appendChild(wrapper);
    } else {
        el = document.createElement('button');
        el.classList.add("setting-calendar-buttons");
        el.title = t('tipLeftKey');
        el.innerHTML = t('prevWeek');
        el.addEventListener('click', function() {
            changeWeek(-1);
        });
        document.getElementById('calendar-header').appendChild(el);

        el = document.createElement('div');
        el.id = 'calendar-title';
        el.title = t('tipCurrentWeek');
        el.addEventListener('click', function(event) {
            BackToToday();
        });
        el.innerHTML = weekTitle(firstDayDisplayed, lastDayDisplayed);
        document.getElementById('calendar-header').appendChild(el);

        el = document.createElement('button');
        el.classList.add("setting-calendar-buttons");
        el.title = t('tipRightKey');
        el.addEventListener('click', function() {
            changeWeek(1);
        });
        el.innerHTML = t('nextWeek');
        document.getElementById('calendar-header').appendChild(el);
    };
    // calendar headings
    document.getElementById('calendar-monthview').innerHTML = '';
    let calendar = document.getElementById('calendar-weekview');
    calendar.innerHTML = '';

    let numberOfColumns = is_mobile ? 3 : 4; // no location column on mobile
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
    if (!is_mobile) { // on mobile, the location is shown below the summary
        col = document.createElement('col');
        col.classList.add('weekview-col-location');
        colGroup.appendChild(col);
    };
    calendar.appendChild(colGroup);

    let tableHead = document.createElement('thead');
    let elementTH = document.createElement('th');
    elementTH.textContent = t('colDate');
    elementTH.classList.add('weekview-day');
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
    if (!is_mobile) { // the column headings are self-evident and take up space on mobile
        calendar.appendChild(tableHead);
    };

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
        TDelement.colSpan = numberOfColumns;
        let HRelement = document.createElement('hr');
        TDelement.appendChild(HRelement);
        currentRow.appendChild(TDelement);
        tbody.appendChild(currentRow);

        if (isToday) {
            // thick horizontal separator
            let currentRow = document.createElement('tr');
            currentRow.classList.add('calendar-today-separator');
            currentRow.classList.add('calendar-today-separator-top');
            TDelement = document.createElement('td');
            TDelement.colSpan = numberOfColumns;
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
            FirstColumnEntry.classList.add('weekview-calendar-today-date');
            FirstColumnEntry.innerHTML = t('today') + "<br>" + currentDay.toLocaleDateString(locale, {
                weekday: "short",
                month: "numeric",
                day: "numeric",
            });
        } else {
            FirstColumnEntry.textContent = currentDay.toLocaleDateString(locale, {
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
                eventTD.textContent = event.startDate.toLocaleTimeString(locale, {
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

            if (is_mobile) {
                // location as a small second line below the summary (if known)
                eventTD.classList.add('weekview-event-summary-mobile');
                if (event.location != missingEntrySymbol) {
                    let locationLine = document.createElement('div');
                    locationLine.classList.add('weekview-event-location-inline');
                    locationLine.innerHTML = event.location;
                    eventTD.appendChild(locationLine);
                };
                tbody.appendChild(currentRow);
                return; // no location column on mobile
            };

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
                eventTD.innerHTML = "<i>" + t('noEvents') + "</i>";
                eventTD.classList.add('no-events-to-display');
                currentRow.appendChild(eventTD);
            };
            tbody.appendChild(currentRow);
        };
        if (isToday) {
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
    el.classList.add("setting-calendar-buttons");
    el.title = t('tipLeftKey');
    el.innerHTML = t('prevMonth');
    el.addEventListener('click', function() {
        changeMonth(-1);
    });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('div');
    el.id = 'calendar-title';
    el.title = t('tipCurrentMonth');
    el.addEventListener('click', function(event) {
        BackToToday();
    });
    el.innerHTML = calendarName + "<br>" + firstDay.toLocaleString(locale, {
        month: 'long',
        year: 'numeric'
    });
    document.getElementById('calendar-header').appendChild(el);

    el = document.createElement('button');
    el.classList.add("setting-calendar-buttons");
    el.title = t('tipRightKey');
    el.addEventListener('click', function() {
        changeMonth(1);
    });
    el.innerHTML = t('nextMonth');
    document.getElementById('calendar-header').appendChild(el);

    // calendar headings
    let calendar = document.getElementById('calendar-monthview');
    calendar.innerHTML = '';
    document.getElementById('calendar-weekview').innerHTML = '';
    // table header with week days
    let daysOfWeek = t('weekdaysShort'); // starting with Sunday
    daysOfWeek.forEach((day, index) => {
        let dayHeader = document.createElement('div');
        dayHeader.textContent = day;
        if (index == 0 || index == 6) {
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
                eventDiv.textContent = event.startDate.toLocaleTimeString(locale, {
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
    let buttons = document.getElementById('toggle-calendar-buttons-header');
    buttons.innerHTML = '';
    // Toggle Week/Month View Button (desktop only; mobile always shows the week view)
    if (!is_mobile) {
        button = document.createElement('button');
        buttonImage = document.createElement('img');
        if (weekview) {
            buttonImage.src = svgFiles['month'];
            button.title = t('tipToMonth');
        } else {
            buttonImage.src = svgFiles['week'];
            button.title = t('tipToWeek');
        };
        buttonImage.classList.add('calendar-svg-icon');
        button.classList.add('toggle-calendar-buttons');
        button.classList.add('setting-calendar-buttons');
        button.appendChild(buttonImage);
        button.addEventListener('click', function() {
            toggleWeekMonth();
        });
        buttons.appendChild(button);
    };
    // Toggle-Buttons generieren
    for (const category of categoriesAll) {
        button = document.createElement('a');
        button.classList.add("toggle-calendar-buttons");
        input = document.createElement('input');
        input.classList.add('calendar-checkbox');
        input.type = "checkbox";
        input.id = category;
        input.title = t('tipToggleCalendar');
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
        label.textContent = categoryLabel(category);
        label.classList.add("calendar-label");
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
    // help and save buttons, kept together (on mobile in a line of their own)
    let actionButtons = document.createElement('span');
    actionButtons.classList.add('calendar-action-buttons');
    // Show Help Button
    help = document.createElement('button');
    help.classList.add('toggle-calendar-buttons');
    help.title = t('tipHelp');
    help.innerHTML = t('help');
    help.id = "calendar-help";
    help.addEventListener('click', function() {
        showHelp();
    });
    actionButtons.appendChild(help);
    // Save URL Parameters Button
    button = document.createElement('button');
    buttonImage = document.createElement('img');
    buttonImage.classList.add('calendar-svg-icon');
    buttonImage.src = svgFiles['save'];
    button.classList.add('toggle-calendar-buttons', 'setting-calendar-buttons');
    button.title = t('tipSaveSettings');
    button.appendChild(buttonImage);
    button.addEventListener('click', function() {
        addParamsToURL();
    });
    actionButtons.appendChild(button);
    buttons.appendChild(actionButtons);
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
        el.innerHTML = categoryLabel(cat);
        if (categoriesAll.includes(cat)) {
            el.style.backgroundColor = categoryColors[cat];
        } else {
            el.style.backgroundColor = categoryColors[event.mainCategory];
        };
        document.getElementById('calendar-modal-body').appendChild(el);
    });

    el = document.createElement('p');
    el.classList.add("calendar-abstract");
    // now replace all line breaks with <br. tags
    // the following regex hack is taken from
    // https://stackoverflow.com/questions/784539/how-do-i-replace-all-line-breaks-in-a-string-with-br-elements
    el.innerHTML = formatDescription(event.description); // see i18n.js
    document.getElementById('calendar-modal-body').appendChild(el);
    document.getElementById('calendar-modal-body').appendChild(closeModalButton());
    document.getElementById('event-calendar-modal').style.display = 'flex'; //necessary to show modal
    if (typeof typesetMath === 'function') typesetMath(); // typeset TeX in the new content
}

function showHelp(event) {
    if (typeof clearMath === 'function') clearMath(); // forget old formulas before redrawing
    document.body.classList.add('calendar-no-scroll');
    document.getElementById('calendar-modal-title').textContent = t('helpTitle');
    let urls = "<li><b class='calendar-blue'>";
    urls += t('allCalendars');
    urls += ": </b>"; 
    urls += copyButton("https://mail.ruhr-uni-bochum.de/SOGo/dav/public/termixxd/Calendar/");
    urls += "https://mail.ruhr-uni-bochum.de/SOGo/dav/public/termixxd/Calendar/"
    urls += "</li>";
    for (const category of categoriesAll){
    	urls += "<li><b class='calendar-blue'>";
    	urls += categoryLabel(category);
    	urls += ": </b>";
    	urls += copyButton(icsLinks[category]);
    	urls += icsLinks[category];
    	urls += "</li>";
    };
    let urls_with_auth = "";
    for (const category of categoriesAll){
    	let authUrl = icsLinks[category].replace(/public\//g,'').replace(/.ics/g,'\/');
    	urls_with_auth += "<li><b class='calendar-blue'>";
    	urls_with_auth += categoryLabel(category);
    	urls_with_auth += ": </b>";
    	urls_with_auth += copyButton(authUrl);
    	urls_with_auth += authUrl;
    	urls_with_auth += "</li>";
    };
    
    let body = document.getElementById('calendar-modal-body');
    body.innerHTML = "";
    body.innerHTML += accordionElement(t('helpBasicsTitle'), helpText('basics', svgFiles));
    body.innerHTML += accordionElement(t('helpSubscribeTitle'), helpText('subscribe', urls));
    body.innerHTML += accordionElement(t('helpEditTitle'), helpText('edit', urls_with_auth));
    body.innerHTML += accordionElement(t('helpAboutTitle'), helpText('about'));
    body.appendChild(closeModalButton());
    document.getElementById('event-calendar-modal').style.display = 'flex'; //necessary to show modal
}

function copyButton(url) {
    return `<button 
    	class='toggle-calendar-buttons setting-calendar-buttons' 
    	title="` + t('tipCopyUrl') + `" 
    	onclick='navigator.clipboard.writeText("` + url + `").then(function() {
	    console.log("copied url");
	}, function() {
	    console.warn("error trying to copy url");
	});'>
	<img 
		src="`+svgFiles['copy']+`" 
		class="calendar-svg-icon">
	</button> `
};

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

// swipe left/right on the calendar to go to the next/previous week (mobile only)
let swipeStart = null;
document.addEventListener('touchstart', function(event) {
    swipeStart = null;
    if (!is_mobile || event.touches.length != 1) { return; };
    if (!event.target.closest('.calendar-weekview')) { return; };
    swipeStart = { x: event.touches[0].clientX, y: event.touches[0].clientY };
}, { passive: true });
document.addEventListener('touchend', function(event) {
    if (!swipeStart) { return; };
    let dx = event.changedTouches[0].clientX - swipeStart.x;
    let dy = event.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    // only clearly horizontal swipes, so that scrolling the page still works
    if (Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy)) {
        changeWeek(dx < 0 ? 1 : -1);
    };
}, { passive: true });

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
	return `<div class="calendar-accordion">
        <div class="calendar-accordion-header" onclick="toggleAccordion(this)">`+title+`<span class="calendar-arrow"></span></div>
        <div class="calendar-accordion-content">`+content+`</div>
    </div>
    `
}
function toggleAccordion(element) {
    // close all other sections
    document.querySelectorAll('.calendar-accordion-header').forEach(header => {
        if (header !== element && header.classList.contains("calendar-active")) {
            closeAccordionSection(header);
        }
    });
    if (element.classList.contains("calendar-active")) {
        closeAccordionSection(element);
    } else {
        openAccordionSection(element);
        element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
}

function openAccordionSection(header) {
    let content = header.nextElementSibling;
    content.style.padding = "10px";
    // measure while the section is still closed: reading scrollHeight makes
    // the browser apply the current styles, and the animation must start
    // from the closed height (0), not from the open style ("none")
    let height = content.scrollHeight;
    header.classList.add("calendar-active");
    // animate to the section's actual height (a fixed maximum would cut off
    // long sections on narrow screens), then remove the limit altogether,
    // so that nothing is cut off later either (e.g. after rotating the phone)
    content.style.maxHeight = height + "px";
    content.addEventListener('transitionend', function done(event) {
        if (event.propertyName !== 'max-height') {
            return;
        }
        content.removeEventListener('transitionend', done);
        if (header.classList.contains("calendar-active")) {
            content.style.maxHeight = "none";
        }
    });
}

function closeAccordionSection(header) {
    let content = header.nextElementSibling;
    // an animation cannot start from "none": fix the current height first
    content.style.maxHeight = content.scrollHeight + "px";
    // Reading offsetHeight makes the browser apply this height now (the value
    // itself is not needed). Otherwise it would combine this change with the
    // collapse below, and the section would close without the animation.
    void content.offsetHeight;
    header.classList.remove("calendar-active");
    content.style.maxHeight = null;
    content.style.padding = "0 10px";
}

setInterval(updateToday, 60000); // check every minute if today's date has changed
