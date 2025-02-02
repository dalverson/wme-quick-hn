// ==UserScript==
// @name         WME Quick HN (DaveAcincy fork)
// @description  Quick House Numbers
// @version      2025.02.02.01
// @author       Vinkoy (forked by DaveAcincy)
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @namespace    https://greasyfork.org/users/166713
// @homepage     https://www.waze.com/discuss/t/script-wme-quick-hn-daveacincy-fork/327021
// @require      https://greasyfork.org/scripts/24851-wazewrap/code/WazeWrap.js
// @grant        none
// @downloadURL https://update.greasyfork.org/scripts/458651/WME%20Quick%20HN%20%28DaveAcincy%20fork%29.user.js
// @updateURL https://update.greasyfork.org/scripts/458651/WME%20Quick%20HN%20%28DaveAcincy%20fork%29.meta.js
// ==/UserScript==

/* global W */
/* global I18n */
/* global $ */
/* global WazeWrap */

(function() {
    const _script_display_name = 'Quick HN';
    const _script_unique_id = 'wmeqhn';
    var counter = 0;
    var interval = 1;
    var policySafeHTML = null;
    var hnlayerobserver = null;
    var hnWatch = null;
    var autoSetHN = false;
    var zoomKeys = false;
    var debug = false;
    var fillnext = false;
    var initCount = 0;

    var wmeSDK;

    window.SDK_INITIALIZED.then(() => {
        wmeSDK = getWmeSdk({ scriptId: _script_unique_id, scriptName: _script_display_name});
        wmeSDK.Events.once({ eventName: "wme-ready" }).then(onWmeReady);
    });

function setupPolicy() {
    if (typeof trustedTypes !== "undefined") {
        policySafeHTML = trustedTypes.createPolicy("policySafeHTML", {createHTML:innerText => innerText});
    }
}
function createSafeHtml(text) {
    if (policySafeHTML !== null) {
        return policySafeHTML.createHTML(text);
    } else {
        return text;
    }
}

//Moving to SDK
/*function quickHN_bootstrap()
{
    if (typeof W === 'object' && W.userscripts?.state.isReady) {
        onWmeReady();
    } else {
        document.addEventListener("wme-ready", onWmeReady, {
            once: true,
        });
    }
}*/

function onWmeReady()
{
    initCount++;
    if (WazeWrap && WazeWrap.Ready)
        initialiseQuickHN();
    else {
        if (initCount == 1) {
            log('Waiting for WazeWrap...');
        } else if (initCount == 100) {
            console.error('Quick HN:', 'WazeWrap loading failed. Giving up.');
            return;
        }
        setTimeout(onWmeReady, 300);
    }
}

function createShortcut(id, desc, func, kcode)
{/* SDK shortcuts for when that's fixed
    const shortcut = {
        callback: () => func,
        description: desc,
        shortcutId: id,
        shortcutKeys: kcode,
    };
    wmeSDK.Shortcuts.createShortcut(shortcut);*/

    I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups.wmeqhn.members[id] = desc;
    var short = {};
    short[kcode] = id;
    W.accelerators.addAction(id, {group: _script_unique_id});
    W.accelerators.events.register(id, null, func);
    W.accelerators._registerShortcuts(short);
}

function log(message) {
    console.log('QuickHN: ' + message);
}

function dlog(message, data = '') {
    if (debug) { console.log('QuickHN# ' + message, data); }
}
function tlog(message, data = '') {
    const t = new Date;
    const h = t.getHours();
    const m = t.getMinutes();
    const s = t.getSeconds();
    const hms = h + ":" + m + ":" + s;
    const ms = ('00' + t.getMilliseconds()).slice(-3);
    if (debug) { console.log('QHN:' + hms +'.'+ ms + ': ' + message, data); }
}

function initialiseQuickHN()
{
    setupPolicy();

    let group = _script_unique_id;
    W.accelerators.Groups[group] = [];
    W.accelerators.Groups[group].members = [];
    I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[group] = [];
    I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[group].description = _script_display_name;
    I18n.translations[wmeSDK.Settings.getLocale().localeCode].keyboard_shortcuts.groups[group].members = [];

    createShortcut("WME_QHN_newHN01", "New HN (+1)", addHN1t, "t");
    createShortcut("WME_QHN_newHN02", "New HN (+2)", addHN2r, "r");
    createShortcut("WME_QHN_newHNcust", "New HN (+CUSTOM_VALUE)", addHNcustom, "e");
    createShortcut("WME_QHN_newHN1", "New HN (+1)", addHN1, "1");
    createShortcut("WME_QHN_newHN2", "New HN (+2)", addHN2, "2");
    createShortcut("WME_QHN_newHN3", "New HN (+3)", addHN3, "3");
    createShortcut("WME_QHN_newHN4", "New HN (+4)", addHN4, "4");
    createShortcut("WME_QHN_newHN5", "New HN (+5)", addHN5, "5");
    createShortcut("WME_QHN_newHN6", "New HN (+6)", addHN6, "6");
    createShortcut("WME_QHN_newHN7", "New HN (+7)", addHN7, "7");
    createShortcut("WME_QHN_newHN8", "New HN (+8)", addHN8, "8");
    createShortcut("WME_QHN_newHN9", "New HN (+9)", addHN9, "9");
    createShortcut("WME_QHN_newHN10","New HN (+10)", addHN10, "0");
    createShortcut("WME_QHN_newHN11", "New HN (+11)", addHN11, "S+1");
    createShortcut("WME_QHN_newHN12", "New HN (+12)", addHN12, "S+2");
    createShortcut("WME_QHN_newHN13", "New HN (+13)", addHN13, "S+3");
    createShortcut("WME_QHN_newHN14", "New HN (+14)", addHN14, "S+4");
    createShortcut("WME_QHN_newHN15", "New HN (+15)", addHN15, "S+5");
    createShortcut("WME_QHN_newHN16", "New HN (+16)", addHN16, "S+6");
    createShortcut("WME_QHN_newHN17", "New HN (+17)", addHN17, "S+7");
    createShortcut("WME_QHN_newHN18", "New HN (+18)", addHN18, "S+8");
    createShortcut("WME_QHN_newHN19", "New HN (+19)", addHN19, "S+9");
    createShortcut("WME_QHN_newHN20", "New HN (+20)", addHN20, "S+0");
    localDataManager();
    wmeSDK.Sidebar.registerScriptTab().then(({ tabLabel, tabPane }) => {
        tabLabel.innerText = _script_display_name;
        tabLabel.title = _script_display_name + ' Settings';
        tabPane.innerHTML = createSafeHtml('<div>'+
                    '<b>Quick House Numbers</b> v' + GM_info.script.version +
                    '</br>' +
                    '<div title="House number"><b>House number </b><input type="number" id="quick_hn_housenumber" style="width: 60px;"/></div>' +
                    '<div><input type="checkbox" name="quickHNAutoSetHNCheckBox" title="When enabled, Auto set next HN updates the next HN field based on the last HN created or moved" id="quickHNAutoSetHNCheckBox"><label for="quickHNAutoSetHNCheckBox">Auto set next HN on typed/moved HN</label></div>' +
                    '<div><input type="checkbox" name="quickHNzoomKeysCheckBox" title="1-9 => Z11-19; 0 => Z20" id="quickHNzoomKeysCheckBox"><label for="quickHNzoomKeysCheckBox">Zoom Keys when no segment</label></div>' +
                    '<div>Press <b>T</b> to add <u>HN +1</u> <i>(1,2,3...)</i></div>' +
                    '<div>Press <b>R</b> to add <u>HN +2</u> <i>(1,3,5... or 2,4,6...)</i></div>' +
                    '<div>Press <b>E</b> to add <u>HN +</u><input type="number" id="quick_hn_custominterval" style="width: 42px;margin-left: 6px;height: 22px;"></div>' +
                    '<div>Press <b>1 - 9</b> to add <u>HN +x</u></div>' +
                    '<div>Press <b>0</b> to add <u>HN +10</u></div>' +
                    '<div>Press <b>SHIFT</b> and <b>1 - 9</b> to add <u>HN +1x</u> (<i>11,12,13...)</i></div>' +
                    '<div>Press <b>SHIFT</b> and <b>0</b> to add <u>HN +20</u></div>');

        localDataManager();

        $('#quickHNAutoSetHNCheckBox').change(function onAutosetCheckChanged() {
            autoSetHN = this.checked;
            if (autoSetHN)
                WazeWrap.Events.register("afteraction",null, hnActionCheck);
            else
                WazeWrap.Events.unregister("afteraction",null, hnActionCheck);
            wme_saveQuickHNOptions();
        });

        $('#quickHNzoomKeysCheckBox').change(function onZoomKeysCheckChanged() {
            zoomKeys = this.checked;
            wme_saveQuickHNOptions();
        });
        var hn = document.getElementById('quick_hn_housenumber');
        if (hn) {
            document.getElementById('quick_hn_housenumber').value = counter + 1;
            document.getElementById('quick_hn_housenumber').onchange = function(){
                counter = document.getElementById('quick_hn_housenumber').value - 1;
            };

            //If user has Auto Set Next HN turned on, register an event to watch changes
            if (autoSetHN)
                WazeWrap.Events.register("afteraction",null, hnActionCheck);
        }
    });

    hnlayerobserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // Mutation is a NodeList and doesn't support forEach like an array
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                var addedNode = mutation.addedNodes[i];

                // Only fire up if it's a node
                if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode.className == 'house-number is-active') {
                    var x = addedNode.querySelector('input');
                    if (x !== undefined) {
                        x.onfocus = function() { sethn(); };
                    }
                }
            }

        });
    });

    wmeSDK.Events.on({eventName: "wme-selection-changed", eventHandler: () => {
        if (wmeSDK.Editing.getSelection()?.objectType == "segment")
        {
            var maplayer = document.getElementById("WazeMap");
            hnlayerobserver.observe(maplayer, { childList: true, subtree: true });
        } else
            hnlayerobserver.disconnect();
        }
    });

    log("initialize complete");
}

function wme_saveQuickHNOptions()
{
    if (localStorage)
    {
        var options = [];
        // preserve previous options which may get lost after logout
        if (localStorage.WMEquickHN)
            options = JSON.parse(localStorage.WMEquickHN);

        options[1] = document.getElementById('quick_hn_custominterval').value;
        options[2] = autoSetHN;
        options[3] = zoomKeys;

        localStorage.WMEquickHN = JSON.stringify(options);
    }
}

function localDataManager()
{
    // restore saved settings
    var cust = 4;
    if (localStorage.WMEquickHN) {
        var options = JSON.parse(localStorage.WMEquickHN);
        if (options[1] !== undefined)
            cust = options[1];
        if (options[2] !== undefined)
            autoSetHN = options[2];
        if (options[3] !== undefined)
            zoomKeys = options[3];
    }
    const cele = document.getElementById('quick_hn_custominterval');
    if (cele) {
        cele.value = cust;
        cele.onchange = wme_saveQuickHNOptions;
    }

    $('#quickHNAutoSetHNCheckBox').prop('checked', autoSetHN);
    $('#quickHNzoomKeysCheckBox').prop('checked', zoomKeys);
    window.addEventListener("beforeunload", wme_saveQuickHNOptions, false);
}

//Watches changes for new/moved HNs and updates the counter and house number text box
function hnActionCheck() {
    try {
        const lastAction = W.model.actionManager.getActions()[W.model.actionManager.getActionsNum()-1];
        const actionHN = +lastAction.houseNumber.getAttribute('number');
        if (counter != actionHN) {
            counter = actionHN;
            tlog('action: ' + actionHN, lastAction.houseNumber);
            if (document.getElementById('quick_hn_housenumber') !== null )
                document.getElementById('quick_hn_housenumber').value = counter + 1;
        }
    }
    catch {
        return;
    }
}

function activateEditTab(ind) {
    var ed = getElementsByClassName('segment-feature-editor');
    var tabs = ed[0].querySelector('wz-tabs');
    var tl = tabs.shadowRoot.querySelectorAll('.wz-tab-label');
    if ( tl && tl.length > 0) {
        if (ind < 0) ind = tl.length + ind;
        tl[ind].click();
    }
}

function getElementsByClassName(classname, node) {
    if(!node)
        node = document.getElementsByTagName("body")[0];
    var a = [];
    var re = new RegExp('\\b' + classname + '\\b');
    var els = node.getElementsByTagName("*");
    for (var i=0,j=els.length; i<j; i++)
        if (re.test(els[i].className)) a.push(els[i]);
    return a;
}

function addHN1t() { if (wmeSDK.Editing.getSelection()?.objectType == "segment"){ interval = 1; setFocus(); }}
function addHN2r() { if (wmeSDK.Editing.getSelection()?.objectType == "segment"){ interval = 2; setFocus(); }}
function addHN1() { addOrZoom(1, 11); }
function addHN2() { addOrZoom(2, 12); }
function addHN3() { addOrZoom(3, 13); }
function addHN4() { addOrZoom(4, 14); }
function addHN5() { addOrZoom(5, 15); }
function addHN6() { addOrZoom(6, 16); }
function addHN7() { addOrZoom(7, 17); }
function addHN8() { addOrZoom(8, 18); }
function addHN9() { addOrZoom(9, 19); }
function addHN10() { addOrZoom(10, 20); }
function addHN11() { addOrZoom(11, 11); }
function addHN12() { addOrZoom(12, 12); }
function addHN13() { addOrZoom(13, 13); }
function addHN14() { addOrZoom(14, 14); }
function addHN15() { addOrZoom(15, 15); }
function addHN16() { addOrZoom(16, 16); }
function addHN17() { addOrZoom(17, 17); }
function addHN18() { addOrZoom(18, 18); }
function addHN19() { addOrZoom(19, 19); }
function addHN20() { addOrZoom(20, 20); }

function addOrZoom( ival, zoom )
{
    if (wmeSDK.Editing.getSelection()?.objectType == "segment") {
        interval = ival;
        setFocus();
    }
    else {
        if (zoomKeys) {
            W.map.olMap.zoomTo(zoom);
        }
    }
}

function addHNcustom()
{
    if (wmeSDK.Editing.getSelection()?.objectType == "segment")
    {
        var temp = document.getElementById('quick_hn_custominterval');
        //dlog("add cust el: " + temp.parentElement.innerText);
        interval = document.getElementById('quick_hn_custominterval').value;
        dlog("add cust " + interval);
        setFocus();
    }
}

async function setFocus()
{
    tlog('setFocus');
    fillnext = true;
    $('#segment-edit-general > div:nth-child(2) > wz-button').click();
}

// this may be a hack but works for now.  https://stackoverflow.com/questions/30683628/react-js-setting-value-of-input
function setNativeValue(element, value) {
    let lastValue = element.value;
    element.value = value;
    let event = new Event("input", { target: element, bubbles: true });
    // React 15
    event.simulated = true;
    // React 16
    let tracker = element._valueTracker;
    if (tracker) {
        tracker.setValue(lastValue);
    }
    element.dispatchEvent(event);
}

async function sethn() {
    tlog('sethn');
    var hn = $('div.olLayerDiv.house-numbers-layer div.house-number div.content.active:not(".new") input.number');
    if (fillnext && hn[0].placeholder == I18n.translations[wmeSDK.Settings.getLocale().localeCode].edit.segment.house_numbers.no_number && hn.val() === "")
    {
        dlog("sethn ctr " + counter + " ival " + interval);
        counter = +counter + +interval;
        if (document.getElementById('quick_hn_housenumber') !== null )
            document.getElementById('quick_hn_housenumber').value = counter + 1;
        setNativeValue(hn[0], counter);
        await new Promise(r => setTimeout(r,80));
        $("div#WazeMap").focus();
        fillnext = false;
    }
}
})();
