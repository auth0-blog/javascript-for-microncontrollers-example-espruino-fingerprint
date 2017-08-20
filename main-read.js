import ZFM20 from './zfm20-simple.js';

const zfm20 = new ZFM20(Serial1, 3000, 0);

function getImageAndProcessIt(bufferId = 1) {
	return zfm20.getImage().then(result => {
		if(!result) {
			return Promise.reject('Could not get image');
		}

		return zfm20.image2Tz(bufferId);
	});
}

function findFingerprint() {
	return getImageAndProcessIt().then(result => {
		if(!result) {
			return Promise.reject("Couldn't read/process fingerprint");
		}

		return zfm20.search();
	});	
}

function openLock() {
	console.log('Opening lock');
	digitalWrite(NodeMCU.D4, false);
}

function closeLock() {
	console.log('Closing lock');
	digitalWrite(NodeMCU.D4, true);
}

function timedOpenLock() {
	openLock();
	setTimeout(closeLock, 3000);
}

function loop() {
	if(zfm20.isBusy()) {
		return;
	}

	// Normal operation, check fingerprint against database
	findFingerprint().then(r => {
		if(r.found) {
			console.log(`Finger found (id: ${r.id}, ` + 
						`score: ${r.score})`);
			timedOpenLock();
		} else {
			console.log('Finger not found');
		}
	}, e => {
		console.log('Error while searching for fingerprint: ' + e);
	});
}

// Start checking for fingerprints
zfm20.verifyPassword().then(result => {
	if(result) {
		setInterval(loop, 3000);
	} else {
		console.log('Incorrect password');
	}
}, error => {
	console.log(error);
});

// Listen for data from sensors
const server = require("net").createServer(conn => {
	conn.on('data', data => {
		try {
			const sensors = JSON.parse(data);
			console.log(sensors);

			if(sensors.flame || sensors.gas > 1000) {
				console.log('Flame or gas detected, opening lock');
				openLock();
			}
		} catch(e) {
			console.log(`Error parsing sensor data: ${e}`);
		}
	});
});
server.listen(3000);
