// ==UserScript==
// @name         WME Quick HN (DaveAcincy fork)
// @description  Quick House Numbers
// @version      2025.02.08.01
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
    let fillnext = false;
    let { autoSetHN = false, zoomKeys = false, custom = 4 } = JSON.parse(localStorage[scriptId] ?? '{}');

    let wmeSDK;
    window.SDK_INITIALIZED.then(() => {
        wmeSDK = getWmeSdk({ scriptId, scriptName });
        wmeSDK.Events.once({ eventName: 'wme-ready' }).then(async () => {
            for (let initCount = 1; initCount <= 100; initCount++) {
                if (WazeWrap?.Ready) return initialiseQHN();
                else if (initCount === 1) console.log('Quick HN: Waiting for WazeWrap...');

                await new Promise(r => setTimeout(r, 300));
            }

            console.error('Quick HN: WazeWrap loading failed. Giving up.');
        });
    });

    function tlog(message, data = '') {
        if (!debug) return;

        const t = new Date;
        const h = t.getHours();
        const m = t.getMinutes();
        const s = t.getSeconds();
        const ms = `${t.getMilliseconds()}`.padStart(3, '0');

        console.log(`QHN: ${h}:${m}:${s}.${ms}: ${message}`, data);
    }

    function saveQHNOptions() {
        localStorage[scriptId] = JSON.stringify({ autoSetHN, zoomKeys, custom });
        updateTabPane();
    }

    function createShortcut(shortcutId, description, callback, shortcutKeys) {
        // SDK shortcuts for when that's fixed
        // wmeSDK.Shortcuts.createShortcut({ callback, description, shortcutId, shortcutKeys });

        I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[scriptId].members[shortcutId] = description;
        W.accelerators.addAction(shortcutId, { group: scriptId });
        W.accelerators.events.register(shortcutId, null, callback);
        W.accelerators._registerShortcuts({ [shortcutKeys]: shortcutId });
    }

    function updateTabPane() {
        document.getElementById('qhnTabPane').innerHTML = lastHN ?
            `<div>Last house number: <b>${lastHN}</b></div><br/>
            <div>Press...
            ${[['T', 1], ['R', 2], ['E', custom]].reduce((list, [key, interval]) =>
                `${list}<br/><b>${key}</b> for HN${modeMultiplier > 0 ? "+" : "-"}${interval} <i>(${getNextHNs(interval, 3).join(", ")}...)</i>`, '')}
            <br/><b>1-9/(1)0</b> ${zoomKeys ? `to zoom to level 1#` : 'for HN +#'}</div>`
            : "Manually set a house number to start using Quick HN";
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
            createShortcut(`WME_QHN_newHN${key}`, `Insert house number ±${key}, or zoom to level ${key + 10}`, () => addOrZoom(key, key + 10), key % 10);

        wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
            tabLabel.innerText = scriptName;
            tabLabel.title = `${scriptName} Settings`;
            tabPane.innerHTML = ((text) => policySafeHTML ? policySafeHTML.createHTML(text) : text)(`
                <div><b>Quick House Numbers</b> v${GM_info.script.version}</div><br/>
                <div><input type='checkbox' id='qhnAutoSetHNCheckbox' name='qhnAutoSetHNCheckbox' title="When enabled, auto set next HN updates the last HN based on the last HN moved" ${autoSetHN ? 'checked' : ''}> <label for='qhnAutoSetHNCheckbox'>Auto set next HN on moved HN</label></div>
                <div><input type='checkbox' id='qhnZoomKeysCheckbox' name='qhnZoomKeysCheckbox' title="1-9 => Z11-19; 0 => Z20" ${zoomKeys ? 'checked' : ''}> <label for='qhnZoomKeysCheckbox'>Zoom Keys when no segment</label></div>
                <div>Custom interval: <input type='number' id='qhnCustomInput' min='1' value='${custom}' style='width: 50px;'></div><br/>
                <div>Mode: <button name='qhnModeToggle' id='qhnModeToggle'>Increment &uarr;</button></div><br/>
                <div id="qhnTabPane"></div>`);

            updateTabPane()

            $('#qhnAutoSetHNCheckbox').on('change', (e) => {
                autoSetHN = e.target.checked;
                WazeWrap.Events[autoSetHN ? 'register' : 'unregister']('afteraction', null, hnActionCheck);
                saveQHNOptions();
            });

            $('#qhnZoomKeysCheckbox').on('change', (e) => {
                zoomKeys = e.target.checked;
                saveQHNOptions();
            });

            $('#qhnCustomInput').on('change', (e) => {
                custom = e.target.value;
                e.target.blur();
                saveQHNOptions();
            });

            $('#qhnModeToggle').on('click', (e) => {
                modeMultiplier *= -1;
                $('#qhnModeToggle').html(modeMultiplier > 0 ? 'Increment &uarr;' : 'Decrement &darr;');
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
            tlog(`action: ${actionHN}`, lastAction.houseNumber);
            lastHN = actionHN;
            updateTabPane();
        }
    }

    function addOrZoom(newInterval, zoom) {
        if (!newInterval) return;

        if (wmeSDK.Editing.getSelection()?.objectType == 'segment') {
            interval = Number(newInterval);
            fillnext = true;

            tlog('setFocus');

            $('wz-button').has('.w-icon-home').trigger('click');
            $('wz-navigation-item[selected="false"] i.w-icon-script').trigger('click');
            $('#user-tabs li a').has(`span:contains('${scriptName}')`).trigger('click');
        }
        else if (zoomKeys && zoom) W.map.olMap.zoomTo(zoom);
    }

    async function setHN() {
        tlog('setHN');
        const hnInput = $('div.house-number.is-active input')[0];
        if (!fillnext || hnInput?.value !== '') return;

        tlog(`sethn ctr ${lastHN} ival ${interval}`);
        fillnext = false;

        lastHN = getNextHNs(interval, 1)[0];

        // React hack: https://github.com/facebook/react/issues/11488#issuecomment-884790146
        hnInput.value = lastHN;
        hnInput._valueTracker?.setValue("");
        hnInput.dispatchEvent(new Event("input", { bubbles: true }));

        updateTabPane();

        await new Promise(r => setTimeout(r, 100));
        hnInput.blur();
    }

    function getNextHNs(interval, numHNs) {
        const nextHNs = new Array(numHNs);
        let baseHN = lastHN;

        for (let num = 0; num < numHNs; num++) {
            const nextParts = baseHN.match(/[0-9]+|[a-z]|[A-Z]|\S/g);

            let thisInterval = interval;
            for (const [index, part] of nextParts.reverse().entries()) {
                if (!Number.isNaN(Number(part))) {
                    nextParts[index] = Math.max(1, Number(part) + (thisInterval * modeMultiplier)).toString().padStart(part.length, '0');
                    break;
                }

                if (/[a-z]/i.test(part)) {
                    let nextLetter = part.codePointAt(0) + ((thisInterval % 26) * modeMultiplier);
                    thisInterval = Math.floor(thisInterval / 26);

                    if ((/[a-z]/.test(part) && nextLetter > 'z'.codePointAt(0)) ||
                        (/[A-Z]/.test(part) && nextLetter > 'Z'.codePointAt(0))) {
                        nextLetter -= 26;
                        thisInterval++;
                    }

                    if ((/[a-z]/.test(part) && nextLetter < 'a'.codePointAt(0)) ||
                        (/[A-Z]/.test(part) && nextLetter < 'A'.codePointAt(0))) {
                        nextLetter += 26;
                        thisInterval++;
                    }

                    nextParts[index] = String.fromCodePoint(nextLetter);

                    if (!thisInterval) break;
                }
            }
            baseHN = nextParts.reverse().join('');
            nextHNs[num] = baseHN;
        }

        return nextHNs;
    }
})();
