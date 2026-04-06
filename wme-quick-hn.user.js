// ==UserScript==
// @name         WME Quick HN+RPP
// @description  Quick House Numbers & RPPs
// @version      2026.04.06.01
// @author       DaveAcincy (original QuickHN by Vinkoy)
// @contributors Philistine11, gncnpk, fuji2086
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @exclude      https://www.waze.com/discuss/*
// @exclude      https://www.waze.com/editor/sdk/*
// @exclude      https://beta.waze.com/editor/sdk/*
// @namespace    https://greasyfork.org/users/166713
// @homepage     https://www.waze.com/discuss/t/script-wme-quick-hn-daveacincy-fork/327021
// @grant        GM.addStyle
// @grant        unsafeWindow
// ==/UserScript==

/* global W */
/* global I18n */
/* global jQuery */

(function () {
    const debug = false;

    const scriptName = 'Quick HN+RPP';
    const scriptId = 'wmeqhn';
    const msg1 = `This is a new version of QuickHN that adds RPP capability. It has been renamed, so TamperMonkey will consider it a new script.
    You will need to disable or remove the older version or it will not work correctly with both versions enabled.`;

    const shortcutStore = 'wmeqhn_keys';
    let policySafeHTML;
    let wazeMapObserver;
    let lastHN;
    let lastStreetId; // Store the last street ID
    let nextHNs;
    let interval = 1;
    let modeMultiplier = 1;
    let fillnext = false;
    let curShortcuts = {};
    let mode = 'Off';
    let scTried = 0;
    let scAdded = 0;
    let { autoSetHN = false, zoomKeys = false, custom = 4, lockLevel = 1 } = JSON.parse(localStorage[scriptId] ?? '{}');

    let wmeSDK;
    unsafeWindow.SDK_INITIALIZED.then(() => {
        wmeSDK = getWmeSdk({ scriptId, scriptName });
        wmeSDK.Events.once({ eventName: 'wme-ready' }).then( () => {
            initialiseQHN();
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

    function createShortcut(shortcutId, description, callback, shortcutKeysXX) {
        let shortcutKeys = curShortcuts[shortcutId];
        if (typeof shortcutKeys === 'string' && shortcutKeys.indexOf(',-1') >= 0) {
            shortcutKeys = null;
        }

        if (shortcutKeys) {
            scTried++;
            shortcutKeys = modKey(shortcutKeys);
            if (wmeSDK.Shortcuts.areShortcutKeysInUse({ shortcutKeys })) {
                console.error(`QHN: Shortcut Keys "${shortcutKeys}" are already in use by another script. "${description}" will not be set with these keys.`);
                shortcutKeys = null;
            }
        }

        try {
            wmeSDK.Shortcuts.createShortcut({
                shortcutId,
                shortcutKeys,
                description,
                callback,
            });
            if (debug) console.info(`QHN: Shortcut Registration successful for "${description}" with keys: "${shortcutKeys}"`);
            if (shortcutKeys) { scAdded++; }
            return true;
        } catch (e) {
            console.error(`QHN: Failed to register Shortcut "${description}" (${shortcutKeys}): ${e.message || e}`);
            return false;
        }
    }
  /*   1: Control or Meta ("C")
   *   2: Shift ("S")
   *   4: Alt ("A")
   *   8: Meta ("C") (treated as synonymous with Ctrl)
   */
    function modKey(keyStr) {
        let mkey = keyStr;
        if (!keyStr || keyStr === '') return null;
        const [mod, key] = keyStr.split(',');
        if (mod && key) {
            mkey = key;
            let mods = '';
            if (mod & 4) mods += 'A';
            if (mod & 2) mods += 'S';
            if ((mod & 1) || (mod & 8)) mods += 'C';
            if (mods) mkey = mods + '+' + key;
        }
        return mkey;
    }

    function loadShortcuts( initial = false ) {
        let haveStore = false;
        const allShortcuts = {
            WME_QHN_newHN01: 't',
            WME_QHN_newHN02: 'r',
            WME_QHN_newHNcustom: 'e',
            WME_QHN_newHN1: '1',
            WME_QHN_newHN2: '2',
            WME_QHN_newHN3: '3',
            WME_QHN_newHN4: '4',
            WME_QHN_newHN5: '5',
            WME_QHN_newHN6: '6',
            WME_QHN_newHN7: '7',
            WME_QHN_newHN8: '8',
            WME_QHN_newHN9: '9',
            WME_QHN_newHN10: '0',
            WME_QHN_toggleMode: null,
            WME_QHN_toggleDirection: null,
            WME_QHN_increaseInterval: null,
            WME_QHN_decreaseInterval: null,
            WME_QHN_createRPPcurNum: null,
        }

        if (initial) {
            const wmeKeys = JSON.parse(localStorage.keyboardShortcuts);
            if (localStorage.hasOwnProperty(shortcutStore)) {
                curShortcuts = JSON.parse(localStorage[shortcutStore]);
                haveStore = true;
            }
            Object.entries(allShortcuts).forEach(([key, value]) => {
                if (!haveStore && wmeKeys.hasOwnProperty(key)) {
                    curShortcuts[key] = wmeKeys[key];
                }
                if (!curShortcuts.hasOwnProperty(key)){
                    curShortcuts[key] = value;
                }
                if (debug) console.log(`QHN keys ${key}: ${curShortcuts[key]}`);
            });
        }
        else {
            const keys = wmeSDK.Shortcuts.getAllShortcuts();
            curShortcuts = {};
            for (let i=0; i<keys.length; i++) {
                const sc = keys[i];
                if (sc.shortcutKeys) { curShortcuts[sc.shortcutId] = sc.shortcutKeys; }
                if (debug) console.log(`QHN saving keys ${sc.shortcutId}: ${sc.shortcutKeys}`);
            }
        }

    }
    function saveShortcuts() {
        loadShortcuts( false ); // get current key for all shortcuts
        const numSC = Object.keys(curShortcuts).length;
        if (numSC > 6) {
            localStorage[shortcutStore] = JSON.stringify(curShortcuts);
            if (debug) console.log('QHN: shortcuts saved');
        }
    }
    function saveQHNOptions() {
        localStorage[scriptId] = JSON.stringify({ autoSetHN, zoomKeys, custom, lockLevel });
        saveShortcuts();
    }
    function showPopup(message1, message2)
    {
        var popHtml = '<div id="qPopup" class="reportPop popup" style="max-width:400px;width:300px;">' +
            '<div class="arrow"></div>' +
            '<div class="pop-title" id="pop-drag">' + scriptName + '<div style="float:right;"><div class="close-popover">X</div></div></div>' +
            '<div class="pop-content">' +
            message1 + '<br><br>' +
            message2 + '</div>' +
            '</div>';
        //const mapEle = wmeSDK.Map.getMapViewportElement();
        const $mapEle = $(".view-area.olMap");
        $mapEle.append(popHtml);

        const wid = $("#qPopup").width();
        const half = wid/2;
        const mintop = 30;
        const minleft = 30; // $('#sidebarContent')[0].offsetWidth;
        const maxbot = $mapEle[0].clientHeight;
        const maxright = $mapEle[0].clientWidth;
        var x = maxright/2 - half; // - $('#sidebarContent')[0].offsetWidth - $('#drawer')[0].offsetWidth;
        var y = maxbot/2 - $('#app-head')[0].offsetHeight;
        if (y < mintop) { y = mintop; }
        if (y+200 > maxbot) { y = maxbot-200; }
        if (x < minleft) { x = minleft; }
        if (x + wid > maxright) { x = maxright - wid; }
        var ofs = {};
        ofs.top = y;
        ofs.left = x; // - $('#sidebarContent')[0].offsetWidth;
        $("#qPopup").offset( ofs );
        $("#qPopup").show();

        // Make the popup draggable
        if (typeof jQuery.ui !== 'undefined') {
            $('#qPopup').draggable({cursor: "move", handle: '#pop-drag'});
        }
        $(".close-popover").click(function() {
            $("#qPopup").remove();
            $("#qPopup").hide();
        });
    }

    function initialiseQHN() {
        if (typeof trustedTypes !== 'undefined') {
            policySafeHTML = trustedTypes.createPolicy('policySafeHTML', { createHTML: innerText => innerText });
        }
        loadShortcuts( true );

        createShortcut('WME_QHN_newHN01', "Insert next sequential house number/RPP", () => addOrZoom(1), 't');
        createShortcut('WME_QHN_newHN02', "Insert every 2nd house number/RPP", () => addOrZoom(2), 'r');
        createShortcut('WME_QHN_newHNcustom', "Insert house number/RPP with custom interval", () => addOrZoom(custom), 'e');
        createShortcut('WME_QHN_toggleMode', "Switch between Off/HN/RPP modes", () => {
            if (mode === 'HN') { mode = 'RPP'; }
            else if (mode === 'Off') { mode = 'HN'; }
            else { mode = 'Off'; }
            updateModeButtons();
            displayQHNtab();
            updateNextHNs();
        }, null);
        createShortcut('WME_QHN_toggleDirection', "Toggle between increment and decrement", () => {
            modeMultiplier *= -1;
            document.querySelector('#qhnModeToggle').innerHTML = modeMultiplier > 0 ? 'Increment &uarr;' : 'Decrement &darr;';
            displayQHNtab();
            updateNextHNs();
        }, null);
        createShortcut('WME_QHN_increaseInterval', "Increase custom interval by 1", () => {
            custom++;
            document.querySelector('#qhnCustomInput').value = custom;
            saveQHNOptions();
            displayQHNtab();
            updateNextHNs();
        }, null);

        createShortcut('WME_QHN_decreaseInterval', "Decrease custom interval by 1", () => {
            if (custom > 1) {
                custom--;
                document.querySelector('#qhnCustomInput').value = custom;
                saveQHNOptions();
                displayQHNtab();
                updateNextHNs();
            }
        }, null);
        createShortcut('WME_QHN_createRPPcurNum', "Create RPP for current Number/Street", () => {
            createRPP(0, true);
        }, null);
        for (let key = 1; key <= 10; key++)
            createShortcut(`WME_QHN_newHN${key}`, `Insert house number/RPP ±${key}, or zoom to level ${key + 10}`, () => addOrZoom(key, key + 10), key % 10);

        GM.addStyle(`
            .qhn-panel { color: var(--content_p1); }
            .qhn-mode-container {
                display: flex;
                background:darkgrey;
                gap: 0;
                border-radius: 6px;
                padding: 3px;
                margin-bottom: 15px;
            }
            .qhn-mode-btn {
                flex: 1;
                border: none;
                border-radius: 4px;
                background: transparent;
                color: var(--content_p2);
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                transition: all 0.2s ease;
            }
            .qhn-mode-btn:hover {
                background: var(--surface_s4);
            }
            .qhn-mode-btn.active {
                background: #48b5e9;
                color: white;
                font-weight: 600;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            }
            .reportPop {display: block; position: absolute; width: 500px;left: 30%;top: 35%; background-color: var(--background_default); display: none;}
            .pop-title {background: #efefef; font-family: helvetica; border: var(--background_default) solid 1px; padding-left: 8px; position: relative; display: block;}
            .pop-content {display: block; color: var(--content_p1); font-family: helvetica; padding: 15px 20px;}
            .close-popover {text-decoration:none;padding:0px 3px;cursor: pointer;border-width:1px; background-color:var(--background_default); border-color:ghostwhite}
            .close-popover:hover {padding:0px 4px;border-style:outset;border-width:1px; background-color: var(--background_default); border-color:ghostwhite;}
        `);

        wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
            tabLabel.id = scriptId;
            tabLabel.innerText = scriptName;
            tabLabel.title = `${scriptName} Settings`;
            const streetText = I18n.translations[I18n.currentLocale()].edit.address.street;
            tabPane.innerHTML = ((text) => policySafeHTML ? policySafeHTML.createHTML(text) : text)(`
                <div class="qhn-panel">
                    <div><b>Quick HN+RPP</b> v${GM_info.script.version}</div><br/>
                    <div style="margin-bottom: 10px;">
                        <div style="margin-bottom: 8px; font-weight: 600;">Mode:</div>
                        <div class="qhn-mode-container">
                            <button id="qhnModeOff" class="qhn-mode-btn ${mode === 'Off' ? 'active' : ''}">Off</button>
                            <button id="qhnModeHN" class="qhn-mode-btn ${mode === 'HN' ? 'active' : ''}">House Numbers</button>
                            <button id="qhnModeRPP" class="qhn-mode-btn ${mode === 'RPP' ? 'active' : ''}">RPPs</button>
                        </div>
                    </div>
                    <div><b>${streetText}:</b> <span id="qhnStreet"></span></div>
                    <div>Custom interval (E): <input type='number' id='qhnCustomInput' min='1' value='${custom}' style='width: 50px;'></div><br/>
                    <div>Direction: <button name='qhnModeToggle' id='qhnModeToggle'>Increment &uarr;</button></div><br/>
                    <div id="qhnTabPane"></div>
                    <fieldset style="border: 1px solid silver; padding: 8px; border-radius: 4px;">
                        <div><input type='checkbox' id='qhnAutoSetHNCheckbox' name='qhnAutoSetHNCheckbox' title="When enabled, auto set next HN updates the last HN based on the last HN moved" ${autoSetHN ? 'checked' : ''}> <label for='qhnAutoSetHNCheckbox'>Auto set next HN on moved HN</label></div>
                        <div><input type='checkbox' id='qhnZoomKeysCheckbox' name='qhnZoomKeysCheckbox' title="1-9 => Z11-19; 0 => Z20" ${zoomKeys ? 'checked' : ''}> <label for='qhnZoomKeysCheckbox'>Zoom Keys when no segment</label></div>
                        <div id="qhnRPPSettings">
                            <div>RPP Lock Level: <input type='number' id='qhnLockLevel' min='1' max='6' value='${lockLevel}' style='width: 50px;'></div><br/>
                        </div>
                    </fieldset>
                </div>`);

            document.querySelector('#qhnModeOff').addEventListener('click', () => {
                mode = 'Off';
                updateModeButtons();
            });

            document.querySelector('#qhnModeHN').addEventListener('click', () => {
                mode = 'HN';
                updateModeButtons();
            });

            document.querySelector('#qhnModeRPP').addEventListener('click', () => {
                mode = 'RPP';
                updateModeButtons();
            });

            document.querySelector('#qhnLockLevel').addEventListener('change', (e) => {
                lockLevel = parseInt(e.target.value);
                saveQHNOptions();
            });

            document.querySelector('#qhnAutoSetHNCheckbox').addEventListener('change', (e) => {
                autoSetHN = e.target.checked;
                saveQHNOptions();
            });

            document.querySelector('#qhnZoomKeysCheckbox').addEventListener('change', (e) => {
                zoomKeys = e.target.checked;
                saveQHNOptions();
                updateTabPane();
            });

            document.querySelector('#qhnCustomInput').addEventListener('change', (e) => {
                custom = e.target.value;
                e.target.blur();
                saveQHNOptions();
                updateNextHNs();
            });

            document.querySelector('#qhnModeToggle').addEventListener('click', (e) => {
                modeMultiplier *= -1;
                e.target.innerHTML = (modeMultiplier > 0 ? 'Increment &uarr;' : 'Decrement &darr;');
                e.target.blur();
                updateNextHNs();
            });

            updateNextHNs();
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
                let selection;
                try {
                    selection = wmeSDK.Editing.getSelection();
                } catch (e) {
                    // sdk.Editing.getSelection() throws WMEError for types it doesn't support
                    // (e.g. 'googlePlace'). Treat as no-selection.
                    selection = null;
                }
                if (selection?.objectType === 'segment') {
                    wazeMapObserver.observe(document.querySelector('#WazeMap'), { childList: true, subtree: true });

                    // Store street from selected segment for RPP mode
                    if (selection.ids.length > 0) {
                        const segmentId = selection.ids[0];
                        const segment = wmeSDK.DataModel.Segments.getById({ segmentId });

                        if (segment?.primaryStreetId) {
                            updateStreetId(segment.primaryStreetId, segment.alternateStreetIds);
                        }
                    }
                } else {
                    wazeMapObserver.disconnect();
                }

                // Update last HN and street if venue is selected
                if (selection?.objectType === 'venue' && selection.ids.length === 1) {
                    const venueId = selection.ids[0];
                    const address = wmeSDK.DataModel.Venues.getAddress({ venueId });
                    if (address) {
                        if (address.houseNumber) {
                            lastHN = address.houseNumber;
                            tlog('Stored HN from RPP:', lastHN);
                        }
                        if (address.street?.id) {
                            //lastStreetId = address.street.id;
                            updateStreetId(address.street.id);
                            tlog('Stored street from RPP:', lastStreetId);
                        }
                        updateNextHNs();
                    }
                }
                updateTabPane();
            }
        });

        wmeSDK.Events.on({
            eventName: "wme-house-number-added",
            eventHandler: handleHNAdded
        });
        wmeSDK.Events.on({
            eventName: "wme-house-number-moved",
            eventHandler: handleHNMoved
        });
        wmeSDK.Events.on({
            eventName: "wme-user-settings-changed",
            eventHandler: (e) => {
                tlog('QHN user settings chg',e);
            }
        });
        wmeSDK.Events.trackDataModelEvents({ dataModelName: "venues" });
        wmeSDK.Events.on({ eventName: "wme-data-model-objects-changed", eventHandler: handleVenueChanged });
        wmeSDK.Events.on({ eventName: "wme-map-layer-changed", eventHandler: handleLayerChanged });

        let msg2 = '';
        if (scAdded < scTried) {
            msg2 = 'Not all shortcuts could be added. Please make sure old version is removed.';
        }
        if (!localStorage.hasOwnProperty(shortcutStore) || msg2) {
            setTimeout(() => showPopup(msg1, msg2), 8000);
            if (!msg2) {
                saveShortcuts();
            }
        }
        console.log("Quick HN+RPP: initialize complete");
    }

    function updateModeButtons(newMode) {
        fillnext = false;
        if (newMode) {
            mode = newMode;
            fillnext = false;
        }
        document.querySelector('#qhnModeOff').classList.toggle('active', mode === 'Off');
        document.querySelector('#qhnModeHN').classList.toggle('active', mode === 'HN');
        document.querySelector('#qhnModeRPP').classList.toggle('active', mode === 'RPP');
        //document.querySelector('#qhnRPPSettings').style.display = mode === 'RPP' ? 'block' : 'none';
        document.querySelector('#WazeMap').focus();
        updateTabPane();
    }

    function updateStreetId(stId, altIds) {
        let city = '';
        let streetName = '';
        let goodOne = false;
        const street = wmeSDK.DataModel.Streets.getById({ streetId: stId });

        if (street && !street.isEmpty) {
            streetName = street.name;
            if (street.cityId) {
                const ct = wmeSDK.DataModel.Cities.getById({cityId: street.cityId});
                if (ct && !ct.isEmpty) {
                    lastStreetId = stId;
                    city = ct.name;
                    goodOne = true;
                }
            }
            if (!goodOne && altIds) {
                let aStr, ct;
                for (let i=0; i<altIds.length; i++) {
                    let id = altIds[i];
                    aStr = wmeSDK.DataModel.Streets.getById({ streetId: id });
                    ct = wmeSDK.DataModel.Cities.getById({cityId: aStr.cityId});
                    if (!ct.isEmpty) {
                        lastStreetId = id;
                        city = ct.name;
                        goodOne = true;
                        if (aStr.name == streetName) {
                            break;
                        }
                    }
                }
            }
            if (goodOne) {
                tlog('Stored street from segment:', lastStreetId);
                document.querySelector('#qhnStreet').innerHTML = streetName + ', ' + city;
            }
        }

    }

function handleHNAdded(e) {
    const hnid = e.houseNumberId;
    const hn = W.model.segmentHouseNumbers.getObjectById(hnid)?.attributes.number; // SDK - need function for this
    tlog('hn added event: ' + hn, e);
    lastHN = hn;
    updateModeButtons('HN');
    updateNextHNs();
    setTimeout(displayQHNtab, 110);
}

function handleHNMoved(e) {
    if (!autoSetHN) return;
    const hnid = e.houseNumberId;
    const hn = W.model.segmentHouseNumbers.getObjectById(hnid)?.attributes.number; // SDK - need function for this
    tlog('hn moved event: ' + hn, e);
    lastHN = hn;
    updateModeButtons('HN');
    updateNextHNs();
    setTimeout(displayQHNtab, 110);
}
function handleVenueChanged({dataModelName, objectIds}) {
    if (dataModelName == 'venues') {
        const ven = wmeSDK.DataModel.Venues.getById({ venueId: objectIds[0] });
        if (ven.isResidential) {
            const addr = wmeSDK.DataModel.Venues.getAddress({ venueId: objectIds[0] });
            if (addr.street?.id) {
                updateStreetId(addr.street.id);
                if (addr.houseNumber) { lastHN = addr.houseNumber; }
                updateNextHNs();
            }
        }
    }
}
function handleLayerChanged({layerName}) {
    if (mode == 'HN' && layerName == 'house_numbers') {
        const vis = wmeSDK.Map.isLayerVisible( { layerName } );
        if (!vis) {
            updateModeButtons('Off');
        }
    }
}

async function createRPP(newInterval, useCurrentHN) {

    if (!lastHN) {
        console.warn('Quick HN+RPP: No house number reference found. Select a RPP or add a house number first.');
        return;
    }

    if (!lastStreetId) {
        console.warn('Quick HN+RPP: No street found. Select a RPP with a street address.');
        return;
    }

    let nextHN;
    if (useCurrentHN) {
        nextHN = lastHN;
    }
    else {
        // Calculate next house number
        nextHN = nextHNs[newInterval]?.[0];
    }
    if (!nextHN) return;

    // Let user place the RPP
    let geometry;
    try {
        geometry = await wmeSDK.Map.drawPoint();
    } catch(e) {
        // user canceled the draw point operation
        return;
    }

    // Create the venue
    const newVenueId = wmeSDK.DataModel.Venues.addVenue({
        category: "RESIDENTIAL",
        geometry: geometry
    });

    // Convert venueId to string for SDK methods
    const venueIdStr = String(newVenueId);

    // Update address
    wmeSDK.DataModel.Venues.updateAddress({
        houseNumber: nextHN,
        streetId: lastStreetId,
        venueId: venueIdStr
    });

    // Set navigation point
    wmeSDK.DataModel.Venues.replaceNavigationPoints({
        navigationPoints: [{
            isEntry: true,
            isPrimary: true,
            point: geometry
        }],
        venueId: venueIdStr
    });

    // Set lock level
    wmeSDK.DataModel.Venues.updateVenue({
        venueId: venueIdStr,
        lockRank: lockLevel - 1
    });

    // Update last HN for next creation
    lastHN = nextHN;
    updateNextHNs();

    await new Promise(r => setTimeout(r, 20));
    // Select the new RPP
    wmeSDK.Editing.setSelection({
        selection: {
            ids: [venueIdStr],
            objectType: "venue"
        }
    });
}

    function addOrZoom(newInterval, zoom) {
        if (!newInterval) return;

        if (mode === 'RPP') {
            interval = Number(newInterval);
            createRPP(interval);
            return;
        }

        if (mode === 'HN' && wmeSDK.Editing.getSelection()?.objectType == 'segment') {
            interval = Number(newInterval);
            fillnext = true;

            tlog('setFocus');

            document.querySelector('wz-button:has(.w-icon-home)').click();
        }
        else if (zoomKeys && zoom) wmeSDK.Map.setZoomLevel({ zoomLevel: zoom });
    }

    async function displayQHNtab() {
        const curDrawer = document.getElementById('drawer')?.querySelector('[selected]')?.querySelector('.w-icon');
        if (!curDrawer.classList?.contains('w-icon-script')) {
            document.querySelector('.w-icon-script').click();
        }

        await new Promise(r => setTimeout(r, 50));
        document.querySelector(`#${scriptId}`).click();
    }

    async function setHN() {
        tlog('setHN');
        const hnInput = document.querySelector('div.house-number.is-active input:placeholder-shown');
        if (!fillnext || !hnInput) return;

        fillnext = false;

        hnInput.value = nextHNs[interval][0];
        hnInput._valueTracker?.setValue("");
        hnInput.dispatchEvent(new Event("input", { bubbles: true }));

        await new Promise(r => setTimeout(r, 100));
        hnInput.blur();
    }

    function updateNextHNs() {
        nextHNs = {};

        for (const interval of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, custom]) {
            nextHNs[interval] = new Array(3);
            let baseHN = lastHN ?? '0';

            for (let index = 0; index < nextHNs[interval].length; index++) {
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
                nextHNs[interval][index] = baseHN;
            }
        }

        updateTabPane();
    }

    function updateTabPane() {
        const modeText = mode === 'RPP' ? 'RPP' : 'HN';
        const actionText = mode === 'RPP' ? 'create RPP' : 'insert HN';

        document.querySelector('#qhnTabPane').innerHTML = lastHN ?
            `<div>Last RPP/house number: <b>${lastHN}</b></div><br/><div>Press...` +
            [['T', 1], ['R', 2], ['E', custom], ...[...Array(10).keys()].map(key => [(key + 1) % 10, key + 1])].reduce((list, [key, interval]) =>
                `${list}<br/><b>${key}</b> ${zoomKeys && Number.isInteger(key) && mode === 'Off'
                    ? `to zoom to level ${interval + 10}`
                    : `to ${actionText} ${modeMultiplier > 0 ? "+" : "-"}${interval} <i>(${nextHNs[interval].join(", ")}...)</i>`}`
                , '')
            : `Manually set a house number or select an RPP to start using Quick HN+RPP`;
    }
})();