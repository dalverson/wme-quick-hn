// ==UserScript==
// @name         WME Quick HN (DaveAcincy fork)
// @description  Quick House Numbers
// @version      2023.01.21.01
// @author       Vinkoy (forked by DaveAcincy)
// @match        https://beta.waze.com/*editor*
// @match        https://www.waze.com/*editor*
// @exclude      https://www.waze.com/*user/*editor/*
// @namespace    https://greasyfork.org/users/166713
// @grant        none
// ==/UserScript==

/* global W */
/* global I18n */

(function() {
    var counter = 0;
    var interval = 1;

function quickHN_bootstrap()
{
    var oWaze=W;
	var oI18n=I18n;

	if (typeof unsafeWindow !== "undefined")
	{
		oWaze=unsafeWindow.W;
		oI18n=unsafeWindow.I18n;
	}

	if (typeof oWaze === "undefined")
	{
		setTimeout(quickHN_bootstrap, 500);
		return;
	}
	if (typeof oWaze.map === "undefined")
	{
		setTimeout(quickHN_bootstrap, 500);
		return;
	}
	if (typeof oWaze.selectionManager === "undefined")
	{
		setTimeout(quickHN_bootstrap, 500);
		return;
	}
	if (typeof oI18n === "undefined")
	{
		setTimeout(quickHN_bootstrap, 500);
		return;
	}
	if (typeof oI18n.translations === "undefined")
	{
		setTimeout(quickHN_bootstrap, 500);
		return;
	}

    oWaze.selectionManager.events.register("selectionchanged", null, addTab);

    setTimeout(initialiseQuickHN, 999);
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

function initialiseQuickHN()
{
    var ep = document.getElementById('edit-panel');
    var lb = document.getElementById('map-lightbox');
    if ( !ep || !lb) {
        setTimeout(initialiseQuickHN, 200);
        return;
    }

    var editPanelChange = new MutationObserver(function(mutations)
    {
        mutations.forEach(function(mutation)
        {
            for (var i = 0; i < mutation.addedNodes.length; i++)
            {
                if (mutation.addedNodes[i].nodeType === Node.ELEMENT_NODE && mutation.addedNodes[i].querySelector('div.segment-edit-section'))
                {
                    addTab();
                    if (document.getElementById("WME-Quick-HN")) localDataManager();
                }
            }
        });
    });
    editPanelChange.observe(ep, { childList: true, subtree: true });

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

}

function localDataManager()
{
    // restore saved settings
    if (localStorage.WMEquickHN)
    {
        options = JSON.parse(localStorage.WMEquickHN);
        if(options[1] !== undefined)
            document.getElementById('_custominterval').value = options[1];
        else
            document.getElementById('_custominterval').value = 4;
    }
    else
    {
        document.getElementById('_custominterval').value = 4;
    }
    // overload the WME exit function
    wme_saveQuickHNOptions = function()
    {
        if (localStorage)
        {
            var options = [];

            // preserve previous options which may get lost after logout
            if (localStorage.WMEquickHN)
                options = JSON.parse(localStorage.WMEquickHN);

            options[1] = document.getElementById('_custominterval').value;

            localStorage.WMEquickHN = JSON.stringify(options);
        }
    };
    document.getElementById('_custominterval').onchange = wme_saveQuickHNOptions;
    window.addEventListener("beforeunload", wme_saveQuickHNOptions, false);
}

function addTab()
{
    if(!document.getElementById("WME-Quick-HN") && W.selectionManager.getSelectedFeatures().length > 0 && W.selectionManager.getSelectedFeatures()[0].model.type === 'segment')
    {
        var userTabs = document.getElementById('edit-panel');
        if (!(userTabs && getElementsByClassName('nav-tabs', userTabs)))
            return;

        var navTabs = document.getElementById('edit-panel').getElementsByTagName('wz-tabs')[0];
        if (!navTabs) {
            setTimeout(addTab, 200);
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
                quickTab.id = 'wmequickhn';
                quickTab.label = 'Quick HN';
                navTabs.appendChild(quickTab);

                btnSection.innerHTML = '<div class="form-group">'+
                    '<b>Quick House Numbers</b> v' + GM_info.script.version +
                    '</br>' +
                    '<div title="House number"><b>House number </b><input type="number" id="_housenumber" style="width: 60px;"/></div>' +
                    '<div>Press <b>T</b> to add <u>HN +1</u> <i>(1,2,3...)</i></div>' +
                    '<div>Press <b>R</b> to add <u>HN +2</u> <i>(1,3,5... or 2,4,6...)</i></div>' +
                    '<div>Press <b>E</b> to add <u>HN +</u><input type="number" id="_custominterval" style="width: 42px;margin-left: 6px;height: 22px;"></div>' +
                    '<div>Press <b>1 - 9</b> to add <u>HN +x</u></div>' +
                    '<div>Press <b>0</b> to add <u>HN +10</u></div>';

                btnSection.className = "quickhn";
                quickTab.appendChild(btnSection);
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

        var hn = document.getElementById('_housenumber');
        if (hn) {
            document.getElementById('_housenumber').value = counter + 1;
            document.getElementById('_housenumber').onchange = function(){
                counter = document.getElementById('_housenumber').value - 1;
            };
        }
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
    interval = document.getElementById('_custominterval').value;
    setFocus();
}

function setFocus()
{
    $('#toolbar .add-house-number').click();
    $('#toolbar .add-house-number').click();
    var hn = getElementsByClassName("number");
    for (i=0; i<hn.length; i++)
    {
            hn[i].onfocus = function() { sethn(); };
    }
}

function sethn() {
   var hn = $('div.olLayerDiv.house-numbers-layer div.house-number div.content.active:not(".new") input.number');
   if (hn[0].placeholder == I18n.translations[I18n.locale].edit.segment.house_numbers.no_number && hn.val() === "")
   {
      counter = +counter + +interval;
      if (document.getElementById('_housenumber') !== null )
         document.getElementById('_housenumber').value = counter + 1;
      hn.val(counter).change();
      $("div#WazeMap").focus();
   }
}

quickHN_bootstrap();
})();
