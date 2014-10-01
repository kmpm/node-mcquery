/*!
 *  Copyright © 2011-2014 Peter Magnusson.
 *  All rights reserved.
 */
var Debug = require('debug');

var LEVELS = ['ERROR', 'WARN', 'INFO', 'DEBUG'];

module.exports = function (context) {
  var self = this;
  var level;
  for (level in LEVELS) {
    var l = LEVELS[level];
    var debug = Debug(context + ':' + l);
    self[l.toLowerCase()] = makeLog(debug);
  }
};


function makeLog(debug) {
  return function () {
    debug.apply(debug, arguments);
  };
}
