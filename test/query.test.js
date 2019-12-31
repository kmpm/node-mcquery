/*!
 *  Copyright © 2011-2020 Peter Magnusson.
 *  All rights reserved.
 */
const Lab = require('@hapi/lab')
const { describe, it, before, beforeEach, afterEach } = exports.lab = Lab.script()
const { expect } = require('code')
const log = new (require('../lib/log'))('mcquery:test:query')

var SERVER_EXISTING = {
  host: process.env.MC_SERVER || 'localhost', // '89.221.255.150'
  port: process.env.MC_PORT = 25565
}

var Query = require('../')

const MockServer = require('./mock-server')
var mockServer

function hasEnv (key) {
  return key in Object.keys(process.env)
}

function setupClient () {
  log.debug('setupClient')
  if (!hasEnv('MC_SERVER') && !mockServer) {
    mockServer = new MockServer()
    return mockServer.bind()
      .then(() => {
        var address = mockServer.socket.address()
        SERVER_EXISTING.host = address.address
        SERVER_EXISTING.port = address.port
        return Query.createConnected(SERVER_EXISTING.host, SERVER_EXISTING.port)
      })
  }
  return Query.createConnected(SERVER_EXISTING.host, SERVER_EXISTING.port)
}

describe('mcquery', function () {
  let query
  afterEach(() => {
    expect(query).to.be.instanceof(Query)
    query.close()
    if (mockServer) {
      mockServer.setIgnore(false)
    }
  })

  beforeEach({ timeout: 5000 }, async () => {
    query = await setupClient()
    expect(query).to.be.an.object()
  })

  it('should default to localhost:25565', () => {
    var q = new Query()
    expect(q.address()).to.include({ address: '127.0.0.1', port: 25565 })
  })

  it('should have a proper session', () => {
    expect(query).be.instanceOf(Query)
    expect(query).include(['challengeToken'])
    expect(query.challengeToken).be.within(1, 0XFFFFFFFF)
  })

  it('should have a correct sessionId', () => {
    expect(query).to.include(['sessionId', 'challengeToken'])
    expect(query.challengeToken).to.be.within(1, 0XFFFFFFFF)
    // test masking
    expect(query.sessionId).to
      .equal(query.sessionId & 0x0F0F0F0F)
  })

  it('should be able to do an .doHandshake', () => {
    var oldChallenge = query.challengeToken
    return new Promise(resolve => {
      query.doHandshake(function (err, session) {
        expect(err).not.exist()
        expect(session.challengeToken).not.be.equal(oldChallenge)
        resolve()
      })
    })
  })

  it('should be able to do an .doHandshake without callback', () => {
    var oldChallenge = query.challengeToken
    return new Promise(resolve => {
      query.doHandshake()
      setTimeout(function () {
        expect(query.challengeToken).not.be.equal(oldChallenge)
        resolve()
      }, 300)
    })
  })

  it('should be able to connect twice', () => {
    var oldChallenge = query.challengeToken
    expect(query.online).to.equal(true)
    return new Promise((resolve, reject) => {
      query.connect(function (err, session) {
        if (err) {
          return reject(err)
        }
        expect(session.challengeToken).not.be.equal(oldChallenge)
        return resolve(session)
      })
    })
  })

  it('should ignore bad response', { timeout: 4000, skip: hasEnv('MC_SERVER') }, () => {
    // var pre = query.dropped
    setupClient()
      .then(q => {
        mockServer.badReply = true
        return new Promise(resolve => {
          q.doHandshake((err) => {
            expect(err).to.exist()
            expect(err.message).to.equal('Request timeout')
            resolve()
            // expect(query.dropped, 'dropped packages').to.equal(pre + 1)
          })
        })
      })
  })

  it('should ignore response with session not in queue', { timeout: 5000, skip: true }, () => {
    var pre = query.dropped
    mockServer.randomResponse = true

    return new Promise(resolve => {
      query.doHandshake(function (err) {
        expect(err).to.exist()
        expect(err.message).to.equal('Request timeout')
        // console.log('asfdasdf %s "%s"', err, query.dropped)
        expect(query.dropped).to.equal(pre + 1)
        resolve()
      })
    })
  })

  it('send should require RequestPacket', () => {
    expect(fn).to.throw(TypeError, 'packet is wrong')
    query.send('asdf', function (err) {
      expect(err).to.be.instanceOf(TypeError)
    })
    function fn () {
      query.send('asdf')
    }
  })

  it('should timeout', { timeout: 5000 }, () => {
    if (!mockServer) {
      return
    }
    mockServer.setIgnore(true)
    return new Promise(resolve => {
      query.doHandshake(function (err) {
        expect(err).to.exist()
        return resolve()
      })
    })
  })

  it('should accept different timeout', { timeout: 1000 }, () => {
    if (!mockServer) {
      return Promise.resolve()
    }
    var q = new Query(SERVER_EXISTING.host, SERVER_EXISTING.port,
      { timeout: 500 }
    )
    mockServer.setIgnore(true)

    return new Promise(resolve => {
      q.connect(function (err) {
        expect(err).to.exist()
        expect(err.message).to.equal('Request timeout')
        q.close()
        resolve()
      })
    })
  })

  describe('.basic_stat(err, result)', () => {
    before({ timeout: 4000 }, () => {
      return new Promise((resolve, reject) => {
        query.connect(() => {
          expect(query.outstandingRequests, 'outstandingRequests')
            .to.equal(0)
          return resolve()
        })
      })
    })

    it('result should be correct', () => {
      return new Promise(resolve => {
        query.basic_stat(function (er, result) {
          expect(er).to.not.exist()
          expect(result).to.exist()
          expect(result).to.be.an.object()
          expect(result).to.include(['MOTD', 'gametype', 'map', 'numplayers',
            'maxplayers', 'hostport', 'hostip'])
          expect(result.numplayers).to.be.within(0, 1024)
          expect(result.maxplayers).to.be.within(0, 1024)
          expect(result.hostport).to.be.within(1, 65535)
          return resolve()
        })
      })
    })

    it('should require callback', () => {
      expect(fn).to.throw(Error, 'callback is not a function')
      function fn () {
        query.basic_stat()
      }
    })

    it('should require a challengeToken', () => {
      query.challengeToken = null
      query.full_stat(function (err) {
        expect(err).to.be.instanceOf(Error)
        expect(err.message).to.be.equal('bad session')
      })
    })
  })// end basic_stat

  describe('.full_stat(err, result)', function () {
    var result
    before(() => {
      log.debug('-------- full_stat ---------')
      return setupClient()
        .then((q) => {
          query = q
          return doHandshake()
        })

      function doHandshake () {
        return new Promise((resolve, reject) => {
          query.doHandshake(function (er) {
            expect(er).to.not.exist()
            query.full_stat(function (er, stat) {
              if (er) {
                return reject(er)
              }
              result = stat
              return resolve(stat)
            })
          })
        })
      }
    })

    it('result should be correct', () => {
      expect(result).to.exist()
      expect(result).to.be.an.object()
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
      ]
      for (var i = 0; i < props.length; i++) {
        expect(result).to.include(props[i])
      }
      expect(result.player_).to.be.instanceOf(Array)
    })

    it('should queue lots of requests', { timeout: 6000, skip: true }, () => {
      var i = 0
      var counter = 0
      var gotError = false
      if (mockServer) {
        mockServer.delay = 400
      }
      for (; i < 5; i++) {
        query.full_stat(fn)
      }

      function fn (err) {
        if (gotError) {
          return
        }
        if (err) {
          gotError = true
        }
        expect(err).not.exist()
        counter++
        checkDone()
      }

      function checkDone () {
        if (counter === i) {

        }
      }
    })

    it('should require callback', () => {
      expect(fn).to.throw(Error, 'callback is not a function')
      function fn () {
        query.full_stat()
      }
    })

    it('should require a challengeToken', () => {
      query.challengeToken = null
      query.full_stat(function (err) {
        expect(err).to.be.instanceOf(Error)
        expect(err.message).to.be.equal('bad session')
      })
    })
  })
})
