var util = require('util');

var LEVELS=['ERROR', 'WARN', 'INFO', 'DEBUG'];

var LEVEL=1;

for(level in LEVELS){
  var l = LEVELS[level];
  module.exports[l.toLowerCase()] = function(){
    if(level<=LEVEL){
      console.log("[" + l + "] " + util.format.apply(this, arguments));
    }
  }
}
