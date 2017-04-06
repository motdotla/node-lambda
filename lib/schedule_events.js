'use strict';

const aws = require('aws-sdk');
const lambda = new aws.Lambda({
  apiVersion: '2015-03-31'
});
const cloudwatchevents = new aws.CloudWatchEvents({
  apiVersion: '2015-10-07'
});

const ScheduleEvents = {
  _ruleDescription: (params) => {
    return `${params.ScheduleName} - ${params.ScheduleExpression}`;
  },

  _functionArn: (params) => {
    return params.FunctionArnPrefix + params.FunctionName;
  },

  _putRulePrams: (params) => {
    return {
      Name: params.ScheduleName,
      Description: ScheduleEvents._ruleDescription(params),
      State: params.ScheduleState,
      ScheduleExpression: params.ScheduleExpression
    };
  },

  _putRule: (params) => {
    // return RuleArn if created
    return new Promise((resolve) => {
      const _params = ScheduleEvents._putRulePrams(params);
      cloudwatchevents.putRule(_params, (err, rule) => {
        if (err) throw err;
        resolve(rule);
      });
    });
  },

  _addPermissionParams: (params) => {
    return {
      Action: 'lambda:InvokeFunction',
      FunctionName: params.FunctionName,
      Principal: 'events.amazonaws.com',
      SourceArn: params.RuleArn,
      StatementId: params.ScheduleName
    };
  },

  _addPermission: (params) => {
    return new Promise((resolve) => {
      const _params = ScheduleEvents._addPermissionParams(params);
      lambda.addPermission(_params, (err, data) => {
        if (err) {
          if (err.code != 'ResourceConflictException') throw err;
          // If it exists it will result in an error but there is no problem.
          resolve('Already exists permission');
        }
        resolve(data);
      });
    });
  },

  _putTargetsParams: (params) => {
    return {
      Rule: params.ScheduleName,
      Targets: [{
        Arn: ScheduleEvents._functionArn(params),
        Id: params.FunctionName
      }]
    };
  },

  _putTargets: (params) => {
    return new Promise((resolve) => {
      const _params = ScheduleEvents._putTargetsParams(params);
      cloudwatchevents.putTargets(_params, (err, data) => {
        // even if it is already registered, it will not be an error.
        if (err) throw(err);
        resolve(data);
      });
    });
  },

  add: (params) => {
    return Promise.resolve().then(() => {
      return ScheduleEvents._putRule(params);
    }).then((rule) => {
      return ScheduleEvents._addPermission(Object.assign(params, rule));
    }).then((data) => {
      return ScheduleEvents._putTargets(params);
    });
  },
};

module.exports = ScheduleEvents;
