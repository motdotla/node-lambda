'use strict'

const assert = require('chai').assert
const path = require('path')
const aws = require('aws-sdk-mock')
aws.setSDK(path.resolve('node_modules/aws-sdk'))
const CloudWatchLogs = require(path.join('..', 'lib', 'cloudwatch_logs'))

const mockResponse = {
  createLogGroup: {
    testCreateLogGroupResponse: 'An empty object is returned in the actual API'
  },

  putRetentionPolicy: {
    testPutRetentionPolicyResponse: 'An empty object is returned in the actual API'
  }
}

const params = {
  FunctionName: 'node-lambda-test-function',
  retentionInDays: 14
}

var logs = null

/* global before, after, describe, it */
describe('lib/cloudwatch_logs', () => {
  before(() => {
    aws.mock('CloudWatchLogs', 'createLogGroup', (params, callback) => {
      callback(null, mockResponse.createLogGroup)
    })
    aws.mock('CloudWatchLogs', 'putRetentionPolicy', (params, callback) => {
      callback(null, mockResponse.putRetentionPolicy)
    })

    logs = new CloudWatchLogs(require('aws-sdk'))
  })

  after(() => aws.restore('CloudWatchLogs'))

  describe('_logGroupName', () => {
    it('correct value', () => {
      assert.equal(
        logs._logGroupName(params),
        '/aws/lambda/node-lambda-test-function'
      )
    })
  })

  describe('_createLogGroup', () => {
    it('using mock', () => {
      return logs._createLogGroup(params).then(data => {
        assert.deepEqual(data, mockResponse.createLogGroup)
      })
    })
  })

  describe('_putRetentionPolicy', () => {
    it('using mock', () => {
      return logs._putRetentionPolicy(params).then(data => {
        assert.deepEqual(data, mockResponse.putRetentionPolicy)
      })
    })
  })

  describe('setLogsRetentionPolicy', () => {
    it('using mock', () => {
      return logs.setLogsRetentionPolicy(params).then(data => {
        assert.deepEqual(data, mockResponse.putRetentionPolicy)
      })
    })
  })
})
