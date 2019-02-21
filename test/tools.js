/*!
 *  Copyright © 2011-2018 Peter Magnusson.
 *  All rights reserved.
 */
var debug = require('debug')('mcquery:test:tools')
var fs = require('fs')
var vm = require('vm')
var util = require('util')

exports.createJs = function (obj) {
  return util.inspect(obj, { depth: null })
}

exports.writeBin = function (filename, buf) {
  var ws = fs.createWriteStream(filename)
  ws.write(buf)
  ws.end()
}

exports.writeJs = function (filename, obj) {
  fs.writeFileSync(filename, exports.createJs(obj))
}

exports.readBin = function (filename) {
  return fs.readFileSync(filename)
}

exports.prepareJs = function (text) {
  // replace <Buffer aa bb> with Buffer.from("aabb", "hex")
  var matches = text.match(/(<Buffer[ a-f0-9]*>)/g)
  if (matches) {
    debug('matches', matches)
    matches.forEach(function (m) {
      var bytes = m.match(/ ([a-f0-9]{2})/g)
      var str = bytes.join('')
      str = str.replace(/ /g, '')
      var r = 'Buffer.from("' + str + '", "hex")'
      text = text.replace(m, r)
    })
  }
  return text
}

exports.readJs = function (filename) {
  var js = 'foo = ' + fs.readFileSync(filename, 'utf8')
  var sandbox = { foo: new Error('no object created') }
  js = exports.prepareJs(js)
  vm.runInNewContext(js, sandbox, filename)
  return sandbox.foo
}
