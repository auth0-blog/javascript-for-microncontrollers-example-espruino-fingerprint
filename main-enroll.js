import ZFM20 from './zfm20-simple.js';

const zfm20 = new ZFM20(Serial1, 3000, 0);

function getImageAndProcessIt(bufferId = 1) {
	return zfm20.getImage().then(result => {
		if(!result) {
			return false;
		}

		return zfm20.image2Tz(bufferId);
	});
}

// It is possible to store this count in the memory of the fingerprint
// scanner. For simplicity we chose to keep this here.
let fingerprintCount = 0;
function enrollFingerprint() {
	console.log(`Starting enrollment of new fingerprint ${fingerprintCount}`);

    // Workaround: Espruino Promises cause leaks when exceptions are thrown
    // inside 'then', so we use Promise.reject
	return getImageAndProcessIt(1).then(r => {
		if(!r) {
			return Promise.reject('Could not process first fingerprint');
		}

		return getImageAndProcessIt(2);
	}).then(r => {
		if(!r) {
			return Promise.reject('Could not process second fingerprint');
		}

		return zfm20.createModel();
	}).then(r => {
		if(!r) {
			return Promise.reject('Failed to create model for fingerprints');
		}

		return zfm20.storeModel(fingerprintCount);
	}).then(r => {
		if(!r) {
			return Promise.reject('Failed to store fingerprint');
		}

		return fingerprintCount++;
	});
}

function loop() {
	if(zfm20.isBusy()) {
		return;
	}

    //Enroll fingerprint
    enrollFingerprint().then(id => {
        console.log(`Fingerprint enrolled, id: ${id}`);
    }).catch(e => {
        console.log(`Failed to enroll fingerprint, error: ${e}`);
    });
}

zfm20.verifyPassword().then(result => {
	if(result) {
        zfm20.emptyLibrary().then(() => {
            setInterval(loop, 3000);
        });		
	} else {
		console.log('Incorrect password');
	}
}, error => {
	console.log(error);
});
