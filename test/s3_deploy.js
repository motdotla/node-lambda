'use strict'

const {assert} = require('chai')
const path = require('path')
const aws = require('aws-sdk-mock')
aws.setSDK(path.resolve('node_modules/aws-sdk'))
const S3Deploy = require('../lib/s3_deploy')

const mockResponse = {
  createBucket: {'Location': 'createBucket'},
  putObject: {'ETag': 'putObject'}
}

var s3Deploy = null

/* global describe, it, before, after */
describe('lib/s3_deploy', () => {
  before(() => {
    aws.mock('S3', 'putObject', (params, callback) => {
      callback(null, mockResponse.putObject)
    })
    aws.mock('S3', 'createBucket', (params, callback) => {
      callback(null, mockResponse.createBucket)
    })

    s3Deploy = new S3Deploy(require('aws-sdk'))
  })

  after(() => {
    aws.restore('S3')
  })

  describe('_md5', () => {
    it('md5("hoge") === "ea703e7aa1efda0064eaa507d9e8ab7e"', () => {
      assert.equal(s3Deploy._md5('hoge'), 'ea703e7aa1efda0064eaa507d9e8ab7e')
    })
  })

  describe('_bucketName', () => {
    it('FunctionName + region + md5()', () => {
      const params = {
        FunctionName: 'node-lambda-name',
        region: 'test_region'
      }
      assert.equal(
        s3Deploy._bucketName(params),
        'node-lambda-name-test_region-aac849d59d2be828b793609e03d8241d'
      )
    })
  })

  describe('_s3Key', () => {
    it('"deploy-package" + FunctionName + ".zip"', () => {
      const params = {FunctionName: 'node-lambda-name'}
      assert.equal(
        s3Deploy._s3Key(params),
        'deploy-package-node-lambda-name.zip'
      )
    })
  })

  describe('_getS3Location', () => {
    it('is null', () => {
      assert.isNull(s3Deploy._getS3Location('hoge'))
    })

    it('=== "ap-southeast-1"', () => {
      assert.equal(s3Deploy._getS3Location('ap-southeast-1'), 'ap-southeast-1')
    })
  })

  describe('_createBucket', () => {
    it('using mock', () => {
      const params = {
        bucketName: 'node-lambda-test-bucket',
        region: 'ap-southeast-1'
      }
      return s3Deploy._createBucket(params).then((result) => {
        assert.deepEqual(result, mockResponse.createBucket)
      })
    })
  })

  describe('_putObject', () => {
    it('using mock', () => {
      const params = {
        bucketName: 'node-lambda-test-bucket',
        s3Key: 'testKey'
      }
      return s3Deploy._putObject(params, 'buffer').then((result) => {
        assert.deepEqual(result, mockResponse.putObject)
      })
    })
  })

  describe('putPackage', () => {
    it('using mock', () => {
      const params = {FunctionName: 'node-lambda-test-bucket-20180801'}
      return s3Deploy.putPackage(params, 'ap-southeast-1', 'buffer').then((result) => {
        assert.deepEqual(result, {
          S3Bucket: 'node-lambda-test-bucket-20180801-ap-southeast-1-6c696118a497125',
          S3Key: 'deploy-package-node-lambda-test-bucket-20180801.zip'
        })
      })
    })
  })
})
