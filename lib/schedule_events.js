'use strict';

const ScheduleEvents = function(aws) {
  // Authenticated `aws` object in `lib/main.js`
  this.lambda = new aws.Lambda({
    apiVersion: '2015-03-31'
  });
  this.cloudwatchevents = new aws.CloudWatchEvents({
    apiVersion: '2015-10-07'
  });
};

ScheduleEvents.prototype = {
  _ruleDescription: (params) => {
    return `${params.ScheduleName} - ${params.ScheduleExpression}`;
  },

  _functionName: (params) => {
    return params.FunctionArn.split(':').pop();
  },

  _putRulePrams: function(params) {
    return {
      Name: params.ScheduleName,
      Description: this._ruleDescription(params),
      State: params.ScheduleState,
      ScheduleExpression: params.ScheduleExpression
    };
  },

  _putRule: function(params) {
    const _this = this;
    // return RuleArn if created
    return new Promise((resolve) => {
      const _params = _this._putRulePrams(params);
      _this.cloudwatchevents.putRule(_params, (err, rule) => {
        if (err) throw err;
        resolve(rule);
      });
    });
  },

  _addPermissionParams: function(params) {
    return {
      Action: 'lambda:InvokeFunction',
      FunctionName: this._functionName(params),
      Principal: 'events.amazonaws.com',
      SourceArn: params.RuleArn,
      StatementId: params.ScheduleName
    };
  },

  _addPermission: function(params) {
    const _this = this;
    return new Promise((resolve) => {
      const _params = _this._addPermissionParams(params);
      _this.lambda.addPermission(_params, (err, data) => {
        if (err) {
          if (err.code != 'ResourceConflictException') throw err;
          // If it exists it will result in an error but there is no problem.
          resolve('Already exists permission');
        }
        resolve(data);
      });
    });
  },

  _putTargetsParams: function(params) {
    return {
      Rule: params.ScheduleName,
      Targets: [{
        Arn: params.FunctionArn,
        Id: this._functionName(params)
      }]
    };
  },

  _putTargets: function(params) {
    const _this = this;
    return new Promise((resolve) => {
      const _params = _this._putTargetsParams(params);
      _this.cloudwatchevents.putTargets(_params, (err, data) => {
        // even if it is already registered, it will not be an error.
        if (err) throw(err);
        resolve(data);
      });
    });
  },

  add: function(params) {
    const _this = this;
    return Promise.resolve().then(() => {
      return _this._putRule(params);
    }).then((rule) => {
      return _this._addPermission(Object.assign(params, rule));
    }).then((data) => {
      return _this._putTargets(params);
    });
  },
};

module.exports = ScheduleEvents;
