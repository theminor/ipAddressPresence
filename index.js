var util = require('util');
var stream = require('stream');
var exec = require('child_process').exec;

util.inherits(Driver,stream);
util.inherits(Device,stream);

function Driver(opts, app) {
	var self = this;
	this._app = app;
	this.opts = opts;
	this.ipPrsDevice = undefined;
	app.on('client::up', function(){
		self.ipPrsDevice = new Device(app, opts); // driver has a single device, so easy to track it...
		self.emit('register', self.ipPrsDevice);
		updateDevice(self.ipPrsDevice);
		process.nextTick(function() {  // Update every "updateInterval" milliseconds
			self.intervalID = setInterval(function() {  // intervalID is for using clearInterval() later when things get updated...
				updateDevice(self.ipPrsDevice);
			}, opts.updateInterval);
		});
	});
};

function Device(app, opts) {
	app.log.info('Creating ipAddressPresence Device');
	var self = this;
	this._app = app;
	this.opts = opts;
	this.writeable = false;
	this.readable = true;
	this.V = 0;
	this.D = 261; // device id 261 is wifi presence ID
	this.G = "ipAddressPresence";
	this.name = "ipAddressPresence";
	if (!opts.updateInterval) opts.updateInterval = 60000;
	if (!opts.pingTimeoutTime) opts.pingTimeoutTime = 5;
	// *** tmp ***
	opts.ipAddresses = ["192.168.1.138", "192.168.1.205"]
	// ***********
};

function updateDevice(device) {
	var app = device._app;
	app.log.info("ipAddressPresence updating...");
	var pingTimeoutTime = device.opts.pingTimeoutTime;
	var foundPings = ;
	device.opts.ipAddresses.forEach(function(ipAddress) {
		exec("ping -q -w " + pingTimeoutTime + " -c 1 " + ipAddress, function(error, stdout, stderr) {
			app.log.info("ipAddressPresence pinged " + ipAddress + " -- error: " + error + " -- stderr: " + stderr);
			if (error || stderr) {
				app.log.info("ipAddressPresence " + ipAddress + " not found");
			}
			else {
				app.log.info("ipAddressPresence adding " + ipAddress + " to active ping table");
				foundPings.push(ipAddress);
			};
			if (foundPings[0]) {  // we found at least one device on the network
				app.log.info("ipAddressPresence emmitting 1");
				device.emit('data', 1);
			}
			else {
				app.log.info("ipAddressPresence emmitting 0");
				device.emit('data', 0);
			};
		});
	});
};

module.exports = Driver;

Driver.prototype.config = function(rpc, cb) {
	var self = this;
	var ipAdrStg = "";
	var firstIp = true;
	self.opts.ipAddresses.forEach(function(ipAddress) {
		if (firstIp) {
			ipAdrStg += ipAddress;
			firstIp = false;
		}
		else {
			ipAdrStg += "|" + ipAddress;
		};
	});
	if (!rpc) {
		this._app.log.info("ipAddressPresence main config window called");
		return cb(null, {        // main config window
			"contents":[
				{ "type": "paragraph", "text": "The ipAddressPresence driver checks ip addresses or device names for presence on your network. Be sure you get a confirmation when you hit Submit. You may need to hit it a couple of times..."},
				{ "type": "input_field_text", "field_name": "update_Interval", "value": self.opts.updateInterval / 1000, "label": "Interval in seconds to ping devices", "placeholder": self.opts.updateInterval / 1000, "required": true},
				{ "type": "input_field_text", "field_name": "ping_Timeout_Time", "value": self.opts.pingTimeoutTime, "label": "Time in seconds to wait for a ping response before timing out", "placeholder": self.opts.pingTimeoutTime, "required": true},
				{ "type": "input_field_text", "field_name": "ip_Addresses", "value": ipAdrStg, "label": "Ip addresses/device names to ping. Separate each with the pipe character (\"|\")", "placeholder": ipAdrStg, "required": true},
				{ "type": "paragraph", "text": " "},
				{ "type": "submit", "name": "Submit", "rpc_method": "submt" },
				{ "type": "close", "name": "Cancel" },
			]
		});
	}
	else if (rpc.method == "submt") {
		this._app.log.info("ipAddressPresence config window submitted. Checking for errors..");
		var intRegex = /^\d+$/; // corresponds to a positive integer
		if (!(intRegex.test(rpc.params.update_Interval))) {  // must be a positive integer
			cb(null, {
				"contents": [
					{ "type": "paragraph", "text": "The update interval must be a positive integer! Please try again." },
					{ "type": "close", "name": "Close" }
				]
			});                        
			return;
		}
		else if (!(intRegex.test(rpc.params.ping_Timeout_Time))) {  // must be a positive integer
			cb(null, {
				"contents": [
					{ "type": "paragraph", "text": "The ping timeout time must be a positive integer! Please try again." },
					{ "type": "close", "name": "Close" }
				]
			});                        
			return;
		}
		else {  // looks like the submitted values were valid, so update
			self.opts.updateInterval = rpc.params.update_Interval * 1000; // we asked for it in seconds, need it in milliseconds
			self.opts.pingTimeoutTime = rpc.params.ping_Timeout_Time;
			self.opts.ipAddresses = rpc.params.ip_Addresses.split("|");
			self.save();
			updateDevice(self.ipPrsDevice);
			clearInterval(self.intervalID);
			process.nextTick(function() { 
				self.intervalID = setInterval(function() {  
					updateDevice(self);
				}, self.opts.updateInterval);
			});
			cb(null, {
				"contents": [
					{ "type": "paragraph", "text": "Configuration was successful!" },
					{ "type": "close"    , "name": "Close" }
				]
			});
		};
	}
	else {
			this._app.log.info("ipAddressPresence - Unknown rpc method was called!");
	};
};
