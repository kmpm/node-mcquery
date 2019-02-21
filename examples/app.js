/*!
 *  Copyright © 2011-2018 Peter Magnusson.
 *  All rights reserved.
 */
var Query = require('..')

var HOST = process.env.MC_SERVER || 'localhost'
var PORT = process.env.MC_PORT || 25565

var query = new Query(HOST, PORT)

query.connect(function (err) {
  if (err) {
    console.error(err)
  } else {
    query.full_stat(fullStatBack)
    query.basic_stat(basicStatBack)
  }
})

function basicStatBack (err, stat) {
  if (err) {
    console.error(err)
  }
  console.log('basicBack', stat)
  shouldWeClose()
}

function fullStatBack (err, stat) {
  if (err) {
    console.error(err)
  }
  console.log('fullBack', stat)
  shouldWeClose()
}

function shouldWeClose () {
  // have we got all answers
  if (query.outstandingRequests === 0) {
    query.close()
  }
}
