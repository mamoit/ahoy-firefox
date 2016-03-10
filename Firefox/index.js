//Constants
const {Cc, Ci, Cu} = require("chrome");
const { pathFor } = require('sdk/system');
const { data } = require('sdk/self');
const path = require('sdk/fs/path');
const file = require('sdk/io/file');
const APIAdress = "http://46.101.64.62";

//Variables 
var prompts = Cc["@mozilla.org/embedcomp/prompt-service;1"].getService(Ci.nsIPromptService);
var pps = Cc["@mozilla.org/network/protocol-proxy-service;1"].getService(Ci.nsIProtocolProxyService);
var { setTimeout } = require("sdk/timers");
var Request = require("sdk/request").Request;
var { ToggleButton } = require('sdk/ui/button/toggle');
var tabs = require("sdk/tabs");
var panels = require("sdk/panel");
var prefsvc = require("sdk/preferences/service");
var version = require("sdk/self").version;
var proxyAddress = "";
var auxJSON = {};
var blockedSites = [];

var panel = panels.Panel({
    width: 305,
    height: 327,
    contentURL: data.url("views/popup.html"),
    contentScriptFile: data.url("views/popup.js"),
    onHide: handleHide
});

//Huuum, alguém me pediu um proxy...
panel.port.on("daNovoProxy", function(url) {
    getProxy();
    getBlockedSitesList();
});

//Bring me the list!
panel.port.on("openTabSites", function(url) {
    openTabWithBlockedLinks();
});

panel.on('show', function() {
    panel.port.emit('currentURL', tabs.activeTab.url, blockedSites);

})

var button = ToggleButton({
    id: "ahoy-status",
    label: "Ahoy!",
    icon: {
        "16": "./icon-16.png",
        "32": "./icon-32.png",
        "64": "./ion-64.png"
    },
    onChange: handleChange
});

function handleChange(state) {
    if (state.checked) {
        panel.show({
            position: button
        });
    }
}

function handleHide() {
    button.state('window', {checked: false});
}

function getProxy()
{
    Request({
        url: APIAdress+"/api/getProxy",
        onComplete: function (response) {
            auxJSON.host = response.json["host"];
            auxJSON.port = response.json["port"];
        }
    }).get();
}

function openTabWithBlockedLinks()
{
    tabs.open({
        url: "https://sitesbloqueados.pt/?utm_source=ahoy&utm_medium=firefox&utm_campaign=Ahoy%20Firefox",
        inBackground: true,
        onOpen: function(tab) {
            tab.activate();
            panel.hide();
        }
    });
}

function getBlockedSitesList()
{
    Request({
        url: APIAdress+"/api/sites",
        onComplete: function (response) {
            Object.keys(response.json).map(function(value, index) {
                blockedSites.push(response.json[index]);
            });
        }.bind(blockedSites)
    }).get();
}

/*
function logURL(tab)
{
    //check if the website we're trying to visit already exists on the blocked website list
    //we ONLY send statistics to our servers if the website that's beeing visited is on the list of blocked sites
    var cleanURL = tab.url.replace(/.*?:\/\/www.|.*?:\/\//g,"").replace(/\//g,"");
    if (blockedSites.indexOf(cleanURL) > -1)
    {
        Request({
            url: APIAdress+"/api/stats/host/"+cleanURL
        }).get();
    }
}
*/

function setAhoyFilter()
{
    // Create the proxy info object in advance to avoid creating one every time
    var ahoyProxy = pps.newProxyInfo("http", auxJSON.host, auxJSON.port, 0, -1, null);

    var filter = {
        applyFilter: function(pps, uri, proxy)
        {
            if (blockedSites.indexOf(uri.spec.replace(/.*?:\/\/www.|.*?:\/\//g,"").replace(/\/.+/g,"").replace(/\//g,"")) > -1)
            {
                return ahoyProxy;
            }
            else
            {
                return proxy;
            }
        }
    };
    pps.registerFilter(filter, 1000);

    panel.postMessage(auxJSON);
}

function setIcon()
{
    panel.port.emit('greyIcon', tabs.activeTab.url);
}

//execute this function every 30 minutes
//miliseconds * second * minutes
setTimeout(function() { updateAhoy(); }, (1000 * 60 * 30));

function updateAhoy() {
    getBlockedSitesList();

    setTimeout(function() { updateAhoy(); }, (1000 * 60 * 30));
}

(function waitForProxy() {
    if ( auxJSON.host && auxJSON.port ) {
        setAhoyFilter();
    } else {
        setTimeout( waitForProxy, 500 );
    }
})();

auxJSON.version = version;

getBlockedSitesList();

getProxy();

//tabs.on("ready", logURL);
tabs.on("read", setIcon);

panel.postMessage(auxJSON);