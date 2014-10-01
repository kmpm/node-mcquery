

var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var expect = Lab.expect;

var fs = require('fs');
var path = require('path');

var tools = require('./tools');
var Packet = require('../lib/packet');


var fixtureDir = path.join(__dirname, 'fixtures');


function createParsingTests(testFolder) {
  var files = fs.readdirSync(testFolder).filter(function (f) { return /\.bin$/.test(f); });
  files.forEach(function (file) {
    it('can parse ' + file, function (done) {
      var bin = tools.readBin(path.join(testFolder, file));
      var ret = Packet.parse(bin);

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
  describe('parsing', function () {

    createParsingTests(fixtureDir);

  });
});
