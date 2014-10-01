/*!
 *  Copyright © 2011 Peter Magnusson.
 *  All rights reserved.
 */
var Query = require('../mcquery'),
    fs = require('fs'),
    path = require('path');

var f = path.resolve('./config.json');

if (fs.existsSync(f)) {
  var config = require(f);
}
else {
  config = {host:'localhost', port:25565};
}

var query = new Query(config.host, config.port);
var reqcount = 2;
query.connect(function (err) {
  if (err) {
    console.error(err);
  }
  else {
    query.full_stat(statCallback);
    query.basic_stat(statCallback);
  }
});


function statCallback(err, stat) {
  if (err) {
    console.error(err);
  }
  else {
    console.log(stat.hostname || stat.MOTD);
  }
  reqcount--;
  if (reqcount < 1) {
    query.close();
  }
}
