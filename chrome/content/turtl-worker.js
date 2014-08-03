importScripts('chrome://turtl/content/turtl-core.js');

turtl_core.connect();
var res = turtl_core.init({
	single_threaded: false,
	disable_output: false
});

onmessage = function(ev)
{
	//console.log('worker: msg: ', ev.data);
	if(ev.data && ev.data.msg)
	{
		turtl_core.send(JSON.stringify(ev.data.msg));
	}
};

var do_poll = function()
{
	var msg = turtl_core.recv({non_block: true});
	if(!msg) return;
	var ev = JSON.parse(turtl_core.to_string(msg));
	//console.log('worker: post: ', ev);
	postMessage(ev);
};
setInterval(do_poll, 50);

