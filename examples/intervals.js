/*!
 *  Check the server every 5 seconds
 *
 *  Copyright © 2011-2020 Peter Magnusson.
 *  All rights reserved.
 */
var Query = require('..')

var HOST = process.env.MC_SERVER || 'localhost'
var PORT = process.env.MC_PORT || 25565

// uses the optional settings
// for a longer timeout;
var query = new Query(HOST, PORT, { timeout: 10000 })

function checkMcServer () {
  // connect every time to get a new challengeToken
  query.connect(function (err) {
    if (err) {
      console.error(err)
    } else {
      query.full_stat(fullStatBack)
    }
  })
}

function fullStatBack (err, stat) {
  if (err) {
    console.error(err)
  }
  console.log('%s>fullBack \n', new Date(), stat)
}

setInterval(function () {
  checkMcServer()
}, 5000)
