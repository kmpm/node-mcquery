class QueryError extends Error {
  constructor (message) {
    super()
    Error.captureStackTrace(this, this.constructor)
    this.message = message ||
        'Something went wrong. Please try again.'
  }
}

class QueryConnectionError extends QueryError {

}

module.exports = {
  QueryError,
  QueryConnectionError
}
