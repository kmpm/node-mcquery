/*!
 *  Copyright © 2011-2013 Peter Magnusson.
 *  All rights reserved.
 */
var dgram = require('dgram')
  , log = require('./lib/log');

var REQUEST_TIMEOUT=3000;
var QUEUE_DELAY=100;

//internal
var CHALLENGE_TYPE=0x09;
var STAT_TYPE=0x00;
var counter =0;

/** Create a new instance of the client
  * @param {String} hostname or ip
  * @param {Number} port
  *
  * @api public
  */
var Query = module.exports =  function Query(host, port){
  host = host || '127.0.0.1';
  port = port || (process.env.PORT || 25565); 
  var socket = dgram.createSocket('udp4');
  var requestQueue=[];
  var self = this;
  self.challengeToken=null;
  self.online=false;
  self.currentRequest=null;


  socket.on('message', function(msg, rinfo){
    log.debug('got a response message');
    var res = readPacket(msg);
    res.rinfo = rinfo;
    deQueue(res);
  });
  socket.on('error', function(err){
    log.error('socket error', err);
  });
  socket.on('close', function(){
    log.debug('socket closed');
  });
  socket.on('listening', function(){
    log.debug('socket is listening');
  });

  /**
  * Start a new session with given host at port
  * @param {function} function(err, session)
  *
  * @api public
  */
  this.connect = function(callback){
    if (! self.online){
      socket.on('listening', function(){
        process.nextTick(function(){
          self.doHandshake(callback);
          self.online=true; 
        });
        
      });
      socket.bind();
    }
    else {
      self.doHandshake(callback);
    }
    
    
  };//end startSession



  this.doHandshake = function (callback){
    callback = callback || function(){};
    log.debug("doing handshake");
    self.idToken = generateToken();
    self.send(CHALLENGE_TYPE, function(err, res){
      if(err){callback(err); return;}
      log.debug("challengeToken=", res.challengeToken);
      self.challengeToken = res.challengeToken;
      callback(null, self);
    }); 
  };

  /**
  * Request basic stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function(err, statinfo)
  *
  * @api public
  */
  this.basic_stat = function(callback){
    self.send(STAT_TYPE, callback);
  };//end basic_stat
  

  /**
  * Request full stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function(err, statinfo)
  *
  * @api public
  */
  this.full_stat = function(callback){
    if(typeof(callback) !== 'function'){
      throw new TypeError('callback is not a function');
    }
    var b = new Buffer(4);
    b.fill(0);
    self.send(STAT_TYPE, b, function(err, res){
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
    this.online=false;
    requestQueue=[];
  };//end close


  function processQueue(){
    if(self.currentRequest === null && requestQueue.length >0){
      log.debug("processing queue");
      self.currentRequest = requestQueue.shift();
      transmit(self.currentRequest.packet, self.currentRequest.callback);
    }else{
      log.debug("nothing to do");
    }
    if(self.currentRequest && requestQueue.length >0){
      //if we have more requests comming up, delay next somewhat
      setTimeout(processQueue, QUEUE_DELAY);
    }
  }

  /**
  * Add a request to the queue
  */
  function addQueue(type, packet, callback){
    if(typeof(callback) !== 'function'){
      throw new Error('no callback');  
    }
    log.debug('adding', type, 'to queue');
    var req={type:type, callback:callback, packet:packet};

    //create the timeout for this request
    var t = setTimeout(function(){
      var index = requestQueue.indexOf(req);
      if(index>=0) {
        requestQueue.splice(index, 1);
      }
      
      callback({error:'timeout'});
    }, REQUEST_TIMEOUT);
    req.timeout = t;
    requestQueue.push(req);
    
    process.nextTick(processQueue);
  }


  /**
  * Check for requests matching the response given
  */
  function deQueue(res){
    var key = res.idToken;
    if(self.currentRequest === null || self.idToken !== key){
      //no such session running... just ignore
      log.warn('no outstanding request', res);
      return;
    }

    if(self.currentRequest.type !== res.type){
      //no such type in queue... just ignore
      log.warn('response of wrong type', self.currentRequest, res);
      return;
    }
    clearTimeout(self.currentRequest.timeout);
    var fn = self.currentRequest.callback;
    self.currentRequest=null;
    if(typeof(fn) === 'function'){
       fn(null, res);
    }
    else {
      log.warn('no callback function');
    }
    processQueue();
  }

  function transmit(packet, callback){
    if(typeof(packet) !== 'object') throw new TypeError("packet was wrong type");
    log.debug("transmitting packet", packet);
    socket.send(packet, 0, packet.length, port, host, function(err, sent){
      if(err){
        log.warn("there was an error sending", packet);
        callback(err);
      }
    });
  }
  
  /**
  * Send a request and put it on the queue
  */
  this.send = function(type, payloadBuffer, callback){
    if(arguments.length === 2){
      callback = arguments[1];
      payloadBuffer = undefined;
    }

    if(!(type === CHALLENGE_TYPE || type === STAT_TYPE)){
      throw new TypeError('type did not have a correct value ' +  type);
    }
    if(typeof(callback) !== 'function'){
      throw new TypeError('callback was not a function');
    }
    var b = makePacket(type, self.challengeToken, self.idToken, payloadBuffer);
    addQueue(type, b, callback);

  };
};// end Query

/*
* Generate a idToken
*/
function generateToken(){
  counter +=1;
  //just not let it get to big. 32 bit int is max.
  if(counter>999999) counter = 0; 
  //the protocol only uses the first 4 bits in every byte so mask.
  return (10000 + counter)  & 0x0F0F0F0F;
}


/*
* Create a request packet
* @param {Number} request type
* @param {Object} session information
* @param {Buffer} optional payload
*/
function makePacket(type, challengeToken, idToken, payloadBuffer){
  var pLength = typeof(payloadBuffer)==='undefined'? 0 : payloadBuffer.length;
  var sLength = typeof(challengeToken) !== 'number' ? 0: 4;
  var b = new Buffer(7 + sLength+pLength);
  try {
    b.writeUInt8(0xFE, 0);
    b.writeUInt8(0xFD, 1);
    b.writeUInt8(type, 2);
    b.writeUInt32BE(idToken, 3);
    if(sLength>0){
      b.writeUInt32BE(challengeToken, 7);
    }
    if(pLength>0){
      payloadBuffer.copy(b, 7+sLength +1);
    }
  }
  catch(err){
    log.error("type=%s, challengeToken=%s, idToken=%s", type, challengeToken, idToken);
    throw err;
  }
  return b;
}


/*
* Parse a response buffer and return an object
*/
function readPacket(data){
  log.debug('parsing packet');
  var res = {
    type:data.readUInt8(0),
    idToken:data.readUInt32BE(1),
  };
  log.debug("response=%j", res);

  data = data.slice(5);
  if(res.type===CHALLENGE_TYPE){
    res.challengeToken=parseInt(data.toString(), 10);
  }
  else if(res.type===STAT_TYPE){
    var r = readString(data);
    log.debug("data=%j", r);
    if(r.text !== 'splitnum'){
      //basic stat
      res.MOTD = r.text;
      r = readString(data, r.offset);
      res.gametype = r.text;
      
      r = readString(data, r.offset);
      res.map = r.text;
      
      r = readString(data, r.offset);
      res.numplayers = parseInt(r.text, 10);
      
      r = readString(data, r.offset);
      res.maxplayers = parseInt(r.text, 10);

      res.hostport = data.readUInt16LE(r.offset);
      r = readString(data, r.offset +2);
      res.hostip = r.text;
    }
    else {
      var offset=r.offset;
      res.splitnum = r.text;
      //add key_val_start to response. It's the start byte of the response
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

      //add key_val_ed to response. It's the end byte of the response
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
