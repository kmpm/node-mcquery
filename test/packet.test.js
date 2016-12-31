

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var Code = require('code');
var expect = Code.expect;

var fs = require('fs');
var path = require('path');

var tools = require('./tools');
var ResponsePacket = require('../lib/responsepacket');
var RequestPacket = require('../lib/requestpacket');

var consts = require('../lib/consts');

var fixtureDir = path.join(__dirname, 'fixtures');


function createParsingTests(testFolder) {
  var files = fs.readdirSync(testFolder).filter(function (f) { return /\.bin$/.test(f); });
  files.forEach(function (file) {
    it('can parse ' + file, function (done) {
      var bin = tools.readBin(path.join(testFolder, file));
      var ret = ResponsePacket.parse(bin);

      var jsFile = path.join(testFolder, file.replace(/\.bin$/, '.inspect'));
      var js;
      if (fs.existsSync(jsFile)) {
        js = tools.readJs(jsFile);
        expect(ret).to.deep.include(js);

        //roundtrip
        var bin2 = ResponsePacket.write(ret);
        //expect(bin2.length, 'binary length').to.equal(bin.length);
        expect(bin2.toString('hex')).to.equal(bin.toString('hex'));

      }
      else {
        tools.writeJs(jsFile, ret);
      }

      //tools.equalDeep(js, ret);
      //tools.equalJs(js, ret);
      done();
    });
  });
}




describe('packet', function () {
  describe('Response', function () {

    it('a package with bad type', function (done) {
      var buf = new Buffer('080000000127231f00', 'hex');
      function fn() {
        ResponsePacket.parse(buf);
      }
      expect(fn).to.throw('Unknown response type: 8');
      done();
    });

    it('a packet without players', function (done) {
      var buf = ResponsePacket.write({
        type: 0,
        sessionId: 1795,
        hostname: 'A Minecraft Server',
        gametype: 'SMP',
        game_id: 'MINECRAFT',
        version: '1.8',
        plugins: '',
        map: 'world',
        numplayers: '1',
        maxplayers: '20',
        hostport: '25565',
        hostip: '172.17.0.2',
        //player_: ['crippledcanary']
      });

      ResponsePacket.parse(buf);
      done();
    });

    it('should only support STAT_TYPE and CHALLENGE_TYPE', function (done) {
      expect(fn).to.throw(Error, 'packet type 2 not implemented');
      done();

      function fn() {
        ResponsePacket.write({
          type: consts.REQUEST_FULL,
          sessionId: 123
        });
      }
    });

    createParsingTests(fixtureDir);

  });//--Response
  describe('Request', function () {

    it('should generate valid sessinIds', function (done) {
      expect(RequestPacket.generateToken(1)).to.equal(1);
      expect(RequestPacket.generateToken()).to.equal(2);
      expect(RequestPacket.generateToken(16)).to.equal(0x100);
      expect(RequestPacket.generateToken(65535)).to.equal(0x0f0f0f0f);
      expect(RequestPacket.generateToken()).to.equal(1);
      done();
    });

    it('should create a challenge token', function (done) {
      var p = new RequestPacket();
      expect(p).to.include({
        type: consts.CHALLENGE_TYPE,
      });
      expect(p.sessionId).to.be.above(0);
      //left pad the id
      var id = p.sessionId.toString(16);
      id = ('00000000' + id).substr(-8, 8);

      var buf = RequestPacket.write(p);
      expect(buf.toString('hex')).to.equal('fefd09' + id);

      var p2 = RequestPacket.parse(buf);
      expect(p2).to.deep.equal(p);

      done();
    });


    it('a full stat', function (done) {
      var p = new RequestPacket(consts.REQUEST_FULL, {
        sessionId: 1,
        challengeToken: 0x0091295B
      });

      var expected = 'fefd00000000010091295b00000000';
      var buf = RequestPacket.write(p);
      expect(buf.toString('hex')).to.equal(expected);
      done();
    });


    it('a full stat with payload', function (done) {
      var p = new RequestPacket(consts.REQUEST_FULL, {
        payload: new Buffer([1, 2, 3, 4]),
        sessionId: 1,
        challengeToken: 0x0091295B
      });

      var expected = 'fefd00000000010091295b01020304';
      var buf = RequestPacket.write(p);
      expect(buf.toString('hex')).to.equal(expected);
      done();
    });


    it('a basic stat', function (done) {
      var p = new RequestPacket(consts.REQUEST_BASIC, {
        sessionId: 1,
        challengeToken: 0x0091295B
      });

      var expected = 'fefd00000000010091295b';
      var buf = RequestPacket.write(p);
      expect(buf.toString('hex')).to.equal(expected);
      done();
    });

    it('packet with bad type', function (done) {
      expect(fn).to.throw(Error);
      function fn() {
        var p = new RequestPacket(999);
        p.type;
      }
      done();
    });

    it('should not write bad type', function (done) {
      expect(fn).to.throw(Error, 'type did not have a correct value 999');

      function fn() {
        var p = new RequestPacket();
        p.type = 999;
        RequestPacket.write(p);
      }
      done();
    });


    it('should not write bad sessionId', function (done) {
      var p = new RequestPacket();
      p.sessionId = 0;
      expect(fn).to.throw(Error, 'sessionId is bad or missing');

      p.sessionId = 16;
      expect(fn).to.throw(Error, 'sessionId is bad or missing');

      p.sessionId = '100';
      expect(fn).to.throw(Error, 'sessionId is bad or missing');

      p.sessionId = 4147483647;
      expect(fn).to.throw(Error, 'sessionId is bad or missing');

      function fn() {
        RequestPacket.write(p);
      }
      done();
    });


    it('should not write bad payload', function (done) {
      var p = new RequestPacket();
      p.payload = 'asdf';
      expect(fn).to.throw(Error, 'payload was not a Buffer instance');

      function fn() {
        RequestPacket.write(p);
      }
      done();
    });


    it('should not write STAT without challengeToken', function (done) {
      var p = new RequestPacket(consts.REQUEST_BASIC);

      delete p.challengeToken;
      expect(fn).to.throw(Error, 'challengeToken is missing or wrong');

      p.challengeToken = -2147483648;
      expect(fn).to.throw(Error, 'challengeToken is missing or wrong');

      p.challengeToken = 4147483647;
      expect(fn).to.throw(Error, 'challengeToken is missing or wrong');

      function fn() {
        RequestPacket.write(p);
      }
      done();
    });


    it('not parse bad packet', function (done) {
      //bad magic
      var buf = new Buffer('000000', 'hex');
      expect(fn).to.throw(Error, 'Error in Magic Field');

      //bad length
      // buf = new Buffer('fefd0000000703002ef08a', 'hex');
      // expect(fn).to.throw(Error, 'payload not implemented');

      function fn() {
        RequestPacket.parse(buf);
      }
      done();
    });

    it('should not parse anything but STAT_TYPE', function (done) {
      var buf = new Buffer('fefd0900000703002ef08a', 'hex');
      expect(fn).to.throw(Error, 'payload not implemented');
      done();

      function fn() {
        RequestPacket.parse(buf);
      }
    });

    it('should parse basic_stat', function (done) {
      var buf = new Buffer('fefd0000000703002ef08a', 'hex');
      var p = RequestPacket.parse(buf);
      expect(p).to.include(['type', 'challengeToken']);
      expect(p.type, 'type is wrong').to.equal(consts.REQUEST_BASIC);
      done();
      // expect(fn).to.throw(Error, 'payload not implemented');
    });
  });//-Request
});
