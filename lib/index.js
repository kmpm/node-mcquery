/*!
 *  Copyright © 2011-2014 Peter Magnusson.
 *  All rights reserved.
 */
var dgram = require('dgram');
var log = new (require('./log'))('mcquery');
var ResponsePacket = require('./responsepacket');
var RequestPacket = require('./requestpacket');


var REQUEST_TIMEOUT = 3000;
var QUEUE_DELAY = 100;

//internal
var consts = require('./consts');



/** Create a new instance of the client
  * @param {String} hostname or ip
  * @param {Number} port
  *
  * @api public
  */
module.exports =  function Query(host, port) {
  host = host || '127.0.0.1';
  port = port || (process.env.PORT || 25565);
  var socket = dgram.createSocket('udp4');
  var requestQueue = [];
  var queueTimer = null;
  var self = this;
  self.challengeToken = null;
  self.online = false;
  self.currentRequest = null;


  socket.on('message', function (msg, rinfo) {
    log.debug('got a response message');

    var res = ResponsePacket.parse(msg);
    //res.rinfo = rinfo;
    res.from = {
      address: rinfo.address,
      port: rinfo.port
    };
    deQueue(res);
  });
  socket.on('error', function (err) {
    log.error('socket error', err);
  });
  socket.on('close', function () {
    log.debug('socket closed');
  });
  socket.on('listening', function () {
    log.debug('socket is listening');
  });

  this.outstandingRequests = function () {
    return requestQueue.length;
  };

  /**
  * Start a new session with given host at port
  * @param {function} function (err, session)
  *
  * @api public
  */
  this.connect = function (callback) {
    log.debug('connect');
    if (!self.online) {
      socket.on('listening', function () {
        process.nextTick(function () {
          self.doHandshake(callback);
          self.online = true;
        });

      });
      socket.bind();
    } else {
      self.doHandshake(callback);
    }


  };//end startSession



  this.doHandshake = function (callback) {
    callback = callback || function () {};
    log.debug('doing handshake');
    self.sessionId = RequestPacket.generateToken();
    var p = new RequestPacket(consts.REQUEST_HANDSHAKE, {
      sessionId: self.sessionId
    });
    self.send(p, function gotChallengeResponse(err, res) {
      if (err) {
        log.error('error in doHandshake', err);
        return callback(err);
      }
      log.debug('challengeToken=', res.challengeToken || res);
      self.challengeToken = res.challengeToken;
      callback(null, self);
    });
  };

  /**
  * Request basic stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function (err, statinfo)
  *
  * @api public
  */
  this.basic_stat = function (callback) {
    self.send(new RequestPacket(consts.REQUEST_BASIC, {
      sessionId: self.sessionId,
      challengeToken: self.challengeToken
    }), callback);
  };//end basic_stat


  /**
  * Request full stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function (err, statinfo)
  *
  * @api public
  */
  this.full_stat = function (callback) {
    if (typeof(callback) !== 'function') {
      throw new TypeError('callback is not a function');
    }

    var p = new RequestPacket(consts.REQUEST_FULL, {
      challengeToken: self.challengeToken,
      sessionId: self.sessionId
    });

    self.send(p, function (err, res) {
      if (err) {
        return callback(err);
      } else {
        //delete res.type;
        //delete res.sessionId;
        //delete res.rinfo;
        return callback(null, res);
      }
    });
  };//end full_stat


  /*
  * Stop listening for responses
  * Clears the requestQueue
  *
  * @api public
  */
  this.close = function () {
    socket.close();
    this.online = false;
    requestQueue = [];
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
  };//end close


  function processQueue() {
    log.debug('processQueue()');
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    if (self.currentRequest === null && requestQueue.length > 0) {

      self.currentRequest = requestQueue.shift();
      log.debug('processing something on the queue',
        typeof self.currentRequest);
      transmit(self.currentRequest.packet, self.currentRequest.callback);
    } else {
      log.debug('nothing to do');
    }
    if (self.currentRequest && requestQueue.length > 0) {
      //if we have more requests comming up, delay next somewhat
      if (queueTimer === null) {
        queueTimer = setTimeout(processQueue, QUEUE_DELAY);
      }
    }
  }

  /**
  * Add a request to the queue
  */
  function addQueue(type, packet, callback) {
    log.debug('addQueue()');
    if (typeof(callback) !== 'function') {
      throw new Error('no callback');
    }
    log.debug('adding', type, 'to queue');
    var req = {type:type, callback:callback, packet:packet};

    //create the timeout for this request
    var t = setTimeout(function requestTimeout() {
      var index = requestQueue.indexOf(req);
      if (index >= 0) {
        requestQueue.splice(index, 1);
      }

      callback(new Error('Request timeout'));
    }, REQUEST_TIMEOUT);

    req.timeout = t;
    requestQueue.push(req);

    process.nextTick(processQueue);
  }


  /**
  * Check for requests matching the response given
  */
  function deQueue(res) {
    var key = res.sessionId;
    if (self.currentRequest === null || self.sessionId !== key) {
      //no such session running... just ignore
      log.warn('no outstanding request. sessionId=%s, currentReqType=%s, res:',
        self.sessionId,
        typeof self.currentRequest,
        res
      );
      return;
    }

    if (self.currentRequest.type !== res.type) {
      //no such type in queue... just ignore
      log.warn('response of wrong type', self.currentRequest, res);
      return;
    }
    clearTimeout(self.currentRequest.timeout);
    var fn = self.currentRequest.callback;
    self.currentRequest = null;
    if (typeof(fn) === 'function') {
      fn(null, res);
    }
    else {
      log.warn('no callback function');
    }
    processQueue();
  }

  function transmit(packet, callback) {
    if (typeof(packet) !== 'object') {
      throw new TypeError('packet was wrong type');
    }
    log.debug('transmitting packet', packet);
    socket.send(packet, 0, packet.length, port, host,
      function packetSent(err /*, sent*/) {
        if (err) {
          log.warn('there was an error sending', packet);
          return callback(err);
        }
        /* callback is called when responce is received */
      }
    );
  }

  /**
  * Send a request and put it on the queue
  */
  this.send = function (packet, callback) {
    if (!(packet instanceof RequestPacket)) {
      throw new TypeError('packet is wrong');
    }
    if (typeof(callback) !== 'function') {
      throw new TypeError('callback was not a function');
    }
    var b = RequestPacket.write(packet);
    //var b = makePacket(type, self.challengeToken, self.sessionId, payloadBuffer);
    addQueue(packet.type, b, callback);

  };
};// end Query





