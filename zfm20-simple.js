
const FRAME_START_CODE = 0xEF01;

const INSTRUCTION_GET_IMAGE = 0x01;
const INSTRUCTION_IMAGE2TZ = 0x02;
const INSTRUCTION_SEARCH = 0x04;
const INSTRUCTION_REG_MODEL = 0x05;
const INSTRUCTION_STORE_MODEL = 0x06;
const INSTRUCTION_EMPTY_LIBRARY = 0x0D;
const INSTRUCTION_VERIFY_PASSWORD = 0x13;
const INSTRUCTION_HIGH_SPEED_SEARCH = 0x1B;

const PACKAGE_ID_COMMAND = 0x1;
const PACKAGE_ID_ACK = 0x07;

const CONFIRMATION_CODE_OK = 0x0;

function ensureAvailability() {
    if(this.readHandler) {
        this.readHandler('');
        if(this.readHandler) {
            throw new Error('Read still in progress');
        }
    }
}

function read() {
    return new Promise((resolve_, reject_) => {
        ensureAvailability.call(this);
        
        const startedAt = Date.now();

        const result = {
            type: null,
            packet: null
        };

        const resolve = () => {
            this.readHandler = null;
            resolve_(result);
        };

        const reject = error => {
            this.readHandler = null;
            reject_(error);
        };

        const checkTimeout = () => {
            if((Date.now() - this.startedAt) >= this.timeoutMs) {
                reject(new Error('Read timeout'));
            }
        };

        // The size of the header is 9
        const headerLength = 9;
        let requiredLength = headerLength;
        let tailLength;
        let buffer = '';

        this.readHandler = data => {
            buffer += data;
        
            if(buffer.length < requiredLength) {
                checkTimeout();
                return;
            }

            if(requiredLength === 9) { // Process header
                if(buffer.charCodeAt(0) !== (FRAME_START_CODE >> 8) ||
                   buffer.charCodeAt(1) !== (FRAME_START_CODE & 0xFF)) {
                    reject(new Error('Bad frame start code'));
                    return;
                }

                result.type = buffer.charCodeAt(6);
                tailLength = (buffer.charCodeAt(7) << 8) | buffer.charCodeAt(8);
                requiredLength += tailLength;
            }
            
            if(buffer.length >= requiredLength) { // Process packet
                const packetLength = tailLength - 2;

                const receivedChecksum = 
                    (buffer.charCodeAt(buffer.length - 2) << 8) |
                    buffer.charCodeAt(buffer.length - 1);
                
                let computedChecksum = 
                    (tailLength >>> 8) + (tailLength & 0xFF) + result.type;

                result.packet = new Uint8Array(packetLength);
                for(let i = 0; i < result.packet.length; ++i) {
                    const val = buffer.charCodeAt(headerLength + i);
                    result.packet[i] = val;
                    computedChecksum += val;
                }

                if(computedChecksum === receivedChecksum) {
                    resolve();
                } else {
                    reject(new Error('Bad checksum'));
                }
            }
        };
    });
}

function send(packet) {
    return new Promise((resolve, reject) => {
        ensureAvailability.call(this);

        const address = 0xFFFFFFFF;
        const length = packet.length + 2;
        const type = PACKAGE_ID_COMMAND;

        const header = new Uint8Array([
            FRAME_START_CODE >>> 8,
            FRAME_START_CODE,
            address >>> 24,
            address >>> 16,
            address >>> 8,
            address,
            type,
            length >>> 8,
            length
        ]);

        let checksum = (length >>> 8) + (length & 0xFF) + type;
        packet.forEach(v => checksum += v);

        this.port.write(header);
        this.port.write(packet);
        this.port.write([checksum >>> 8, checksum]);

        read.call(this).then(reply => {
            if(reply.type !== PACKAGE_ID_ACK) {
                throw new Error('No ACK received');
            }
        
            // Payload of ACK packet
            resolve(reply.packet);
        }, reject);
    });
}

export default class ZFM20 {
    constructor(port, timeoutMs, password) {
        if(!port) {
            throw new TypeError('No valid port');
        }
        if(!timeoutMs) {
            timeoutMs = 1000;
        }
        if(typeof password === 'undefined' || password === null) {
            password = 0;
        }        

        this.port = port;
        this.timeoutMs = timeoutMs;
        this.password = password;
        this.readHandler = null;

        port.setup(57600);
        port.on('data', data => {
            if(this.readHandler) {
                this.readHandler(data);
            }
        });
    }

    isBusy() {
        return !!this.readHandler;
    }

    verifyPassword() {
        const packet = new Uint8Array([
            INSTRUCTION_VERIFY_PASSWORD,
            this.password >>> 24,
            this.password >>> 16,
            this.password >>> 8,
            this.password
        ]);

        return send.call(this, packet).then(reply => {
            return reply[0] === CONFIRMATION_CODE_OK;
        });
    }

    getImage() {
        const packet = new Uint8Array([
            INSTRUCTION_GET_IMAGE            
        ]);

        return send.call(this, packet).then(reply => {
            return reply[0] === CONFIRMATION_CODE_OK;
        });
    }

    image2Tz(bufferId = 1) {
        const packet = new Uint8Array([
            INSTRUCTION_IMAGE2TZ,
            bufferId            
        ]);

        return send.call(this, packet).then(reply => {
            return reply[0] === CONFIRMATION_CODE_OK;
        });
    }

    search(bufferId = 1, start = 0, count = 100) {
        const packet = new Uint8Array([
            INSTRUCTION_SEARCH,
            bufferId,
            start >>> 8,
            start,
            count >>> 8,
            count
        ]);

        return send.call(this, packet).then(reply => {
            if(reply[0] === CONFIRMATION_CODE_OK) {
                return {
                    found: true,
                    id: (reply[1] << 8) | reply[2],
                    score: (reply[3] << 8) | reply[4]
                };
            } else {
                return {
                    found: false
                };
            }            
        });
    }    

    emptyLibrary() {
        const packet = new Uint8Array([
            INSTRUCTION_EMPTY_LIBRARY
        ]);

        return send.call(this, packet).then(reply => {
            return reply[0] === CONFIRMATION_CODE_OK;
        });
    }    

    createModel() {
        const packet = new Uint8Array([
            INSTRUCTION_REG_MODEL
        ]);

        return send.call(this, packet).then(reply => {
            return reply[0] === CONFIRMATION_CODE_OK;
        });
    }

    storeModel(fingerprintId) {
        const packet = new Uint8Array([
            INSTRUCTION_STORE_MODEL,
            1,
            fingerprintId >>> 8,
            fingerprintId
        ]);

        return send.call(this, packet).then(reply => {
            return reply[0] === CONFIRMATION_CODE_OK;
        });
    }    
}
