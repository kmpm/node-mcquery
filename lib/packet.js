
var BufferCursor = require('buffercursor');
var log = new (require('./log'))('mcquery:packet');
var consts = require('./consts');

var Packet = module.exports = function () {
  this.type = 0;
  this.idToken = 0;
};


/*
* Parse a response buffer and return an object
*/
Packet.parse = function parsePacket(data) {
  var bc = new BufferCursor(data);
  log.debug('parsing packet');
  var res = new Packet();

  res.type = bc.readUInt8(),
  res.idToken = bc.readUInt32BE(),

  log.debug('response=%j', res);

  bc = bc.slice();
  if (res.type === consts.CHALLENGE_TYPE) {
    log.debug('challenge packet');
    res.challengeToken = parseInt(bc.toString(), 10);
  }
  else if (res.type === consts.STAT_TYPE) {
    log.debug('stat packet');
    var r = readString(bc);
    log.debug('data=%j', r);
    if (r !== 'splitnum') {
      //basic stat
      res.MOTD = r;
      res.gametype = readString(bc);
      res.map = readString(bc);
      res.numplayers = parseInt(readString(bc), 10);
      res.maxplayers = parseInt(readString(bc), 10);
      res.hostport = bc.readUInt16LE();
      res.hostip = readString(bc);
    }
    else {

      //res.splitnum = r;
      //key value start byte
      bc.readUInt16LE();

      var key;
      var value;
      while (bc.buffer.readUInt16LE(bc.tell()) !== 256) {
        key = readString(bc);
        value = readString(bc);
        res[key] = value;
      }

      //key value end byte
      bc.readUInt16LE();

      key = readString(bc);
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
  return res;
};//end parsePacket


function readString(bc) {
  var start = bc.tell();
  var b = bc.readUInt8();
  while (b !== 0x0) {
    b = bc.readUInt8();
  }

  return bc.buffer.toString('utf-8', start, bc.tell() - 1);
}
