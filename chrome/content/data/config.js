if(typeof(config) == 'undefined') window.config = {};
Object.merge( config, {
	api_url: 'http://turtl.dev:8181/api',
	console: true,
	xul: true
});

window._in_desktop = true;
window._firefox = true;

Components.utils.importGlobalProperties(["indexedDB"]);
var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
var ssm = Components.classes["@mozilla.org/scriptsecuritymanager;1"].getService(Components.interfaces.nsIScriptSecurityManager);
var dsm = Components.classes["@mozilla.org/dom/storagemanager;1"].getService(Components.interfaces.nsIDOMStorageManager);
var uri = ios.newURI('chrome://turtl/content/data', "", null);
var principal = ssm.getCodebasePrincipal(uri);
var storage = dsm.getLocalStorageForPrincipal(principal, "");
window.Tstorage = storage;
window._route_base = '/content';

