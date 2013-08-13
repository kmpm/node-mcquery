
/*global describe it before after */

var assert = require('assert')
  , should = require('should')
  , flow = require('nimble')
  , util = require('util');

var server_missing ={
    host: 'srv8.streamcraft.net',
    port: 33334
};

var server_existing = {
  host: 'mc.craftyn.com', //'srv1.streamcraft.net',
    port: 25565, //11111
}

var Query = require('../mcquery');

var global_query = new Query(server_existing.host, server_existing.port );
var global_session;

describe('mcquery', function() {
    
    after(function(done){
        global_query.close();    
        done();
    });

    it('should connect', function(done){
      global_query.connect(function(err, session){
        should.not.exist(err);
        should.exist(session);
        global_session=session;
        done();
      });
    });

    it('should have a proper session', function(){
        should.exist(global_session);
        global_session.should.be.instanceOf(Query);
        global_session.should.have.property('challengeToken');
        global_session.challengeToken.should.be.within(1, 0XFFFFFFFF);
    });

    it('should have a correct idToken', function(){
      should.exist(global_session);
      global_session.should.have.property('idToken');
      global_session.challengeToken.should.be.within(1, 0XFFFFFFFF);
      //test masking
      global_session.idToken.should.equal(global_session.idToken & 0x0F0F0F0F);
    });

    it('should be able to do an .doHandshake', function(done){
      var oldChallenge = global_session.challengeToken;
      global_query.doHandshake(function(err, session){
        should.not.exist(err);
        session.challengeToken.should.not.be.equal(oldChallenge);
        done();
      });

    });

    describe('.basic_stat(err, result)', function(){
        var result, err;
        before(function(done){
          should.exist(global_session);
          global_query.basic_stat(function(er, res){
            err = er;
            result = res;
            done();
          });
        });
        
        it('err should be null', function(){
          should.not.exist(err);
        });

        it('result should be correct', function(){
          should.exist(result);
          result.should.have.property('MOTD');
          result.should.have.property('gametype');
          result.should.have.property('map');
          result.should.have.property('numplayers');
          result.numplayers.should.be.within(0, 1024);
          result.should.have.property('maxplayers');
          result.maxplayers.should.be.within(0,1024);
          
          result.should.have.property('hostport');
          result.hostport.should.be.within(1, 65535);
          result.should.have.property('hostip');
        })
    });


    describe('.full_stat(err, result)', function(){
      var err, result;
      before(function(done){
        global_query.doHandshake(function(er, session){
          should.not.exist(er);
         
          global_query.full_stat(function(er, stat){
            err = er;
            result = stat;
            done();
          });
        });

        
      });

      it('err should be null', function(){
        should.not.exist(err);
      });

      it('result should be correct', function(){
        should.exist(result);
        var props = [
          'hostname', 
          'gametype',
          'numplayers', 
          'maxplayers',
          'hostport', 
          'hostip',
          'splitnum', 
          'key_val_start', //bonus
          'game_id', 
          'version',
          'plugins', 'map',
          'player_',
          'key_val_end', //bonus
          ];
        for(var i=0; i<props.length;i++){
          result.should.have.property(props[i]);
        }
        result.player_.should.be.instanceOf(Array);
        

      });
    });

    
});