'use strict';

const assert = require('chai').assert;
const path = require('path');
const aws = require('aws-sdk-mock');
aws.setSDK(path.resolve('node_modules/aws-sdk'));
const ScheduleEvents = require(path.join('..', 'lib', 'schedule_events'));

const params = {
  FunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
  ScheduleName: 'node-lambda-test-schedule',
  ScheduleState: 'ENABLED',
  ScheduleExpression: 'rate(1 hour)',
  ScheduleDescription: null
};

const mockResponse = {
  putRule: {
    RuleArn: 'arn:aws:events:hoge:fuga'
  },

  addPermission: {
    Statement: JSON.stringify({
      Sid: 'node-lambda-test-schedule',
      Resource: 'arn:aws:lambda:piyo',
      Effect: 'Allow',
      Principal: { Service: 'events.amazonaws.com' },
      Action: [ 'lambda:InvokeFunction' ],
      Condition: { ArnLike: { 'AWS:SourceArn': 'arn:aws:events:hoge:fuga' } }
    })
  },

  putTargets: {
    FailedEntries: [],
    FailedEntryCount: 0
  },
};

var schedule = null;

describe('schedule_events', () => {
  before(() => {
    aws.mock('CloudWatchEvents', 'putRule', (params, callback) => {
      callback(null, mockResponse.putRule);
    });
    aws.mock('CloudWatchEvents', 'putTargets', (params, callback) => {
      callback(null, mockResponse.putTargets);
    });
    aws.mock('Lambda', 'addPermission', (params, callback) => {
      callback(null, mockResponse.addPermission);
    });

    schedule = new ScheduleEvents(require('aws-sdk'));
  });

  describe('_ruleDescription (default)', () => {
    it('correct value', () => {
      assert.equal(
        schedule._ruleDescription(params),
        'node-lambda-test-schedule - rate(1 hour)'
      );
    });
  });

  describe('_ruleDescription (custom)', () => {
    before(() => {
      params.ScheduleDescription = 'Run node-lambda-test-function once per hour';
    });

    after(() => {
      params.ScheduleDescription = null;
    });

    it('correct value', () => {
      assert.equal(
        schedule._ruleDescription(params),
        'Run node-lambda-test-function once per hour'
      );
    });
  });

  describe('_functionName', () => {
    it('correct value', () => {
      assert.equal(
        schedule._functionName(params),
        'node-lambda-test-function'
      );
    });
  });

  describe('_putRulePrams', () => {
    it('correct value', () => {
      const expected = {
        Name: 'node-lambda-test-schedule',
        Description: 'node-lambda-test-schedule - rate(1 hour)',
        State: 'ENABLED',
        ScheduleExpression: 'rate(1 hour)'
      };
      assert.deepEqual(schedule._putRulePrams(params), expected);
    });
  });

  describe('_addPermissionParams', () => {
    it('correct value', () => {
      const expected = {
        Action:'lambda:InvokeFunction',
        FunctionName: 'node-lambda-test-function',
        Principal: 'events.amazonaws.com',
        SourceArn: 'arn:aws:events:hoge:fuga',
        StatementId: 'node-lambda-test-schedule',
      };
      const _params = Object.assign(params, mockResponse.putRule);
      assert.deepEqual(schedule._addPermissionParams(_params), expected);
    });
  });

  describe('_putTargetsParams', () => {
    it('correct value', () => {
      const expected = {
        Rule: 'node-lambda-test-schedule',
        Targets: [{
          Arn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
          Id: 'node-lambda-test-function',
        }]
      };
      assert.deepEqual(schedule._putTargetsParams(params), expected);
    });
  });

  describe('_putRule', () => {
    it('using mock', () => {
      return schedule._putRule(params).then((data) => {
        assert.deepEqual(data, mockResponse.putRule);
      });
    });
  });

  describe('_addPermission', () => {
    it('using mock', () => {
      const _params = Object.assign(params, mockResponse.putTargets);
      return schedule._addPermission(_params).then((data) => {
        assert.deepEqual(data, mockResponse.addPermission);
      });
    });
  });

  describe('_putTargets', () => {
    it('using mock', () => {
      return schedule._putTargets(params).then((data) => {
        assert.deepEqual(data, mockResponse.putTargets);
      });
    });
  });

  describe('add', () => {
    it('using mock', () => {
      return schedule.add(params).then((data) => {
        assert.deepEqual(data, mockResponse.putTargets);
      });
    });
  });
});
