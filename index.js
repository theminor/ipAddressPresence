var util = require('util');
var stream = require('stream');
var exec = require('child_process').exec;

util.inherits(Driver,stream);
util.inherits(Device,stream);

function Driver(opts, app) {
	var self = this;
	this._app = app;
	this.opts = opts;
	app.on('client::up', function(){
		self.emit('register', new Device(app, opts));
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
	// *** tmp ***
	opts.ipAddresses = ["192.168.1.138", "192.168.1.205"]
	// ***********
	updateDevice(self);
	process.nextTick(function() {  // Update every "updateInterval" milliseconds
		setInterval(function() {
			updateDevice(self);
		}, opts.updateInterval || 60000);  // if opts.updateInterval is not set, update every 60 seconds
	});
};

function updateDevice(device) {
	var app = device._app;
	app.log.info("ipAddressPresence updating...");
	var pingTimeoutTime = device.opts.pingTimeoutTime || 5;
	var foundPings = {};
	device.opts.ipAddresses.forEach(function(ipAddress) {
		exec("ping -q -w " + pingTimeoutTime + " -c 1 " + ipAddress, function(error, stdout, stderr) {
			app.log.info("ipAddressPresence pinged " + ipAddress + " -- error: " + error + " -- stderr: " + stderr + " -- stdout: " + stdout);
			if (error || stderr) {
				foundPings[ipAddress] = undefined;
			}
			else {
				foundPings[ipAddress] = true;
			};
			var isEmpty = true;
			foundPings.forEach(function() {
				isEmpty = false;  // if there is at least one found device on the network, we'll report a "1" condition. Otherwise "0"
			});
			if (isEmpty) {
				device.emit('data', 0); // emit 0 if there are no found devices on the network
			}
			else {				
				device.emit('data', 1); // emit 1 if there is at least one found device on the network
			};
		});
	});
};

module.exports = Driver;
