/*!
 *  Copyright © 2011-2020 Peter Magnusson.
 *  All rights reserved.
 */
/* eslint camelcase: "warn" */
const dgram = require('dgram')
const log = new (require('./log'))('mcquery')
const ResponsePacket = require('./responsepacket')
const RequestPacket = require('./requestpacket')

const consts = require('./consts')
const { QueryConnectionError } = require('./errors')

var REQUEST_TIMEOUT = 3000
var QUEUE_DELAY = 100
let INSTANCE_COUNTER = 0
const OPTIONAL_EVENTS = ['close', 'end', 'timeout', 'ready', 'connect']

// internal

class Query {
  /** Create a new instance of the client
  * @param {String} hostname or ip
  * @param {Number} port
  *
  * @api public
  */
  constructor (host, port, options) {
    this.name = `Query#${INSTANCE_COUNTER++}`
    this._host = host || '127.0.0.1'
    this._port = port || 25565
    this._clearSocket()
    this._requestQueue = []
    this._queueTimer = null

    this.challengeToken = null
    this.online = false
    this.currentRequest = null

    this.incomming = 0
    this.dropped = 0
    this.sent = 0
    options = options || {}
    options.timeout = options.timeout || REQUEST_TIMEOUT
    this.options = options
    if (INSTANCE_COUNTER > 65535) {
      log.debug('reset instance_counter')
      INSTANCE_COUNTER = 0
    }
    log.debug('%s created', this.name)
  }

  static createConnected (host, port, options) {
    let query = new Query(host, port, options)
    let r = query.connect()
    return r
  }

  get outstandingRequests () {
    return this._requestQueue.length
  }

  address () {
    return {
      address: this._host,
      port: this._port
    }
  }

  _clearSocket () {
    log.debug('%s _clearSocket', this.name)
    this._socket = null
  }

  _createSocket () {
    var s = dgram.createSocket('udp4')
    log.debug('%s _createSocket', this.name)

    s.on('message', this._onMessage.bind(this))

    s.on('error', (err) => {
      log.error('%s socket error', this.name, err)
    })

    OPTIONAL_EVENTS.forEach(element => {
      s.on(element, () => {
        log.debug('%s socket %s', this.name, element)
      })
    })

    return s
  }// end _createSocket

  _onMessage (msg, rinfo) {
    log.debug('%s got a response message', this.name)
    var res
    try {
      res = ResponsePacket.parse(msg)
      this.incomming++
    } catch (ex) {
      this.dropped = this.dropped + 1
      log.error(ex, this.dropped)
      return
    }
    // res.rinfo = rinfo
    res.from = {
      address: rinfo.address,
      port: rinfo.port
    }
    this._deQueue(res)
  }

  /**
   * Create request and put it on the queue to be sent
   * @param {*} packet
   * @param {*} callback
   */
  send (packet, callback) {
    if (!this.online) {
      throw new QueryConnectionError('Sending offline is not supported. Connect first.')
    }
    if (!(packet instanceof RequestPacket)) {
      var e = new TypeError('packet is wrong')
      if (typeof callback === 'function') {
        return callback(e)
      } else {
        throw e
      }
    }

    var b = RequestPacket.write(packet)
    // var b = makePacket(type, this.challengeToken, this.sessionId, payloadBuffer)
    this._addQueue(packet.type, b, callback)
  }

  /**
  * Start a new session with given host at port
  * @param {function} function (err, session)
  * @returns {Promise} - if not callback
  * @api public
  */
  connect (callback) {
    log.debug('%s connect', this.name)
    if (!this.online && this._socket === null) {
      return new Promise((resolve, reject) => {
        this._socket = this._createSocket()

        this._socket.on('listening', () => {
          // when socket is listening, do handshake.
          this.online = true
          this.doHandshake((err, result) => {
            if (err) {
              return callback ? callback(err) : reject(err)
            }
            return callback ? callback(result) : resolve(result)
          })
        })

        // bind the socket
        this._socket.bind()
      })
    } else {
      // we are already listening
      // don't open a new socket.
      return this.doHandshake(callback)
    }
  }// end connect

  /**
   * Runs the handshake procedure
   * @param {*} callback - (err, this)
   * @returns {Promise} - Promise with current instance
   */
  doHandshake (callback) {
    return new Promise((resolve, reject) => {
      log.debug('%s doing handshake', this.name)
      if (!this.online) {
        reject(new QueryConnectionError('doHandshake offline is not supported. Connect first.'))
      }
      this.sessionId = RequestPacket.generateToken()
      const p = new RequestPacket(consts.REQUEST_HANDSHAKE, {
        sessionId: this.sessionId
      })

      this.send(p, (err, res) => {
        if (err) {
          log.error('%s error in doHandshake', this.name, err)
          return callback ? callback(err, null) : reject(err)
        }
        log.debug('%s doHandshake > challengeToken=', this.name, res.challengeToken || res)
        this.challengeToken = res.challengeToken
        return callback ? callback(null, this) : resolve(this)
      })
    })
  };// end doHandshake

  /**
  * Request basic stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function (err, statinfo)
  *
  * @api public
  */
  basic_stat (callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('callback is not a function')
    }

    if (!this.challengeToken) {
      return callback(new Error('bad session'))
    }
    this.send(new RequestPacket(consts.REQUEST_BASIC, {
      sessionId: this.sessionId,
      challengeToken: this.challengeToken
    }), callback)
  };// end basic_stat

  /**
  * Request full stat information using session
  * @param {Object} a session object created by startSession
  * @param {funciton} function (err, statinfo)
  *
  * @api public
  */
  full_stat (callback) {
    if (typeof callback !== 'function') {
      throw new TypeError('callback is not a function')
    }

    if (!this.challengeToken) {
      return callback(new Error('bad session'))
    }

    var p = new RequestPacket(consts.REQUEST_FULL, {
      challengeToken: this.challengeToken,
      sessionId: this.sessionId
    })

    this.send(p, (err, res) => {
      if (err) {
        return callback(err)
      } else {
        return callback(null, res)
      }
    })
  };// end full_stat

  /*
  * Stop listening for responses
  * Clears the requestQueue
  *
  * @api public
  */
  close () {
    log.warn('%s closing query', this.name)
    this._socket.close()
    this.online = false
    this._requestQueue = []
    if (this._queueTimer) {
      clearTimeout(this._queueTimer)
      this._queueTimer = null
    }
    this._clearSocket()
  };// end close

  _transmit (packet, callback) {
    if (typeof packet !== 'object') {
      var e = new TypeError('packet was wrong type')
      if (typeof callback === 'function') {
        return callback(e)
      } else {
        throw e
      }
    }
    log.debug('%s _transmit(%o)', this.name, packet)
    process.nextTick(() => {
      if (!this._socket) {
        log.warn('%s no socket any more', this.name)
        return callback(new Error('Socket lost'))
      }
      log.debug('%s sending packet', this.name, packet)
      this._socket.send(packet, 0, packet.length, this._port, this._host, (err, sent) => {
        if (err) {
          log.warn('%s there was an error sending', this.name, packet)
          return callback(err)
        }
        this.sent++
        log.debug('%s %d bytes sent to %s:%s', this.name, sent, this._host, this._port)
        /* callback is called when responce is received */
      })
    })
  }// end _transmit

  _processQueue () {
    log.debug('%s _processQueue()', this.name)
    if (this._queueTimer) {
      log.debug('%s _processQueue > clearing timer', this.name)
      clearTimeout(this._queueTimer)
      this._queueTimer = null
    }
    const queueLength = this.outstandingRequests
    if (queueLength > 0) {
      log.debug('%s _processQueue > queue length %d', this.name, queueLength)
    }

    if (this.currentRequest === null && queueLength > 0) {
      this.currentRequest = this._requestQueue.shift()
      log.debug('%s _processQueue > processing something on the queue',
        this.name,
        typeof this.currentRequest)
      this._transmit(this.currentRequest.packet, this.currentRequest.callback)
    } else {
      log.debug('%s _processQueue > nothing to do', this.name)
    }
    if (this.currentRequest && queueLength > 0) {
      // if we have more requests comming up, delay next somewhat
      if (this._queueTimer === null) {
        this._queueTimer = setTimeout(this._processQueue.bind(this), QUEUE_DELAY)
      }
    }
  }// end _processQueue

  /**
  * Add a request to the queue
  */
  _addQueue (type, packet, callback) {
    log.debug('%s _addQueue()', this.name)
    if (typeof callback !== 'function') {
      throw new Error('no callback')
    }

    var req = { type: type, callback: callback, packet: packet }
    log.debug('%s _addQueue > creating timeout', this.name)
    // create the timeout for this request
    var t = setTimeout(() => {
      log.info('%s _addQueue > timeout on req', this.name, this.sessionId)
      var index = this._requestQueue.indexOf(req)
      log.debug('%s _addQueue > queue length=%d, index=%d', this.name, this._requestQueue.length, index)
      if (index >= 0) {
        this._requestQueue.splice(index, 1)
      }
      log.debug('%s _addQueue > length after %d', this.name, this._requestQueue.length)
      if (req === this.currentRequest) {
        this.currentRequest = null
        log.debug('%s _addQueue > remove current request', this.name)
      }
      // this.sessionId = null
      // this.challengeToken = null
      callback(new Error('Request timeout'))
    }, this.options.timeout)

    req.timeout = t
    log.debug('%s _addQueue > adding type', this.name, type, 'to queue')
    this._requestQueue.push(req)
    log.debug('%s _addQueue > outstatndingRequest=', this.name, this.outstandingRequests)
    process.nextTick(this._processQueue.bind(this))
  }// end _addQueue

  /**
  * Check for requests matching the response given
  */
  _deQueue (res) {
    log.debug('%s deQueue', this.name, res)
    var key = res.sessionId
    if (this.currentRequest === null || this.sessionId !== key) {
      // no such session running... just ignore
      log.warn('%s no outstanding request. sessionId=%s, currentReqType=%s, res:',
        this.name,
        this.sessionId,
        typeof this.currentRequest,
        res
      )
      this.dropped++
      log.warn('%s, _deQueue > dropped = %s', this.name, this.dropped)

      return
    }

    if (this.currentRequest.type !== res.type) {
      // no such type in queue... just ignore
      log.warn('%s response of wrong type', this.name, this.currentRequest, res)
      return
    }
    clearTimeout(this.currentRequest.timeout)
    var fn = this.currentRequest.callback
    this.currentRequest = null
    if (typeof fn === 'function') {
      fn(null, res)
    }
    this._processQueue()
  }// end _deQueue
}// end class Query

module.exports = Query
