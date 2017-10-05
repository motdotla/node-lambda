'use strict'

class ScheduleEvents {
  constructor (aws) {
    // Authenticated `aws` object in `lib/main.js`
    this.lambda = new aws.Lambda({
      apiVersion: '2015-03-31'
    })
    this.cloudwatchevents = new aws.CloudWatchEvents({
      apiVersion: '2015-10-07'
    })
  }

  _ruleDescription (params) {
    if ('ScheduleDescription' in params && params.ScheduleDescription != null) {
      return `${params.ScheduleDescription}`
    }
    return `${params.ScheduleName} - ${params.ScheduleExpression}`
  }

  _functionName (params) {
    return params.FunctionArn.split(':').pop()
  }

  _putRulePrams (params) {
    return {
      Name: params.ScheduleName,
      Description: this._ruleDescription(params),
      State: params.ScheduleState,
      ScheduleExpression: params.ScheduleExpression
    }
  }

  _putRule (params) {
    // return RuleArn if created
    return new Promise((resolve) => {
      const _params = this._putRulePrams(params)
      this.cloudwatchevents.putRule(_params, (err, rule) => {
        if (err) throw err
        resolve(rule)
      })
    })
  }

  _addPermissionParams (params) {
    return {
      Action: 'lambda:InvokeFunction',
      FunctionName: this._functionName(params),
      Principal: 'events.amazonaws.com',
      SourceArn: params.RuleArn,
      StatementId: params.ScheduleName
    }
  }

  _addPermission (params) {
    return new Promise((resolve) => {
      const _params = this._addPermissionParams(params)
      this.lambda.addPermission(_params, (err, data) => {
        if (err) {
          if (err.code !== 'ResourceConflictException') throw err
          // If it exists it will result in an error but there is no problem.
          resolve('Already exists permission')
        }
        resolve(data)
      })
    })
  }

  _putTargetsParams (params) {
    return {
      Rule: params.ScheduleName,
      Targets: [{
        Arn: params.FunctionArn,
        Id: this._functionName(params),
        Input: params.hasOwnProperty('Input') ? JSON.stringify(params.Input) : ''
      }]
    }
  }

  _putTargets (params) {
    return new Promise((resolve) => {
      const _params = this._putTargetsParams(params)
      this.cloudwatchevents.putTargets(_params, (err, data) => {
        // even if it is already registered, it will not be an error.
        if (err) throw (err)
        resolve(data)
      })
    })
  }

  add (params) {
    return Promise.resolve().then(() => {
      return this._putRule(params)
    }).then((rule) => {
      return this._addPermission(Object.assign(params, rule))
    }).then((data) => {
      return this._putTargets(params)
    })
  }
}

module.exports = ScheduleEvents
