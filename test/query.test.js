
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var expect = Lab.expect;



var SERVER_EXISTING = {
  host: process.env.MC_SERVER || 'localhost', //'89.221.255.150'
  port: process.env.MC_PORT = 25565,
};

var Query = require('../');

var globalQuery = new Query(SERVER_EXISTING.host, SERVER_EXISTING.port);
var globalSession;
if (process.env.MC_SERVER) {
  describe('mcquery', function () {

    after(function (done) {
      globalQuery.close();
      done();
    });

    before(function (done) {
      //this.timeout(10000);
      globalQuery.connect(function (err, session) {
        expect(err).to.not.exist;
        expect(session).to.exist;
        globalSession = session;
        done();
      });
    });

    it('should have a proper session', function (done) {
      expect(globalSession).be.instanceOf(Query);
      expect(globalSession).have.property('challengeToken');
      expect(globalSession.challengeToken).be.within(1, 0XFFFFFFFF);
      done();
    });

    it('should have a correct sessionId', function (done) {
      expect(globalSession).have.property('sessionId');
      expect(globalSession.challengeToken).to.be.within(1, 0XFFFFFFFF);
      //test masking
      expect(globalSession.sessionId).to.equal(globalSession.sessionId & 0x0F0F0F0F);
      done();
    });

    it('should be able to do an .doHandshake', function (done) {
      var oldChallenge = globalSession.challengeToken;
      globalQuery.doHandshake(function (err, session) {
        expect(err).not.exist;
        expect(session.challengeToken).not.be.equal(oldChallenge);
        done();
      });

    });

    describe('.basic_stat(err, result)', function () {
      var result, err;
      before(function (done) {
        globalQuery.basic_stat(function (er, res) {
          err = er;
          result = res;
          done();
        });
      });

      it('err should be null', function (done) {
        expect(err).not.exist;
        done();
      });

      it('result should be correct', function (done) {
        expect(result).exist;
        expect(result).have.property('MOTD');
        expect(result).have.property('gametype');
        expect(result).have.property('map');
        expect(result).have.property('numplayers');
        expect(result.numplayers).to.be.within(0, 1024);
        expect(result).have.property('maxplayers');
        expect(result.maxplayers).to.be.within(0, 1024);

        expect(result).have.property('hostport');
        expect(result.hostport).to.be.within(1, 65535);
        expect(result).have.property('hostip');
        done();
      });
    });


    describe('.full_stat(err, result)', function () {
      var err, result;
      before(function (done) {
        globalQuery.doHandshake(function (er) {
          expect(er).to.not.exist;
          globalQuery.full_stat(function (er, stat) {
            err = er;
            result = stat;
            done();
          });

        });

      });

      it('err should be null', function (done) {
        expect(err).not.exist;
        done();
      });

      it('result should be correct', function (done) {
        expect(result).to.exist;
        var props = [
          'hostname',
          'gametype',
          'numplayers',
          'maxplayers',
          'hostport',
          'hostip',
          'game_id',
          'version',
          'plugins',
          'map',
          'player_'
        ];
        for (var i = 0; i < props.length; i++) {
          expect(result).have.property(props[i]);
        }
        expect(result.player_).to.be.instanceOf(Array);
        done();

      });
    });
  });

}
