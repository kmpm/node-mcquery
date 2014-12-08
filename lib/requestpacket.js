/*!
 *  Copyright © 2011-2014 Peter Magnusson.
 *  All rights reserved.
 */
var BufferCursor = require('buffercursor');
var consts = require('./consts');
var log = new (require('./log'))('mcquery:lib:requestpacket');

var COUNTER_MIN = 10000;
var counter = COUNTER_MIN;
var MAX_INT = 2147483647;
var SESSION_BITMASK = 0x0F0F0F0F;

var RequestPacket = module.exports = function (requestType, options) {
  options = options || {};
  requestType = requestType || consts.REQUEST_HANDSHAKE;
  this.sessionId = options.sessionId || RequestPacket.generateToken();
  switch (requestType) {
    case consts.REQUEST_HANDSHAKE:
      this.type = consts.CHALLENGE_TYPE;
      break;
    case consts.REQUEST_FULL:
      this.payload = options.payload || new Buffer([0, 0, 0, 0]);
      this.type = consts.STAT_TYPE;
      this.challengeToken = options.challengeToken;
      break;
    case consts.REQUEST_BASIC:
      this.type = consts.STAT_TYPE;
      this.challengeToken = options.challengeToken;
      break;
    default:
      throw new Error('requestType "' + requestType + '" not implemented');
  }
};

/*
* Create a request packet
* @param {Number} request type
* @param {Object} session information
* @param {Buffer} optional payload
*/
RequestPacket.write = function (packet) {
  /*type, challengeToken, sessionId, payloadBuffer*/
  if (!(packet.type === consts.CHALLENGE_TYPE ||
    packet.type === consts.STAT_TYPE)) {
    throw new TypeError('type did not have a correct value ' +  packet.type);
  }
  if (typeof packet.sessionId !== 'number' ||
    packet.sessionId > MAX_INT ||
    packet.sessionId < 1 ||
    (packet.sessionId & SESSION_BITMASK) !== packet.sessionId) {
    throw new TypeError('sessionId is bad or missing');
  }

  if (typeof packet.payload !== 'undefined' &&
    !(packet.payload instanceof Buffer)) {
    throw new TypeError('payload was not a Buffer instance');
  }

  if (packet.type === consts.STAT_TYPE) {
    if (typeof packet.challengeToken !== 'number' ||
      packet.challengeToken <= 0 ||
      packet.challengeToken >= MAX_INT) {
      throw new TypeError('challengeToken is missing or wrong');
    }
  }

  var pLength = typeof(packet.payload) === 'undefined' ? 0 :
    packet.payload.length;

  var sLength = typeof(packet.challengeToken) !== 'number' ? 0 : 4;

  var bc = new BufferCursor(new Buffer(7 + sLength + pLength));

  try {
    bc.writeUInt8(0xFE);
    bc.writeUInt8(0xFD);
    bc.writeUInt8(packet.type);
    bc.writeUInt32BE(packet.sessionId);
    if (sLength > 0) {
      bc.writeUInt32BE(packet.challengeToken);
    }
    if (pLength > 0) {
      bc.copy(packet.payload);
    }
  }
  catch (err) {
    log.error('error writing request', packet);
    throw err;
  }
  return bc.buffer;
};


RequestPacket.parse = function (buf) {
  var packet = new RequestPacket();
  var bc = new BufferCursor(buf);
  var magic = bc.readUInt16BE();
  if (magic !== 0xFEFD) {
    throw new Error('Error in Magic Field');
  }

  packet.type = bc.readUInt8();
  packet.sessionId = bc.readUInt32BE();
  if (bc.length > bc.tell()) {
    //TODO:get some payload
    throw new Error('payload not implemented');
  }
  return packet;
};


/*
* Generate a idToken
*/
RequestPacket.generateToken = function () {
  counter += 1;
  //just not let it get to big. 32 bit int is max.
  if (counter >= MAX_INT) {
    counter = COUNTER_MIN;
  }

  //the protocol only uses the first 4 bits in every byte so mask.
  return (counter)  & SESSION_BITMASK;
};


