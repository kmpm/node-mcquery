var vows = require('vows'),
    assert = require('assert');

var Query = require('../mcquery');

var query = new Query();

var TEST_HOST='localhost';
var TEST_PORT=25565;

vows.describe('GS4 Query').addBatch({
  'startSession':{
    topic:function(){
      query.startSession(TEST_HOST, TEST_PORT, this.callback);
    },
    'does not return error':function(err, session){
      assert.isNull(err);
    },
    'returns a session object':function(err, session){
      assert.isObject(session);
    },
    'session object':{
      topic:function(session){
        return session;
      },
      'has sessionToken':function(session){
        assert.include(session, 'sessionToken');
        assert.isNumber(session.sessionToken);
        //have never seen a lower value tan 20000
        assert.isTrue(session.sessionToken>20000);
      },
      'has host':function(session){
        assert.include(session, 'host');
        assert.isString(session.host);
        assert.equal(session.host, TEST_HOST);
      },
      'has port':function(session){
        assert.include(session, 'port');
        assert.isNumber(session.port);
        assert.equal(session.port, TEST_PORT);
      },
      'has idToken':function(session){
        assert.include(session, 'idToken');
        assert.isNumber(session.idToken);
      }
    },//topic session object
    'basic_stat':{
      topic:function(session){
        query.basic_stat(session, this.callback);
      },
      'does not return error':function(err, stat){
        assert.isNull(err);
      },
      'returns a stat object':function(err, stat){
        assert.isObject(stat);
        assert.include(stat, 'hostname');
        assert.include(stat, 'gametype');
        assert.include(stat, 'map');
        assert.include(stat, 'numplayers');
        assert.isNumber(stat.numplayers);
        assert.include(stat, 'maxplayers');
        assert.isNumber(stat.maxplayers);
        assert.include(stat, 'hostport');
        assert.isNumber(stat.hostport);
        assert.include(stat, 'hostip');
        //console.log(stat);
      }
    },//topic basic_stat
    'full_stat':{
      topic:function(){
        var callback= this.callback;
        //start a new session, we are async!
        query.startSession(TEST_HOST, TEST_PORT, function(err, session){
          query.full_stat(session, callback);
        });
      },
      'does not return error':function(err, stat){
        assert.isNull(err);
      },
      'returns a full stat object':function(err, stat){
        assert.isObject(stat);
        var props = ['splitnum', 'extra1'
          , 'hostname', 'gametype'
          , 'game_id', 'version'
          , 'plugins', 'map'
          , 'numplayers', 'maxplayers'
          , 'hostport', 'hostip'
          , 'extra2', 'player_'];
        for(var i=0; i<props.length;i++){
          assert.include(stat, props[i]);
        }
        assert.isArray(stat.player_);
        
      }
    }//topic full_stat
  }//topic startSession

}).export(module);
