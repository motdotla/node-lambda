'use strict'

let assert
import('chai').then(chai => {
  assert = chai.assert
})
const path = require('path')
const { CloudWatchEventsClient, PutRuleCommand, PutTargetsCommand } = require('@aws-sdk/client-cloudwatch-events')
const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda')
const { mockClient } = require('aws-sdk-client-mock')
const mockCloudWatchEventsClient = mockClient(CloudWatchEventsClient)
const mockLambdaClient = mockClient(LambdaClient)
const ScheduleEvents = require(path.join('..', 'lib', 'schedule_events'))

const params = {
  FunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
  ScheduleName: 'node-lambda-test-schedule',
  ScheduleState: 'ENABLED',
  ScheduleExpression: 'rate(1 hour)',
  ScheduleDescription: null
}

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
      Action: ['lambda:InvokeFunction'],
      Condition: { ArnLike: { 'AWS:SourceArn': 'arn:aws:events:hoge:fuga' } }
    })
  },

  putTargets: {
    FailedEntries: [],
    FailedEntryCount: 0
  }
}

let schedule = null

/* global before, after, describe, it */
describe('lib/schedule_events', () => {
  before(() => {
    mockCloudWatchEventsClient.reset()
    mockCloudWatchEventsClient.on(PutRuleCommand).resolves(mockResponse.putRule)
    mockCloudWatchEventsClient.on(PutTargetsCommand).resolves(mockResponse.putTargets)

    mockLambdaClient.reset()
    mockLambdaClient.on(AddPermissionCommand).resolves(mockResponse.addPermission)

    schedule = new ScheduleEvents({ region: 'us-west-1' })
  })

  describe('_ruleDescription (default)', () => {
    it('correct value', () => {
      assert.equal(
        schedule._ruleDescription(params),
        'node-lambda-test-schedule - rate(1 hour)'
      )
    })
  })

  describe('_ruleDescription (custom)', () => {
    before(() => {
      params.ScheduleDescription = 'Run node-lambda-test-function once per hour'
    })

    after(() => {
      params.ScheduleDescription = null
    })

    it('correct value', () => {
      assert.equal(
        schedule._ruleDescription(params),
        'Run node-lambda-test-function once per hour'
      )
    })
  })

  describe('_functionName', () => {
    it('correct value', () => {
      assert.equal(
        schedule._functionName(params),
        'node-lambda-test-function'
      )
    })
  })

  describe('_putRulePrams', () => {
    it('correct value', () => {
      const expected = {
        Name: 'node-lambda-test-schedule',
        Description: 'node-lambda-test-schedule - rate(1 hour)',
        State: 'ENABLED',
        ScheduleExpression: 'rate(1 hour)'
      }
      assert.deepEqual(schedule._putRulePrams(params), expected)
    })
  })

  describe('_addPermissionParams', () => {
    it('correct value', () => {
      const expected = {
        Action: 'lambda:InvokeFunction',
        FunctionName: 'node-lambda-test-function',
        Principal: 'events.amazonaws.com',
        SourceArn: 'arn:aws:events:hoge:fuga',
        StatementId: 'node-lambda-test-schedule'
      }
      const _params = Object.assign(params, mockResponse.putRule)
      assert.deepEqual(schedule._addPermissionParams(_params), expected)
    })
  })

  describe('_putTargetsParams', () => {
    it('correct value (No "Input" setting)', () => {
      const expected = {
        Rule: 'node-lambda-test-schedule',
        Targets: [{
          Arn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
          Id: 'node-lambda-test-function',
          Input: ''
        }]
      }
      assert.deepEqual(schedule._putTargetsParams(params), expected)
    })

    it('correct value ("Input" setting)', () => {
      const expected = {
        Rule: 'node-lambda-test-schedule',
        Targets: [{
          Arn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
          Id: 'node-lambda-test-function',
          Input: '{"key":"value"}'
        }]
      }
      assert.deepEqual(
        schedule._putTargetsParams(Object.assign({ Input: { key: 'value' } }, params)),
        expected
      )
    })
  })

  describe('_putRule', () => {
    it('using mock', () => {
      return schedule._putRule(params).then((data) => {
        assert.deepEqual(data, mockResponse.putRule)
      })
    })
  })

  describe('_addPermission', () => {
    it('using mock', () => {
      const _params = Object.assign(params, mockResponse.putTargets)
      return schedule._addPermission(_params).then((data) => {
        assert.deepEqual(data, mockResponse.addPermission)
      })
    })
  })

  describe('_putTargets', () => {
    it('using mock', () => {
      return schedule._putTargets(params).then((data) => {
        assert.deepEqual(data, mockResponse.putTargets)
      })
    })
  })

  describe('add', () => {
    it('using mock', () => {
      return schedule.add(params).then((data) => {
        assert.deepEqual(data, mockResponse.putTargets)
      })
    })
  })
})
