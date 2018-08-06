'use strict'

class CloudWatchLogs {
  constructor (aws, region) {
    // Authenticated `aws` object in `lib/main.js`
    this.lambda = new aws.Lambda({
      region: region,
      apiVersion: '2015-03-31'
    })
    this.cloudwatchlogs = new aws.CloudWatchLogs({
      apiVersion: '2014-03-28'
    })
  }

  _logGroupName (params) {
    return `/aws/lambda/${params.FunctionName}`
  }

  _createLogGroup (params) {
    return new Promise((resolve, reject) => {
      this.cloudwatchlogs.createLogGroup({
        logGroupName: this._logGroupName(params)
      }, (err, data) => {
        if (err) {
          if (err.code === 'ResourceAlreadyExistsException') {
            // If it exists it will result in an error but there is no problem.
            return resolve({})
          }
          return reject(err)
        }

        resolve(data)
      })
    })
  }

  _putRetentionPolicy (params) {
    return new Promise((resolve, reject) => {
      this.cloudwatchlogs.putRetentionPolicy({
        logGroupName: this._logGroupName(params),
        retentionInDays: params.retentionInDays
      }, (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  setLogsRetentionPolicy (params) {
    return this._createLogGroup(params)
      .then(() => this._putRetentionPolicy(params))
  }
}

module.exports = CloudWatchLogs
