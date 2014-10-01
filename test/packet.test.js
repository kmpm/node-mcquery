

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;

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
        expect(ret).to.eql(js);
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
        var p = ResponsePacket.parse(buf);  
      }
      expect(fn).to.throw('Unknown response type: 8');
      done();
    });

    createParsingTests(fixtureDir);

  });//--Response
  describe('Request', function () {
    
    it('a challenge token', function (done) {
      var p = new RequestPacket();
      expect(p).to.have.property('type', consts.CHALLENGE_TYPE);

      //1793 = first generated id
      expect(p).to.have.property('sessionId').to.be.equal(1793); 

      var buf = RequestPacket.write(p);
      expect(buf.toString('hex')).to.equal('fefd0900000701');

      var p2 = RequestPacket.parse(buf);
      expect(p2).to.eql(p);

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

    it('a basic stat', function (done) {
      var p = new RequestPacket(consts.REQUEST_BASIC, {
        sessionId: 1,
        challengeToken: 0x0091295B 
      });

      var expected = 'fefd00000000010091295b';
      var buf = RequestPacket.write(p);
      expect(buf.toString('hex')).to.equal(expected);
      done();
    })

  });//-Request
});
