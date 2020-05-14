/*!
 *  Copyright © 2011-2020 Peter Magnusson.
 *  All rights reserved.
 */
var Query = require('..')

var HOST = process.env.MC_SERVER || 'localhost'
var PORT = process.env.MC_PORT || 25565

var query = new Query(HOST, PORT)

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

console.log('Connecting to server')
query.connect()
  .then(() => {
    console.log('asking for basic_stat')
    query.basic_stat(basicStatBack)
    console.log('Asking for full_stat')
    query.full_stat(fullStatBack)
  })
  .catch(err => {
    console.error('error connecting', err)
  })
