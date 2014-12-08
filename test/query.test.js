
var Lab = require('lab');
var lab = exports.lab = Lab.script();

var describe = lab.describe;
var it = lab.it;
var before = lab.before;
var after = lab.after;
var Code = require('code');
var expect = Code.expect;



var SERVER_EXISTING = {
  host: process.env.MC_SERVER || 'localhost', //'89.221.255.150'
  port: process.env.MC_PORT = 25565,
};

var Query = require('../');

var globalQuery;
var globalSession;

var MockServer = require('./mock-server');
var mockServer;


describe('mcquery', function () {

  after(function (done) {
    globalQuery.close();
    done();
  });

  before(function (done) {
    if (process.env.MC_SERVER) {
      setupClient();
    }
    else {
      mockServer = new MockServer();
      mockServer.bind(function (err, socket) {
        var address = socket.address();
        SERVER_EXISTING.host =  address.address;
        SERVER_EXISTING.port = address.port;
        setupClient();
      });

    }

    function setupClient() {
      globalQuery = new Query(SERVER_EXISTING.host, SERVER_EXISTING.port);
      //this.timeout(10000);
      globalQuery.connect(function (err, session) {
        expect(err).to.not.exist;
        expect(session).to.exist;
        globalSession = session;
        done();
      });
    }

  });

  it('should have a proper session', function (done) {
    expect(globalSession).be.instanceOf(Query);
    expect(globalSession).include(['challengeToken']);
    expect(globalSession.challengeToken).be.within(1, 0XFFFFFFFF);
    done();
  });

  it('should have a correct sessionId', function (done) {
    expect(globalSession).to.include(['sessionId', 'challengeToken']);
    expect(globalSession.challengeToken).to.be.within(1, 0XFFFFFFFF);
    //test masking
    expect(globalSession.sessionId).to
    .equal(globalSession.sessionId & 0x0F0F0F0F);
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

  it('should be able to do an .doHandshake without callback', function (done) {
    var oldChallenge = globalSession.challengeToken;
    globalQuery.doHandshake();

    setTimeout(function () {
      expect(globalSession.challengeToken).not.be.equal(oldChallenge);
      done();
    }, 300);

  });


  it('should be able to connect twice', function (done) {
    var oldChallenge = globalSession.challengeToken;
    expect(globalQuery.online).to.equal(true);
    globalQuery.connect(function (err, session) {
      expect(err).not.exist;
      expect(session.challengeToken).not.be.equal(oldChallenge);
      done();
    });
  });


  it('should timeout', {timeout: 5000, only:true}, function (done) {
    if (!mockServer) {
      done();
    }
    mockServer.ignore = true;
    globalQuery.doHandshake(function (err) {
      expect(err).to.exist();
      done();
    });
  });

  describe('.basic_stat(err, result)', function () {
    var result, err;
    before({timeout:4000}, function (done) {
      globalQuery.connect(cnn);
      function cnn() {
        globalQuery.basic_stat(function (er, res) {
          err = er;
          result = res;
          done(err);
        });
        expect(globalQuery.outstandingRequests(), 'outstandingRequests')
        .to.equal(1);
      }

    });

    it('err should be null', function (done) {
      expect(err).not.exist;
      done();
    });

    it('result should be correct', function (done) {
      expect(result).exist;
      expect(result).to.include(['MOTD', 'gametype', 'map', 'numplayers',
        'maxplayers', 'hostport', 'hostip']);

      expect(result.numplayers).to.be.within(0, 1024);
      expect(result.maxplayers).to.be.within(0, 1024);
      expect(result.hostport).to.be.within(1, 65535);

      done();
    });

    it('should require callback', function (done) {
      expect(fn).to.throw(Error, 'no callback');
      function fn() {
        globalQuery.basic_stat();
      }
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
        expect(result).to.include(props[i]);
      }
      expect(result.player_).to.be.instanceOf(Array);
      done();

    });

    it('should require callback', function (done) {
      expect(fn).to.throw(Error, 'callback is not a function');
      function fn() {
        globalQuery.full_stat();
      }
      done();
    });
  });
});


