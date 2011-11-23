/*!
 *  Copyright © 2011 Peter Magnusson.
 *  All rights reserved.
 */
var Query = require('../mcquery');

var query = new Query();

query.startSession('localhost', 25565, function(err, session){
  if(err){
    console.error(err);
  }
  else{
    query.full_stat(session, statCallback);
  }
});


function statCallback(err, stat){
  if(err){
    console.error(err);
  }
  else{
    console.log(stat);
  }
  query.close();
};