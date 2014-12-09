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
  port = port || 25565;
  var socket = null;
  var requestQueue = [];
  var queueTimer = null;
  var self = this;
  self.challengeToken = null;
  self.online = false;
  self.currentRequest = null;

  self.incomming = 0;
  self.dropped = 0;
  self.sent = 0;
  function createSocket() {
    var s = dgram.createSocket('udp4');
    s.on('message', function (msg, rinfo) {
      log.debug('got a response message');

      var res;
      try {
        res = ResponsePacket.parse(msg);
        self.incomming++;
      }
      catch (ex) {
        self.dropped++;
        log.error(ex);
        return;
      }
      //res.rinfo = rinfo;
      res.from = {
        address: rinfo.address,
        port: rinfo.port
      };
      deQueue(res);
    });

    s.on('error', function (err) {
      log.error('socket error', err);
    });

    s.on('close', function () {
      log.debug('socket closed');
    });

    return s;
  }

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

    if (!self.online && socket === null) {
      socket = createSocket();
      //when socket is listening, do handshake.
      socket.on('listening', function () {
        process.nextTick(function () {
          self.doHandshake(callback);
          self.online = true;
        });
      });
      //bind the socket
      socket.bind();
    } else {
      //we are already listening
      //don't open a new socket.
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
    if (typeof(callback) !== 'function') {
      throw new TypeError('callback is not a function');
    }

    if (!self.challengeToken) {
      return callback(new Error('bad session'));
    }
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

    if (!self.challengeToken) {
      return callback(new Error('bad session'));
    }

    var p = new RequestPacket(consts.REQUEST_FULL, {
      challengeToken: self.challengeToken,
      sessionId: self.sessionId
    });

    self.send(p, function (err, res) {
      if (err) {
        return callback(err);
      } else {
        return callback(null, res);
      }
    });
  };//end full_stat


  this.queueLength = function () {
    return requestQueue.length;
  }


  /*
  * Stop listening for responses
  * Clears the requestQueue
  *
  * @api public
  */
  this.close = function () {
    log.info('closing query');
    socket.close();
    this.online = false;
    requestQueue = [];
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    socket = null;
  };//end close


  function processQueue() {
    //log.debug('processQueue()');
    if (queueTimer) {
      clearTimeout(queueTimer);
      queueTimer = null;
    }
    if (requestQueue.length > 0) {
      log.debug('queue length %d', requestQueue.length);
    }

    if (self.currentRequest === null && requestQueue.length > 0) {
      self.currentRequest = requestQueue.shift();
      log.debug('processing something on the queue',
        typeof self.currentRequest);
      transmit(self.currentRequest.packet, self.currentRequest.callback);
    } else {
      //log.debug('nothing to do');
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
    log.debug('adding type', type, 'to queue');
    var req = {type: type, callback: callback, packet: packet};

    //create the timeout for this request
    var t = setTimeout(function requestTimeout() {
      log.info('timeout on req', self.sessionId);
      var index = requestQueue.indexOf(req);
      log.debug('queue length=%d, index=%d', requestQueue.length, index);
      if (index >= 0) {
        requestQueue.splice(index, 1);
      }
      log.debug('length after %d', requestQueue.length);
      if (req === self.currentRequest) {
        self.currentRequest = null;
        log.debug('remove current request');
      }
      //self.sessionId = null;
      //self.challengeToken = null;
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
    log.debug('deQueue', res);
    var key = res.sessionId;
    if (self.currentRequest === null || self.sessionId !== key) {
      //no such session running... just ignore
      log.warn('no outstanding request. sessionId=%s, currentReqType=%s, res:',
        self.sessionId,
        typeof self.currentRequest,
        res
      );
      self.dropped++;
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
    processQueue();
  }

  function transmit(packet, callback) {
    if (typeof(packet) !== 'object') {
      var e = new TypeError('packet was wrong type');
      if (typeof callback === 'function') {
        return callback(e);
      }
      else {
        throw e;
      }
    }
    log.debug('transmitting packet', packet);
    process.nextTick(function () {
      socket.send(packet, 0, packet.length, port, host,
        function packetSent(err, sent) {
          if (err) {
            log.warn('there was an error sending', packet);
            return callback(err);
          }
          self.sent++;
          log.debug('%d bytes sent to %s:%s', sent, host, port);
          /* callback is called when responce is received */
        }
      );
    });
  }

  /**
  * Send a request and put it on the queue
  */
  this.send = function (packet, callback) {

    if (!(packet instanceof RequestPacket)) {
      var e = new TypeError('packet is wrong');
      if (typeof callback === 'function') {
        return callback(e);
      }
      else {
        throw e;
      }
    }

    var b = RequestPacket.write(packet);
    //var b = makePacket(type, self.challengeToken, self.sessionId, payloadBuffer);
    addQueue(packet.type, b, callback);
  };

  this.address = function () {
    return {
      address: host,
      port: port
    }
  }
};// end Query





