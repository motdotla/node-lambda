'use strict'

const assert = require('chai').assert
const path = require('path')
const aws = require('aws-sdk-mock')
aws.setSDK(path.resolve('node_modules/aws-sdk'))
const S3Events = require('../lib/s3_events')

const params = {
  FunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
  Bucket: 'node-lambda-test-bucket',
  Events: ['s3:ObjectCreated:*'],
  Filter: null
}

const mockResponse = {
  addPermission: {
    Statement: JSON.stringify({
      Sid: 'node-lambda-test-bucket',
      Resource: 'arn:aws:lambda:node-lambda-test-function',
      Effect: 'Allow',
      Principal: { Service: 's3.amazonaws.com' },
      Action: ['lambda:InvokeFunction'],
      Condition: { ArnLike: { 'AWS:SourceArn': 'arn:aws:s3:::node-lambda-test-bucket' } }
    })
  },

  putBucketNotificationConfiguration: {}
}

let s3Events = null

/* global before, after, describe, it */
describe('lib/s3_events', () => {
  before(() => {
    aws.mock('Lambda', 'addPermission', (params, callback) => {
      callback(null, mockResponse.addPermission)
    })
    aws.mock('S3', 'putBucketNotificationConfiguration', (params, callback) => {
      callback(null, mockResponse.putBucketNotificationConfiguration)
    })

    s3Events = new S3Events(require('aws-sdk'))
  })

  after(() => {
    aws.restore('Lambda')
    aws.restore('S3')
  })

  describe('_functionName', () => {
    it('Extract name from FunctionArn', () => {
      assert.equal(
        s3Events._functionName(params),
        'node-lambda-test-function'
      )
    })
  })

  describe('_statementId', () => {
    it('StatementId that matches /[a-zA-Z0-9-_]+/.', () => {
      [{
        params: params,
        expected: 'node-lambda-test-bucket'
      }, {
        params: { Bucket: 'example.com' },
        expected: 'example_com'
      }].forEach((test) => {
        const actual = s3Events._statementId(test.params)
        assert.equal(actual, test.expected, test)
        assert.match(actual, /[a-zA-Z0-9-_]+/, test)
      })
    })
  })

  describe('_addPermissionParams', () => {
    it('Return parameters for lambda.addPermission()', () => {
      const expected = {
        Action: 'lambda:InvokeFunction',
        FunctionName: 'node-lambda-test-function',
        Principal: 's3.amazonaws.com',
        SourceArn: 'arn:aws:s3:::node-lambda-test-bucket',
        StatementId: 'node-lambda-test-bucket'
      }
      assert.deepEqual(s3Events._addPermissionParams(params), expected)
    })
  })

  describe('_lambdaFunctionConfiguration', () => {
    it('Return parameters for s3._lambdaFunctionConfiguration(). No Filter', () => {
      const expected = {
        Events: ['s3:ObjectCreated:*'],
        LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
      }
      assert.deepEqual(
        s3Events._lambdaFunctionConfiguration(params),
        expected
      )
    })

    it('Return parameters for s3.putBucketNotificationConfiguration(). Use Filter', () => {
      const expected = {
        Events: ['s3:ObjectCreated:*'],
        LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function',
        Filter: {
          Key: {
            FilterRules: [{
              Name: 'prefix',
              Value: 'test-prefix'
            }]
          }
        }
      }
      const _params = Object.assign({}, params)
      _params.Filter = {
        Key: {
          FilterRules: [{
            Name: 'prefix',
            Value: 'test-prefix'
          }]
        }
      }
      assert.deepEqual(
        s3Events._lambdaFunctionConfiguration(_params),
        expected
      )
    })
  })

  describe('_paramsListToBucketNotificationConfigurations', () => {
    describe('The number of elements of paramsList is 1', () => {
      it('Return parameter list of putBucketNotificationConfiguration', () => {
        const expected = [{
          Bucket: 'node-lambda-test-bucket',
          NotificationConfiguration: {
            LambdaFunctionConfigurations: [{
              Events: ['s3:ObjectCreated:*'],
              LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
            }]
          }
        }]
        assert.deepEqual(
          s3Events._paramsListToBucketNotificationConfigurations([params]),
          expected
        )
      })
    })
    describe('The number of elements of paramsList is 2. Same bucket', () => {
      it('Return parameter list of putBucketNotificationConfiguration', () => {
        const expected = [{
          Bucket: 'node-lambda-test-bucket',
          NotificationConfiguration: {
            LambdaFunctionConfigurations: [{
              Events: ['s3:ObjectCreated:*'],
              LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
            }, {
              Events: ['s3:ObjectDelete:*'],
              LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
            }]
          }
        }]

        const paramsDeleteEvent = Object.assign({}, params)
        paramsDeleteEvent.Events = ['s3:ObjectDelete:*']
        assert.deepEqual(
          s3Events._paramsListToBucketNotificationConfigurations([
            params,
            paramsDeleteEvent
          ]),
          expected
        )
      })
    })
    describe('The number of elements of paramsList is 2. Different bucket', () => {
      it('Return parameter list of putBucketNotificationConfiguration', () => {
        const expected = [{
          Bucket: 'node-lambda-test-bucket',
          NotificationConfiguration: {
            LambdaFunctionConfigurations: [{
              Events: ['s3:ObjectCreated:*'],
              LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
            }]
          }
        }, {
          Bucket: 'node-lambda-test-bucket2',
          NotificationConfiguration: {
            LambdaFunctionConfigurations: [{
              Events: ['s3:ObjectCreated:*'],
              LambdaFunctionArn: 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
            }]
          }
        }]

        const paramsDifferentBucket = Object.assign({}, params)
        paramsDifferentBucket.Bucket = 'node-lambda-test-bucket2'
        assert.deepEqual(
          s3Events._paramsListToBucketNotificationConfigurations([
            params,
            paramsDifferentBucket
          ]),
          expected
        )
      })
    })
  })

  describe('_addPermission', () => {
    it('using mock', () => {
      return s3Events._addPermission(params).then(data => {
        assert.deepEqual(data, mockResponse.addPermission)
      })
    })
  })

  describe('_putBucketNotificationConfiguration', () => {
    it('using mock', () => {
      const putBucketNotificationConfigurationParams =
        s3Events._paramsListToBucketNotificationConfigurations([params])[0]
      return s3Events._putBucketNotificationConfiguration(putBucketNotificationConfigurationParams).then(data => {
        assert.deepEqual(data, mockResponse.putBucketNotificationConfiguration)
      })
    })
  })

  describe('add', () => {
    it('using mock', () => {
      return s3Events.add([params]).then(data => {
        assert.deepEqual(data, mockResponse.putBucketNotificationConfiguration)
      })
    })
  })
})
