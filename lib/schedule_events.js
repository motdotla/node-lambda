'use strict'

const { CloudWatchEventsClient, PutRuleCommand, PutTargetsCommand } = require('@aws-sdk/client-cloudwatch-events')
const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda')

class ScheduleEvents {
  constructor (config) {
    this.cweClient = new CloudWatchEventsClient(config)
    this.lambdaClient = new LambdaClient(config)
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
    return this.cweClient.send(
      new PutRuleCommand(this._putRulePrams(params))
    )
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
    const _params = this._addPermissionParams(params)
    try {
      return this.lambdaClient.send(new AddPermissionCommand(_params))
    } catch (err) {
      if (err.code !== 'ResourceConflictException') throw err
      // If it exists it will result in an error but there is no problem.
      return 'Permission already set'
    }
  }

  _putTargetsParams (params) {
    return {
      Rule: params.ScheduleName,
      Targets: [{
        Arn: params.FunctionArn,
        Id: this._functionName(params),
        Input: params.Input != null ? JSON.stringify(params.Input) : ''
      }]
    }
  }

  _putTargets (params) {
    // even if it is already registered, it will not be an error.
    return this.cweClient.send(
      new PutTargetsCommand(this._putTargetsParams(params))
    )
  }

  add (params) {
    return Promise.resolve().then(() => {
      return this._putRule(params)
    }).then(rule => {
      return this._addPermission(Object.assign(params, rule))
    }).then(data => {
      return this._putTargets(params)
    })
  }
}

module.exports = ScheduleEvents
