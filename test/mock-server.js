/*!
 *  Copyright © 2011-2018 Peter Magnusson.
 *  All rights reserved.
 */
const dgram = require('dgram')
const xtend = require('xtend')
const ResponsePacket = require('../lib/responsepacket')
const RequestPacket = require('../lib/requestpacket')
const consts = require('../lib/consts')
const log = new (require('../lib/log'))('mcquery:test:mock-server')

var tokenCounter = 0

var Server = module.exports = function (options) {
  options = options || {}
  this.settings = {
    port: options.port || 25565,
    ip: process.env.ip || '127.0.0.1'
  }
  this.socket = null

  this.data = {
    hostname: 'A Minecraft Server',
    gametype: 'SMP',
    game_id: 'MINECRAFT',
    version: '1.8',
    plugins: '',
    map: 'world',
    numplayers: '1',
    maxplayers: '20',
    hostport: this.settings.port,
    hostip: this.settings.ip,
    player_: ['crippledcanary']
  }

  this.ignore = false
  this.badReply = false
  this.randomResponse = false
  this.delay = 30
  log.debug('MockServer created')
}

Server.prototype.setIgnore = function (value) {
  log.debug('setting ignore to', value)
  this.ignore = value
}

Server.prototype.bind = function (callback) {
  var self = this
  var socket = dgram.createSocket('udp4')
  this.socket = socket

  socket.on('error', function (err) {
    throw err
  })

  socket.on('message', function (msg, rinfo) {
    if (self.ignore) {
      log.debug('ignoring 1 message')
      self.setIgnore(false)
      return
    }

    var res, req
    log.debug('parsing message')
    try {
      req = RequestPacket.parse(msg)
    } catch (ex) {
      log.error(ex)
      throw ex
    }
    log.debug('mock request', req)
    res = new ResponsePacket()
    res.sessionId = req.sessionId
    res.type = req.type

    if (self.randomResponse) {
      self.randomResponse = false
      log.debug('single random response')
      res.sessionId = 12345
    }

    switch (req.type) {
      case consts.CHALLENGE_TYPE:
        res.challengeToken = 3076233 + tokenCounter++
        break
      case consts.REQUEST_BASIC:
        res.type = consts.STAT_TYPE
        res.MOTD = self.data.hostname
        res.gametype = self.data.gametype
        res.map = self.data.map
        res.numplayers = self.data.numplayers
        res.maxplayers = self.data.maxplayers
        res.hostport = self.data.hostport
        res.hostip = self.data.hostip
        break
      case consts.REQUEST_FULL:
        res.type = consts.STAT_TYPE
        res = xtend(res, self.data)
        break
      default:
        log.debug('request type %d is not implemented', req.type)
        throw new Error('request type not implemented')
    }

    var buf
    try {
      buf = ResponsePacket.write(res)
    } catch (ex) {
      log.error(ex)
      throw ex
    }
    if (self.badReply) {
      log.debug('single bad reply')
      self.badReply = false
      buf = Buffer.alloc(11)
    }
    setTimeout(function () {
      log.debug('mock response', res)
      socket.send(buf, 0, buf.length, rinfo.port, rinfo.address, (err, bytes) => {
        if (err) {
          throw err
        }
        log.debug('%d bytes sent', bytes)
      })
    }, self.delay)
  })

  return new Promise((resolve) => {
    socket.bind(this.settings.port, this.settings.ip)
    socket.on('listening', () => {
      log.debug('MockServer bound')
      return callback ? callback(null, socket) : resolve(this)
    })
    socket.on('close', () => {
      log.debug('MockServer closed socket')
    })
    socket.on('error', (err) => {
      log.debug('MockServer socket error', err)
    })
  })
}
