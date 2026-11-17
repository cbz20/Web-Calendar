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

// TeX support for event titles and descriptions via MathJax.
//
// The calendar draws its content after the page has loaded and redraws it
// on every navigation, so MathJax's own typesetting at page load does not
// reach it. Instead, the calendar calls clearMath() before and typesetMath()
// after each redraw.
//
// MathJax only typesets the calendar and the event window, not the rest of
// the page. If the page already loads MathJax (version 3 or 4), that copy is
// used; otherwise this file loads it. To switch TeX support off, simply do
// not load this file: all calls below do nothing if it is missing.
//
// Inline maths: $...$ or \(...\)    Displayed maths: $$...$$ or \[...\]

// An exact version, so that a new MathJax release is only used after it has
// been tested here (fonts and extensions are loaded with the same version).
const MATHJAX_URL = 'https://cdn.jsdelivr.net/npm/mathjax@4.1.3/tex-mml-chtml.js';

let mathQueue = Promise.resolve();

// the parts of the page that may contain maths
function calendarMathElements() {
    return [
        document.querySelector('.calendar-container'),
        document.getElementById('event-calendar-modal')
    ].filter(Boolean);
}

// true once MathJax has been loaded (it may still be starting up)
function mathJaxLoaded() {
    return Boolean(window.MathJax && MathJax.startup && MathJax.startup.promise);
}

// Typeset the maths in the given elements (default: the whole calendar).
// Calls are queued, because MathJax must not typeset twice at the same time.
function typesetMath(elements = calendarMathElements()) {
    if (!mathJaxLoaded()) {
        return; // the content is typeset as soon as MathJax has loaded
    }
    mathQueue = mathQueue
        .then(() => MathJax.startup.promise)
        .then(() => MathJax.typesetPromise(elements))
        .catch(error => console.warn('WARNING: MathJax could not typeset the calendar:', error));
}

// Tell MathJax to forget the maths in the given elements.
// Must be called BEFORE their content is replaced.
function clearMath(elements = calendarMathElements()) {
    if (mathJaxLoaded() && typeof MathJax.typesetClear === 'function') {
        MathJax.typesetClear(elements);
    }
}

// the page's language, if MathJax can read formulas aloud in it, else English
function mathSpeechLanguage() {
    const supported = ['af', 'ca', 'da', 'de', 'en', 'es', 'fr', 'hi', 'it', 'ko', 'nb', 'nn', 'sv'];
    const pageLanguage = (document.documentElement.lang || 'de').toLowerCase().split('-')[0];
    return supported.includes(pageLanguage) ? pageLanguage : 'en';
}

(function loadMathJax() {
    if (mathJaxLoaded()) {
        // already loaded by the surrounding page
        typesetMath();
        return;
    }
    if (document.querySelector('script[src*="mathjax"]')) {
        // the surrounding page is loading MathJax itself; the calendar uses
        // that copy as soon as it is ready (with that page's settings)
        return;
    }
    window.MathJax = {
        loader: {
            // filters potentially harmful TeX commands, such as \href links
            // to javascript: addresses or arbitrary CSS via \style
            load: ['ui/safe']
        },
        tex: {
            inlineMath: [['$', '$'], ['\\(', '\\)']]
        },
        options: {
            sre: {
                // language in which screen readers read formulas aloud
                // (MathJax's default is English, also on German pages)
                locale: mathSpeechLanguage()
            }
        },
        startup: {
            typeset: false // only typeset the calendar, not the whole page
        }
    };
    const script = document.createElement('script');
    script.src = MATHJAX_URL;
    script.async = true;
    script.onload = () => typesetMath();
    script.onerror = () => console.warn('WARNING: Could not load MathJax from ' + MATHJAX_URL + '; formulas are shown as plain TeX.');
    document.head.appendChild(script);
})();
