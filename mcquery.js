/*!
 *  Copyright © 2011 Peter Magnusson.
 *  All rights reserved.
 */
var dgram = require('dgram');

var CHALLENGE_TYPE=0x09;
var STAT_TYPE=0x00;

var counter =0;

var Query = module.exports =  function Query(){
  var socket = dgram.createSocket('udp4');
  var m = this;
  m.online=false;

  this.requestQueue={};

  socket.on('message', function(msg, rinfo){
    var res = readPacket(msg);
    res.rinfo = rinfo;
    deQueue(res);
  });

  /**
  * Start a new session with given host at port
  * @param {String} hostname or ip
  * @param {Number} port
  * @param {function} function(err, session)
  *
  * @api public
  */
  this.startSession = function(host, port, callback){
    var session = {host:host, port:port};
    if (! m.online){
      socket.on('listening', function(){
        doHandshake();
        m.online=true; 
      });
      socket.bind();
    }
    else{
      doHandshake();
    }
    
    function doHandshake(){
      
      var token = generateToken();
      session.idToken=token;
      m.send(session, CHALLENGE_TYPE, function(err, res){
        if(err){callback(err); return;}
        session.sessionToken = res.sessionToken;
        callback(null, session);
      }); 
    }
  };//end startSession


  /**
  * Request basic stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function(err, statinfo)
  *
  * @api public
  */
  this.basic_stat = function(session, callback){
    this.send(session, STAT_TYPE, callback);
  };//end basic_stat
  

  /**
  * Request full stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function(err, statinfo)
  *
  * @api public
  */
  this.full_stat = function(session, callback){
    var b = new Buffer(4);
    b.fill(0);
    this.send(session, STAT_TYPE, b, function(err, res){
      if(err)callback(err);
      else{
        delete res.type;
        delete res.idToken;
        delete res.rinfo;
        callback(null, res);
      }
    });
  };//end full_stat


  /*
  * Stop listening for responses
  * Clears the requestQueue
  *
  * @api public
  */
  this.close = function(){
    socket.close();
    m.online=false;
    m.requestQueue={};
  };//end close

  /**
  * Add a request to the queue
  */
  function addQueue(session, type, callback){
    var q;
    if(typeof(m.requestQueue[session.idToken])==='undefined'){
      q = {};
      m.requestQueue[session.idToken]=q;
    }
    else{
      q = m.requestQueue[session.idToken];
    }
    var t = setTimeout(function(){
      delete q[type];
      if(q.length===0){
        delete m.requestQueue[session.idToken];
      }
      callback({error:'timeout'});
    }, 1000);
    //TODO:err and delete any outstanding ones...
    q[type]={callback:callback, timeout:t};
  }


  /**
  * Check for requests matching the response given
  */
  function deQueue(res){
    var key = res.idToken;
    if(typeof(m.requestQueue[key])==='undefined'){
      //no such session running... just ignore
      return;
    };
    var qt = m.requestQueue[key][res.type];
    if(typeof(qt)==='undefined'){
      //no such type in queue... just ignore
      return;
    }
    clearTimeout(qt.timeout);
    var fn = qt.callback;
    delete m.requestQueue[key][res.type];
    if(m.requestQueue[key].length===0){
      delete m.requestQueue[key];
    }
    fn(null, res);
  }

  /*
  * Send a request and put it on the queue
  */
  this.send = function(session, type, payloadBuffer, callback){
    if(arguments.length===3){
      callback = arguments[2];
      payloadBuffer=undefined;
    }
    var b = makePacket(type, session, payloadBuffer);
    socket.send(b, 0, b.length, session.port, session.host, function(err, sent){
      if(err){
        callback(err);
      }else{
        addQueue(session, type, callback);
      }
    });
  };
};// end Query

/*
* Generate a idToken
*/
function generateToken(){
  counter +=1;
  return 10000 + counter;
}


/*
* Create a request packet
* @param {Number} request type
* @param {Object} session information
* @param {Buffer} optional payload
*/
function makePacket(type,session, payloadBuffer){
  var pLength = typeof(payloadBuffer)==='undefined'? 0 : payloadBuffer.length;
  var sLength = typeof(session.sessionToken)==='undefined'? 0: 4;
  var b = new Buffer(7 + sLength+pLength);
  b.writeUInt8(0xFE, 0);
  b.writeUInt8(0xFD, 1);
  b.writeUInt8(type, 2);
  b.writeUInt32BE(session.idToken, 3);
  if(sLength>0){
    b.writeUInt32BE(session.sessionToken, 7);
  }
  if(pLength>0){
    payloadBuffer.copy(b, 7+sLength +1);
  }
  return b;
}


/*
* Parse a response buffer and return an object
*/
function readPacket(data){
  var res = {
    type:data.readUInt8(0),
    idToken:data.readUInt32BE(1),
  };
  data = data.slice(5);
  if(res.type===CHALLENGE_TYPE){
    res.sessionToken=parseInt(data.toString());
  }
  else if(res.type===STAT_TYPE){
    var r = readString(data);
    if(r.text !== 'splitnum'){
      //basic stat
      res.hostname = r.text;
      r = readString(data, r.offset);
      res.gametype = r.text;
      
      r = readString(data, r.offset);
      res.map = r.text;
      
      r = readString(data, r.offset);
      res.numplayers = parseInt(r.text);
      
      r = readString(data, r.offset);
      res.maxplayers = parseInt(r.text);

      res.hostport = data.readUInt16LE(r.offset);
      r = readString(data, r.offset +2);
      res.hostip = r.text;
    }
    else {
      var offset=r.offset;
      res.splitnum = r.text;
      res.key_val_start = data.readUInt16LE(offset);offset+=2;
      var key;
      var value;
      while(data.readUInt16LE(offset) !== 256){
        r = readString(data, offset); offset=r.offset;
        key = r.text;
        r = readString(data, offset); offset=r.offset;
        value = r.text;
        res[key]=value;
      }
      res.key_val_end = data.readUInt16LE(offset);offset+=2;
      
      r = readString(data, offset); offset=r.offset;
      key = r.text;
      var players = [];
      res[key]=players;
      offset+=1;
      r=readString(data, offset); offset=r.offset;
      while(r.text.length>=1){
        players.push(r.text);
        r=readString(data, offset); offset=r.offset;
      }
    }
  }
  return res;
}//end readPacket


function readString(data, offset){
  var o = typeof(offset)==='undefined'? 0: offset;
  var start=o+0;
  while(data.readUInt8(o)!==0x0){
    o+=1;
  }
  return {text:data.toString('utf-8', start, o), offset:o+1};
}