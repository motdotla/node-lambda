'use strict'

const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand
} = require('@aws-sdk/client-cloudwatch-logs')

class CloudWatchLogs {
  constructor (config) {
    this.client = new CloudWatchLogsClient(config)
  }

  _logGroupName (params) {
    return `/aws/lambda/${params.FunctionName}`
  }

  _createLogGroup (params) {
    try {
      return this.client.send(new CreateLogGroupCommand({
        logGroupName: this._logGroupName(params)
      }))
    } catch (err) {
      if (err.code === 'ResourceAlreadyExistsException') {
        // If it exists it will result in an error but there is no problem.
        return {}
      }
      throw err
    }
  }

  _putRetentionPolicy (params) {
    return this.client.send(new PutRetentionPolicyCommand({
      logGroupName: this._logGroupName(params),
      retentionInDays: params.retentionInDays
    }))
  }

  setLogsRetentionPolicy (params) {
    return this._createLogGroup(params)
      .then(() => this._putRetentionPolicy(params))
  }
}

module.exports = CloudWatchLogs
