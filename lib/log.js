/*!
 *  Copyright © 2011-2018 Peter Magnusson.
 *  All rights reserved.
 */
var Debug = require('debug')

var LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG']

class Log {
  constructor (context) {
    this.context = context
    this._addLevels()
  }

  _addLevels () {
    LEVELS.forEach(l => {
      var debug = Debug(this.context + ':' + l)
      this[l.toLowerCase()] = makeLog(debug)
    })
  }

  addContext (addedContext) {
    return new Log(`${this.context}:${addedContext}`)
  }
}

module.exports = function (context) {
  return new Log(context)
}

function makeLog (debug) {
  return function () {
    debug.apply(debug, arguments)
  }
}
