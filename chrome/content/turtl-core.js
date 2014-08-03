// set up our JS <--> C <--> lisp bridge (via js-ctypes)

if(typeof(ctypes) == 'undefined') Components.utils.import('resource://gre/modules/ctypes.jsm')
var tlib = ctypes.open('turtl');
var nlib = ctypes.open('nanomsg');
var turtl_core = {};

var turtl_url = 'inproc://turtl';

(function(exports) {
	var sock = null;
	var conn = null;

	var msg_cb_type = ctypes.FunctionType(
		ctypes.default_abi,
		ctypes.void_t,
		[ctypes.unsigned_long, ctypes.voidptr_t]
	);

	const turtl_init = tlib.declare('turtl_init', ctypes.default_abi, ctypes.int, ctypes.uint8_t);
	const turtl_shutdown = tlib.declare('turtl_shutdown', ctypes.default_abi, ctypes.void_t);
	const turtl_get_last_error = tlib.declare('turtl_get_last_error', ctypes.default_abi, ctypes.char.ptr);

	const af_sp = 1;
	const NN_PAIR = (1 * 16 + 0);
	const nn_socket = nlib.declare('nn_socket', ctypes.default_abi, ctypes.int, ctypes.int, ctypes.int);
	const nn_close = nlib.declare('nn_close', ctypes.default_abi, ctypes.int, ctypes.int);
	const nn_bind = nlib.declare('nn_bind', ctypes.default_abi, ctypes.int, ctypes.int, ctypes.char.ptr);
	const nn_connect = nlib.declare('nn_connect', ctypes.default_abi, ctypes.int, ctypes.int, ctypes.char.ptr);
	const nn_shutdown = nlib.declare('nn_shutdown', ctypes.default_abi, ctypes.int, ctypes.int, ctypes.int);
	const nn_send = nlib.declare('nn_send', ctypes.default_abi, ctypes.int, ctypes.int, ctypes.void_t.ptr, ctypes.size_t, ctypes.int);
	const nn_recv = nlib.declare('nn_recv', ctypes.default_abi, ctypes.int, ctypes.int, ctypes.void_t.ptr, ctypes.int, ctypes.int);

	var start = function(options)
	{
		options || (options = {});
		var flags = 0;
		if(options.single_threaded) flags = flags | (1 << 7);
		if(options.disable_output) flags = flags | (1 << 6);

		return turtl_init(flags);
	};

	var msg_to_buffer = function(length, msg_c)
	{
		var buff = new Uint8Array(length);
		var arr = ctypes.cast(msg_c, ctypes.unsigned_char.array(length).ptr);
		for(var i = 0; i < length; i++)
		{
			var val = arr.contents[i];
			buff[i] = val;
		}
		return buff;
	};

	var connect = function()
	{
		sock = nn_socket(af_sp, NN_PAIR);
		if(sock < 0) throw new Error('Error creating socket.');
		conn = nn_connect(sock, turtl_url);
		if(conn < 0) throw new Error('Error binding socket.');
	};

	var close = function()
	{
		nn_shutdown(sock, conn);
		nn_close(sock);
	};

	var recv = function(options)
	{
		options || (options = {});

		var flags = options.non_block ? 1 : 0;
		var pt = new ctypes.int(0).address();

		var length = nn_recv(sock, pt, -1, flags);
		if(length < 0) return false;

		var buf = new ctypes.voidptr_t(pt.contents);
		var data = msg_to_buffer(length, buf);
		return data;
	};

	var send = function(data)
	{
		var pt;
		if(typeof(data) == 'string')
		{
			pt = ctypes.char.array()(data);
		}
		else
		{
			// TODO
		}
		var success = nn_send(sock, pt, pt.length, 0);
	};

	var to_bytes = function(str)
	{
		var bytes = new Uint8Array(str.length);
		for(var i = 0; i < str.length; i++)
		{
			bytes[i] = str.charCodeAt(i);
		}
		return bytes;
	};

	var to_string = function(bytes)
	{
		var str = '';
		for(var i = 0; i < bytes.length; i++)
		{
			str += String.fromCharCode(bytes[i]);
		}
		return str;
	};

	var last_error = function()
	{
		return turtl_get_last_error().readString();
	};

	exports.init = start;
	exports.shutdown = turtl_shutdown;
	exports.connect = connect;
	exports.last_error = last_error;
	exports.send = send;
	exports.recv = recv;
	exports.close = function() { close(); tlib.close(); nlib.close(); };
	exports.to_bytes = to_bytes;
	exports.to_string = to_string;
})(typeof(exports) == 'undefined' ? turtl_core : exports);

