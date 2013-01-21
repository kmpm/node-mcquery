/*!
 *  Copyright © 2011-2012 Peter Magnusson.
 *  All rights reserved.
 */
var vows = require('vows'),
    assert = require('assert'),
    fs = require('fs'),
    path = require('path');

var f = path.resolve('./config.json');

if(fs.existsSync(f)){
  var config = require(f);
}
else {
  config={host:'localhost', port:25565};
}
var Query = require('../mcquery');

var TEST_HOST=config.host;
var TEST_PORT=config.port;
var global_query = new Query(TEST_HOST, TEST_PORT);

vows.describe('GS4 Query').addBatch({
  'connect':{
    topic:function(){
      global_query.connect(this.callback);
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
      'has challengeToken':function(session){
        assert.include(session, 'challengeToken');
        assert.isNumber(session.challengeToken);
        //have never seen a lower value then 20000
        assert.isTrue(session.challengeToken>20000);
      },
      /*'has host':function(session){
        assert.include(session, 'host');
        assert.isString(session.host);
        assert.equal(session.host, TEST_HOST);
      },
      'has port':function(session){
        assert.include(session, 'port');
        assert.isNumber(session.port);
        assert.equal(session.port, TEST_PORT);
      },
      'has sessionToken':function(session){
        assert.include(session, 'sessionToken');
        assert.isNumber(session.sessionToken);
      }*/
    },//topic session object
    'basic_stat':{
      topic:function(session){
        //var query = new Query(TEST_HOST, TEST_PORT);
        global_query.basic_stat(this.callback);
      },
      'does not return error':function(err, stat){
        assert.isNull(err);
      },
      'returns a stat object':function(err, stat){
        assert.isObject(stat);
        assert.include(stat, 'MOTD');
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
        //var query=new Query(TEST_HOST, TEST_PORT);
        var callback= this.callback;
        //start a new session, we are async!
        //query.connect(function(err, session){
        global_query.full_stat(callback);
        //});
      },
      'does not return error':function(err, stat){
        assert.isNull(err);
      },
      'returns a full stat object':function(err, stat){
        assert.isObject(stat);
        var props = ['splitnum', 'key_val_start'
          , 'hostname', 'gametype'
          , 'game_id', 'version'
          , 'plugins', 'map'
          , 'numplayers', 'maxplayers'
          , 'hostport', 'hostip'
          , 'key_val_end', 'player_'];
        for(var i=0; i<props.length;i++){
          assert.include(stat, props[i]);
        }
        assert.isArray(stat.player_);
      }
    }//topic full_stat
  }//topic startSession

}).export(module);
