// ==UserScript==
// @name         WME Quick HN (DaveAcincy fork)
// @description  Quick House Numbers
// @version      2025.02.04.01
// @author       Vinkoy (forked by DaveAcincy)
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @namespace    https://greasyfork.org/users/166713
// @homepage     https://www.waze.com/discuss/t/script-wme-quick-hn-daveacincy-fork/327021
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @grant        none
// @downloadURL  https://update.greasyfork.org/scripts/458651/WME%20Quick%20HN%20%28DaveAcincy%20fork%29.user.js
// @updateURL    https://update.greasyfork.org/scripts/458651/WME%20Quick%20HN%20%28DaveAcincy%20fork%29.meta.js
// ==/UserScript==

/* global W */
/* global I18n */
/* global $ */
/* global WazeWrap */

(function () {
    const debug = false;

    const scriptName = 'Quick HN';
    const scriptId = 'wmeqhn';

    let policySafeHTML;
    let wazeMapObserver;
    let lastHN;
    let interval = 1;
    let modeMultiplier = 1;
    let autoSetHN = false;
    let zoomKeys = false;
    let custom = 4;
    let fillnext = false;

    let wmeSDK;
    window.SDK_INITIALIZED.then(() => {
        wmeSDK = getWmeSdk({ scriptId, scriptName });
        wmeSDK.Events.once({ eventName: 'wme-ready' }).then(onWmeReady);
    });

    let initCount = 0;
    function onWmeReady() {
        initCount++;
        if (WazeWrap?.Ready) initialiseQHN();
        else {
            if (initCount == 1) console.log('Quick HN: Waiting for WazeWrap...');
            else if (initCount >= 100) {
                console.error('Quick HN: WazeWrap loading failed. Giving up.');
                return;
            }
            setTimeout(onWmeReady, 300);
        }
    }

    function tlog(message, data = '') {
        if (!debug) return;

        const t = new Date;
        const h = t.getHours();
        const m = t.getMinutes();
        const s = t.getSeconds();
        const hms = `${h}:${m}:${s}`;
        const ms = (`00${t.getMilliseconds()}`).slice(-3);

        console.log(`QHN: ${hms}.${ms}: ${message}`, data);
    }

    function saveQHNOptions() {
        localStorage[scriptId] = JSON.stringify({ autoSetHN, zoomKeys, custom });
    }

    function getOrdinal(num) {
        return `${num}${new Map([
            ["one", "st"],
            ["two", "nd"],
            ["few", "rd"],
            ["other", "th"],
        ]).get(new Intl.PluralRules(wmeSDK.Settings.getLocale().localeCode, { type: 'ordinal' }).select(num))}`
    }

    function createShortcut(id, desc, func, kcode) {
        /* SDK shortcuts for when that's fixed
        wmeSDK.Shortcuts.createShortcut({
            callback: () => func,
            description: desc,
            shortcutId: id,
            shortcutKeys: kcode,
        });*/

        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[scriptId].members[id] = desc;
        W.accelerators.addAction(id, { group: scriptId });
        W.accelerators.events.register(id, null, func);
        W.accelerators._registerShortcuts({ [kcode]: id });
    }

    function initialiseQHN() {
        if (typeof trustedTypes !== 'undefined') {
            policySafeHTML = trustedTypes.createPolicy('policySafeHTML', { createHTML: innerText => innerText });
        }

        W.accelerators.Groups[scriptId] = { members: [] };
        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[scriptId] = { description: scriptName, members: {} };

        createShortcut('WME_QHN_newHN01', "Insert next sequential house number", () => addOrZoom(1), 't');
        createShortcut('WME_QHN_newHN02', "Insert every 2nd house number", () => addOrZoom(2), 'r');
        createShortcut('WME_QHN_newHNcustom', "Insert house number with custom interval", () => addOrZoom(custom), 'e');
        for (let key = 1; key <= 10; key++)
            createShortcut(`WME_QHN_newHN${key}`, `Insert every ${getOrdinal(key)} house number or zoom to level ${key + 10}`, () => addOrZoom(key, key + 10), key % 10);

        wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
            tabLabel.innerText = scriptName;
            tabLabel.title = `${scriptName} Settings`;
            tabPane.innerHTML = ((text) => policySafeHTML ? policySafeHTML.createHTML(text) : text)(`<div>
                <div><b>Quick House Numbers</b> v${GM_info.script.version}</div><br/>
                <div><input type='checkbox' name='qhnAutoSetHNCheckbox' title="When enabled, auto set next HN updates the last HN based on the last HN moved" id='qhnAutoSetHNCheckbox'> <label for='qhnAutoSetHNCheckbox'>Auto set next HN on moved HN</label></div>
                <div><input type='checkbox' name='qhnZoomKeysCheckbox' title="1-9 => Z11-19; 0 => Z20" id='qhnZoomKeysCheckbox'> <label for='qhnZoomKeysCheckbox'>Zoom Keys when no segment</label></div><br/>
                <div>Mode: <button name='qhnModeToggle' id='qhnModeToggle'>Increment &uarr;</button></div><br/>
                <div><b>Last house number set:</b> <span id='qhnLastHN'>None</span></div><br/>
                <div>Press <b>T</b> to add <u>HN +1</u> <i>(1,2,3...)</i></div>
                <div>Press <b>R</b> to add <u>HN +2</u> <i>(1,3,5... or 2,4,6...)</i></div>
                <div>Press <b>E</b> to add <u>HN +</u><input type='number' id='qhnCustomInput' min='1' value='${custom}' style='width: 42px; margin-left: 6px; height: 22px;'></div>
                <div>Press <b>1 - 9</b> to add <u>HN +#</u></div>
                <div>Press <b>0</b> to add <u>HN +10</u></div>`);

            ({ autoSetHN=autoSetHN, zoomKeys=zoomKeys, custom=custom } = JSON.parse(localStorage[scriptId] ?? '{}'));

            $('#qhnAutoSetHNCheckbox').prop('checked', autoSetHN).on('change', (e) => {
                autoSetHN = e.target.checked;
                WazeWrap.Events[autoSetHN ? 'register' : 'unregister']('afteraction', null, hnActionCheck);
                saveQHNOptions();
            });

            $('#qhnZoomKeysCheckbox').prop('checked', zoomKeys).on('change', (e) => {
                zoomKeys = e.target.checked;
                saveQHNOptions();
            });

            $('#qhnModeToggle').on('click', (e) => {
                modeMultiplier *= -1;
                $('#qhnModeToggle').html(modeMultiplier > 0 ? 'Increment &uarr;' : 'Decrement &darr;');
                e.target.blur();
            });

            $('#qhnCustomInput').val(custom).on('change', (e) => {
                custom = e.target.value;
                e.target.blur();
                saveQHNOptions();
            });

            WazeWrap.Events.register('afteraction', null, hnActionCheck);
        });

        wazeMapObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                for (const node of mutation.addedNodes) {
                    if (node.className === 'house-number is-active') {
                        const hnInput = node.querySelector('input');
                        if (hnInput) hnInput.onfocus = () => setHN();
                    }
                }
            }
        });

        wmeSDK.Events.on({
            eventName: 'wme-selection-changed', eventHandler: () => {
                if (wmeSDK.Editing.getSelection()?.objectType === 'segment')
                    wazeMapObserver.observe(document.getElementById('WazeMap'), { childList: true, subtree: true });
                else
                    wazeMapObserver.disconnect();
            }
        });

        console.log("Quick HN: initialize complete");
    }

    // Watches changes for new/moved HNs and updates lastHN
    function hnActionCheck() {
        const lastAction = W.model.actionManager.getActions().at(-1);
        const actionHN = lastAction?.houseNumber?.getAttribute('number');
        if (actionHN && (lastAction.actionName === 'ADD_HOUSE_NUMBER' || (lastAction.actionName === 'MOVE_HOUSE_NUMBER' && autoSetHN))) {
            lastHN = actionHN;
            tlog(`action: ${actionHN}`, lastAction.houseNumber);
            document.getElementById('qhnLastHN').innerText = lastHN;
        }
    }

    function addOrZoom(newInterval, zoom) {
        if (!newInterval) return;

        if (wmeSDK.Editing.getSelection()?.objectType == 'segment') {
            interval = Number(newInterval);

            tlog('setFocus');
            fillnext = true;
            $('wz-button').has('.w-icon-home').trigger('click');
            $('wz-navigation-item[selected="false"] i.w-icon-script').trigger('click');
            $('#user-tabs li a').has(`span:contains('${scriptName}')`).trigger('click');
        }
        else if (zoomKeys && zoom) W.map.olMap.zoomTo(zoom);
    }

    // this may be a hack but works for now.  https://stackoverflow.com/questions/30683628/react-js-setting-value-of-input
    function setNativeValue(element, value) {
        let lastValue = element.value;
        element.value = value;
        let event = new Event('input', { target: element, bubbles: true });
        // React 15
        event.simulated = true;
        // React 16
        let tracker = element._valueTracker;
        if (tracker) tracker.setValue(lastValue)
        element.dispatchEvent(event);
    }

    async function setHN() {
        tlog('setHN');
        const hnInput = $('div.house-number.is-active input')[0];
        if (!fillnext || hnInput?.value !== '') return;

        tlog(`sethn ctr ${lastHN} ival ${interval}`);
        fillnext = false;

        const nextParts = lastHN.match(/[0-9]+|[a-z]|[A-Z]|\S/g);

        for (const [index, part] of nextParts.reverse().entries()) {
            if (!Number.isNaN(Number(part))) {
                nextParts[index] = Math.max(1, Number(part) + (interval * modeMultiplier)).toString().padStart(part.length, '0');
                break;
            }

            if (/[a-z]/i.test(part)) {
                let nextLetter = part.codePointAt(0) + ((interval % 26) * modeMultiplier);

                interval = Math.floor(interval / 26);

                if ((/[a-z]/.test(part) && nextLetter > 'z'.codePointAt(0)) ||
                    (/[A-Z]/.test(part) && nextLetter > 'Z'.codePointAt(0))) {
                    nextLetter -= 26;
                    interval++;
                }

                if ((/[a-z]/.test(part) && nextLetter < 'a'.codePointAt(0)) ||
                    (/[A-Z]/.test(part) && nextLetter < 'A'.codePointAt(0))) {
                    nextLetter += 26;
                    interval++;
                }

                nextParts[index] = String.fromCodePoint(nextLetter);

                if (!interval) break;
            }
        }

        lastHN = nextParts.reverse().join('');

        document.getElementById('qhnLastHN').innerText = lastHN;

        setNativeValue(hnInput, lastHN);
        await new Promise(r => setTimeout(r, 80));
        hnInput.blur();
    }
})();
