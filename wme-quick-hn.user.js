// ==UserScript==
// @name         WME Quick HN (DaveAcincy fork)
// @description  Quick House Numbers
// @version      2023.11.28.01
// @author       Vinkoy (forked by DaveAcincy)
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @namespace    https://greasyfork.org/users/166713
// @homepage     https://www.waze.com/forum/viewtopic.php?t=371460
// @grant        none
// ==/UserScript==

/* global W */
/* global I18n */
/* global $ */

(function() {
    var counter = 0;
    var interval = 1;
    var policySafeHTML = null;
    var hnlayerobserver = null;
    var hnWatch = null;
    var autoSetHN = false;
    var debug = false;
    var fillnext = false;

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

function quickHN_bootstrap()
{
    if (typeof W === 'object' && W.userscripts?.state.isReady) {
        initialiseQuickHN();
    } else {
        document.addEventListener("wme-ready", initialiseQuickHN, {
            once: true,
        });
    }
}

function createShortcut(id, desc, func, kcode)
{
    I18n.translations[I18n.locale].keyboard_shortcuts.groups.wmeqhn.members[id] = desc;
    var short = {};
    short[kcode] = id;
    W.accelerators.addAction(id, {group: 'wmeqhn'});
    W.accelerators.events.register(id, null, func);
    W.accelerators._registerShortcuts(short);
}

function log(message) {
    console.log('QuickHN: ' + message);
}

function dlog(message) {
    if (debug) { console.log('QuickHN# ' + message); }
}
function tlog(message) {
    const t = new Date;
    const h = t.getHours();
    const m = t.getMinutes();
    const s = t.getSeconds();
    const hms = h + ":" + m + ":" + s;
    const ms = ('00' + t.getMilliseconds()).slice(-3);
    if (debug) { console.log('QHN:' + hms +'.'+ ms + ': ' + message); }
}

function initialiseQuickHN()
{
    var ep = document.getElementById('edit-panel');
    var lb = document.getElementById('map-lightbox');
    if ( !ep || !lb) {
        setTimeout(initialiseQuickHN, 200);
        return;
    }

    setupPolicy();
    W.editingMediator.on({ 'change:editingHouseNumbers': onChangeHNMode });

    var hnWindowShow = new MutationObserver(function(mutations)
    {
        mutations.forEach(function(mutation)
        {
            if (mutation.type == 'childList') {
                $('.sidebar-layout > .overlay').remove();
            }
        });
    });
    hnWindowShow.observe(lb, { childList: true, subtree: true } );
    hnlayerobserver = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            // Mutation is a NodeList and doesn't support forEach like an array
            for (var i = 0; i < mutation.addedNodes.length; i++) {
                var addedNode = mutation.addedNodes[i];

                // Only fire up if it's a node
                if (addedNode.nodeType === Node.ELEMENT_NODE && addedNode.classList.contains('is-active')) {
                    var x = addedNode.querySelector('input');
                    if (x !== undefined) {
                        x.onfocus = function() { sethn(); };
                    }
                }
            }

        });
    });

    let group = "wmeqhn";
    W.accelerators.Groups[group] = [];
    W.accelerators.Groups[group].members = [];
    I18n.translations[I18n.currentLocale()].keyboard_shortcuts.groups[group] = [];
    I18n.translations[I18n.currentLocale()].keyboard_shortcuts.groups[group].description = "Quick HN";
    I18n.translations[I18n.currentLocale()].keyboard_shortcuts.groups[group].members = [];

    createShortcut("WME_QHN_newHN01", "New HN (+1)", addHN1, "t");
    createShortcut("WME_QHN_newHN02", "New HN (+2)", addHN2, "r");
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

        options[1] = document.getElementById('_custominterval').value;
        options[2] = autoSetHN;

        localStorage.WMEquickHN = JSON.stringify(options);
    }
}

function localDataManager()
{
    // restore saved settings
    if (localStorage.WMEquickHN)
    {
        var options = JSON.parse(localStorage.WMEquickHN);
        if(options[1] !== undefined)
            document.getElementById('_custominterval').value = options[1];
        else
            document.getElementById('_custominterval').value = 4;
        if(options[2] !== undefined)
            autoSetHN = options[2];
    }
    else
    {
        document.getElementById('_custominterval').value = 4;
    }
    // $('#quickHNAutoSetHNCheckBox').prop('checked', autoSetHN);
    document.getElementById('_custominterval').onchange = wme_saveQuickHNOptions;
    window.addEventListener("beforeunload", wme_saveQuickHNOptions, false);
}

async function onChangeHNMode()
{
    if (!W.editingMediator.attributes.editingHouseNumbers) {
        if(document.getElementById("WME-Quick-HN")) {
            hnlayerobserver.disconnect();
            $('#WME-Quick-HN').remove();
            $('.wmequickhn-tab').remove();
            await new Promise(r => setTimeout(r,100));
            activateEditTab(0);
        }
    }
    if(!document.getElementById("WME-Quick-HN") && W.editingMediator.attributes.editingHouseNumbers)
    {
        await new Promise(r => setTimeout(r,20));
        var userTabs = document.getElementById('edit-panel');
        if (!(userTabs && getElementsByClassName('nav-tabs', userTabs)))
            return;

        var navTabs = document.getElementById('edit-panel').getElementsByTagName('wz-tabs')[0];
        if (!navTabs) {
            setTimeout(onChangeHNMode, 200);
            return;
        }

        var btnSection = document.createElement('div');
        btnSection.id = 'WME-Quick-HN';
        if (typeof navTabs !== "undefined")
        {
            var tabContent = getElementsByClassName('segment-edit-section', userTabs)[0];

            if (typeof tabContent !== "undefined")
            {
                var quickTab = document.createElement('wz-tab');
                quickTab.className = 'wmequickhn-tab';
                quickTab.label = 'Quick HN';
                navTabs.appendChild(quickTab);

                btnSection.innerHTML = createSafeHtml('<div>'+
                    '<b>Quick House Numbers</b> v' + GM_info.script.version +
                    '</br>' +
                    '<div title="House number"><b>House number </b><input type="number" id="_housenumber" style="width: 60px;"/></div>' +
                   /* '<div><input type="checkbox" name="quickHNAutoSetHNCheckBox" title="When enabled, Auto set next HN updates the next HN field based on the last HN created or moved" id="quickHNAutoSetHNCheckBox"><label for="quickHNAutoSetHNCheckBox">Auto Set next HN on typed/moved HN</label></div>' + */
                    '<div>Press <b>T</b> to add <u>HN +1</u> <i>(1,2,3...)</i></div>' +
                    '<div>Press <b>R</b> to add <u>HN +2</u> <i>(1,3,5... or 2,4,6...)</i></div>' +
                    '<div>Press <b>E</b> to add <u>HN +</u><input type="number" id="_custominterval" style="width: 42px;margin-left: 6px;height: 22px;"></div>' +
                    '<div>Press <b>1 - 9</b> to add <u>HN +x</u></div>' +
                    '<div>Press <b>0</b> to add <u>HN +10</u></div>');

                btnSection.className = "quickhn";
                quickTab.appendChild(btnSection);
                quickTab.setAttribute("is-active","false");
                localDataManager();

                /* $('#quickHNAutoSetHNCheckBox').change(function onAutosetCheckChanged() {
                    autoSetHN = this.checked;
                    if (autoSetHN)
                        hnWatch.observe($('div.house-numbers-layer')[0], { childList: true, subtree: true });
                    else
                        hnWatch.disconnect();
                    wme_saveQuickHNOptions();
                }); */

                var tabChange = new MutationObserver(function(mutations) {
                    mutations.forEach(function(mutation) {
                        if (mutation.type === "attributes" && mutation.attributeName == "is-active") {
                            if (mutation.target.isActive) {
                                var tabs = document.getElementById('edit-panel').getElementsByTagName('wz-tabs')[0].getElementsByTagName('wz-tab');
                                for (var i=0; i < tabs.length; i++) {
                                    if (tabs[i] != quickTab) {
                                        tabs[i].setAttribute("is-active","false");
                                    }
                                }
                                mutation.target.style.display="block";
                            }
                            else {
                                mutation.target.style.display="none";
                            }
                        }
                    });
                });
                tabChange.observe(quickTab, { attributes: true });

                await new Promise(r => setTimeout(r,50));
                activateEditTab(-1);
            }
            else
            {
                btnSection.id='';
            }
        }
        else
        {
            btnSection.id='';
        }

        var hnlayer = getElementsByClassName("house-numbers-layer");
        hnlayerobserver.observe(hnlayer[0], { childList: true });

        var hn = document.getElementById('_housenumber');
        if (hn) {
            document.getElementById('_housenumber').value = counter + 1;
            document.getElementById('_housenumber').onchange = function(){
                counter = document.getElementById('_housenumber').value - 1;
            };

            //Watch HN layers to capture gaps
            /*
            hnWatch = new MutationObserver(mutations => {
                mutations.forEach(mutation => {
                    tlog('Mutation');
                    console.log('M ',mutation);
                    mutation.addedNodes.forEach(n => {
                        if (n.classList?.contains('valid-true')) {
                            counter = n.childNodes[1].childNodes[1].value;
                            tlog('autoset next: ' + (Number(counter) + 1));
                            if (document.getElementById('_housenumber') !== null ) {
                                document.getElementById('_housenumber').value = +counter + 1;
                            }
                        }
                    });
                });
            });

            if (autoSetHN)
                hnWatch.observe($('div.house-numbers-layer')[0], { childList: true, subtree: true });
            */
       }
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

function addHN1() { interval = 1; setFocus(); }
function addHN2() { interval = 2; setFocus(); }
function addHN3() { interval = 3; setFocus(); }
function addHN4() { interval = 4; setFocus(); }
function addHN5() { interval = 5; setFocus(); }
function addHN6() { interval = 6; setFocus(); }
function addHN7() { interval = 7; setFocus(); }
function addHN8() { interval = 8; setFocus(); }
function addHN9() { interval = 9; setFocus(); }
function addHN10() { interval = 10; setFocus(); }

function addHNcustom()
{
    var temp = document.getElementById('_custominterval');
    //dlog("add cust el: " + temp.parentElement.innerText);
    interval = document.getElementById('_custominterval').value;
    dlog("add cust " + interval);
    setFocus();
}

async function setFocus()
{
    tlog('setFocus');
    fillnext = true;
    $('#toolbar .add-house-number').click();
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
    if (fillnext && hn[0].placeholder == I18n.translations[I18n.locale].edit.segment.house_numbers.no_number && hn.val() === "")
    {
        dlog("sethn ctr " + counter + " ival " + interval);
        counter = +counter + +interval;
        if (document.getElementById('_housenumber') !== null )
            document.getElementById('_housenumber').value = counter + 1;
        setNativeValue(hn[0], counter);
        await new Promise(r => setTimeout(r,80));
        $("div#WazeMap").focus();
        fillnext = false;
    }
}

quickHN_bootstrap();
})();
