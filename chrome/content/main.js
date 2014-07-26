// -----------------------------------------------------------------------------
// general setup
// -----------------------------------------------------------------------------
var turtl = null;		// filled in later
var browser = document.getElementById('browser');
var homeurl = browser.getAttribute('src');
var reload = function() { browser.loadURI(homeurl); };
var profile_dir = Components.classes["@mozilla.org/file/directory_service;1"].getService(Components.interfaces.nsIProperties).get("ProfD", Components.interfaces.nsILocalFile).path;

Components.utils.import('resource://gre/modules/devtools/dbg-server.jsm');
if (!DebuggerServer.initialized) {
	DebuggerServer.init();
	// Don't specify a window type parameter below if "navigator:browser"
	// is suitable for your app.
	//DebuggerServer.addBrowserActors('chrome');
	DebuggerServer.addBrowserActors("top");
}
DebuggerServer.openListener(6000);

// -----------------------------------------------------------------------------
// set up global comm object
// -----------------------------------------------------------------------------
var comm = new Comm();
var set_comm = function()
{
	turtl = browser.contentWindow.turtl;
	browser.contentWindow.port = new browser.contentWindow.DesktopAddonPort({
		comm: comm
	});
};
browser.addEventListener('DOMContentLoaded', set_comm, false);

// -----------------------------------------------------------------------------
// load turtl-core
// -----------------------------------------------------------------------------
var turtl_worker = new ChromeWorker('./turtl-worker.js');
turtl_worker.onmessage = function(e)
{
	turtl_core.recv(e.data);
};

var turtl_core = {
	send: function(ev)
	{
		ev || (ev = {ev: 'ping'});
		console.log('turtl-core: send: ', ev);
		turtl_worker.postMessage({msg: ev});
	},

	recv: function(ev)
	{
		console.log('turtl-core: recv: ', ev);
		comm.trigger('core-recv', ev);
	},

	reload: function()
	{
		turtl_core.send({ev: 'cmd', data: {name: 'reload'}});
	}
};

comm.bind('core-recv', function(ev) {
	switch(ev.ev)
	{
	case 'turtl-loaded':
		turtl_core.send({ev: 'cmd', data: {name: 'set-data-directory', path: profile_dir}});
		break;
	}
});

comm.bind('core-send', function(ev) {
	// forward it to turtl-core
	turtl_core.send(ev);
});

