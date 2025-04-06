'use strict'

let assert
import('chai').then(chai => {
  assert = chai.assert
})
const path = require('path')
const CloudWatchLogs = require(path.join('..', 'lib', 'cloudwatch_logs'))

const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand
} = require('@aws-sdk/client-cloudwatch-logs')
const { mockClient } = require('aws-sdk-client-mock')
const mockCloudWatchLogsClient = mockClient(CloudWatchLogsClient)

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

let logs = null

/* global before, describe, it */
describe('lib/cloudwatch_logs', () => {
  before(() => {
    mockCloudWatchLogsClient.reset()
    mockCloudWatchLogsClient.on(CreateLogGroupCommand).resolves(mockResponse.createLogGroup)
    mockCloudWatchLogsClient.on(PutRetentionPolicyCommand).resolves(mockResponse.putRetentionPolicy)

    logs = new CloudWatchLogs({ region: 'us-east-1' })
  })

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
      return logs._createLogGroup(params).then((data) => {
        assert.deepEqual(data, mockResponse.createLogGroup)
      })
    })
  })

  describe('_putRetentionPolicy', () => {
    it('using mock', () => {
      return logs._putRetentionPolicy(params).then((data) => {
        assert.deepEqual(data, mockResponse.putRetentionPolicy)
      })
    })
  })

  describe('setLogsRetentionPolicy', () => {
    it('using mock', () => {
      return logs.setLogsRetentionPolicy(params).then((data) => {
        assert.deepEqual(data, mockResponse.putRetentionPolicy)
      })
    })
  })
})
