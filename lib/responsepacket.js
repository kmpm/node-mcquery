/*!
 *  Copyright © 2011-2014 Peter Magnusson.
 *  All rights reserved.
 */
var BufferCursor = require('buffercursor');
var log = new (require('./log'))('mcquery:lib:responsepacket');
var consts = require('./consts');

var KEYVAL_START = 128;
var KEYVAL_END = 256;

var MAX_PACKET_SIZE = 512; //maximum bytes for a packet.


var ResponsePacket = module.exports = function () {
  this.type = 0;
  this.sessionId = 0;
};

/*
* Parse a response buffer and return an object
*/
ResponsePacket.parse = function parsePacket(data) {
  var bc = new BufferCursor(data);
  log.debug('parsing packet');
  var res = new ResponsePacket();

  res.type = bc.readUInt8(),
  res.sessionId = bc.readUInt32BE(),

  log.debug('response=%j', res);

  bc = bc.slice();
  if (res.type === consts.CHALLENGE_TYPE) {
    log.debug('challenge packet');
    res.challengeToken = parseInt(bc.toString(), 10);
  }
  else if (res.type === consts.STAT_TYPE) {
    log.debug('stat packet');
    var r = readString(bc);
    log.debug('first string', r);
    if (r !== 'splitnum') {
      //it was basic stat response
      res.MOTD = r;
      res.gametype = readString(bc);
      res.map = readString(bc);
      res.numplayers = parseInt(readString(bc), 10);
      res.maxplayers = parseInt(readString(bc), 10);
      res.hostport = bc.readUInt16LE();
      res.hostip = readString(bc);
    }
    else {
      //it was full_stat response

      //key value start byte
      bc.readUInt16LE();
      var key;
      var value;
      while (bc.buffer.readUInt16LE(bc.tell()) !== KEYVAL_END) {
        key = readString(bc);
        value = readString(bc);
        log.debug('key=%s, value=%s', key, value);
        res[key] = value;
      }

      //key value end byte
      bc.readUInt16LE();

      if (!bc.eof()) {
        //we have players on the end
        key = readString(bc);
        if (key.length > 0) {
          var players = [];
          res[key] = players;

          //jump one extra dead byte
          bc.seek(bc.tell() + 1);

          r = readString(bc);
          log.debug('player %s =', players.length, r);
          while (r.length >= 1) {
            players.push(r);
            r = readString(bc);
          }
        }
      }
    }
  }
  else {
    throw new Error('Unknown response type: ' + res.type);
  }
  return res;
};//end parsePacket


ResponsePacket.write = function (packet) {
  log.debug('writing response');
  var bc = new BufferCursor(new Buffer(MAX_PACKET_SIZE));

  bc.writeUInt8(packet.type);
  bc.writeUInt32BE(packet.sessionId);
  switch (packet.type) {
    case consts.CHALLENGE_TYPE:
      var s = packet.challengeToken.toString();
      writeString(bc, s); //bc.write(s, s.length, 'utf-8');

      break;
    case consts.STAT_TYPE:
      if (packet.version) {
        //full stat
        writeString(bc, 'splitnum');
        bc.writeUInt16LE(KEYVAL_START);
        for (var key in packet) {
          if (packet.hasOwnProperty(key) &&
            ['type', 'sessionId', 'player_'].indexOf(key) === -1) {
            writeString(bc, key);
            writeString(bc, packet[key]);
          }
        }
        bc.writeUInt16LE(KEYVAL_END);

        if (packet.hasOwnProperty('player_')) {
          log.debug('players next');
          //players section
          writeString(bc, 'player_');
          bc.writeUInt8(0); //extra dead byte
          for (var i = 0; i < packet.player_.length; i++) {
            writeString(bc, packet.player_[i]);
            log.debug('writing', packet.player_[i]);
          }
        }
        writeString(bc, '');

      }
      else {
        //basic stat
        log.debug('writing basic stat');
        writeString(bc, packet.MOTD);
        writeString(bc, packet.gametype);
        writeString(bc, packet.map);
        writeString(bc, packet.numplayers);
        writeString(bc, packet.maxplayers);
        bc.writeUInt16LE(packet.hostport);
        writeString(bc, packet.hostip);

      }
      break;
    default:
      log.error('unsupported response', packet);
      throw new Error('packet type ' +
      packet.type.toString() + ' not implemented');
  }

  log.debug('writing done');
  return bc.buffer.slice(0, bc.tell());
};//end write



function readString(bc) {
  var start = bc.tell();
  var b = bc.readUInt8();
  while (b !== 0x0) {
    b = bc.readUInt8();
  }

  return bc.buffer.toString('utf-8', start, bc.tell() - 1);
}

function writeString(bc, value) {
  if (typeof value !== 'string') {
    value = value.toString();
  }
  bc.write(value, value.length, 'utf-8');
  bc.writeUInt8(0);
}
