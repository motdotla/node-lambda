'use strict'

let assert
import('chai').then(chai => {
  assert = chai.assert
})
const process = require('process')
const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3')
const { mockClient } = require('aws-sdk-client-mock')
const mockS3Client = mockClient(S3Client)
const S3Deploy = require('../lib/s3_deploy')

const mockResponse = {
  createBucket: { Location: 'createBucket' },
  putObject: { ETag: 'putObject' }
}

let s3Deploy = null

/* global describe, it, before, after */
describe('lib/s3_deploy', () => {
  before(() => {
    mockS3Client.reset()
    mockS3Client.on(CreateBucketCommand).resolves(mockResponse.createBucket)
    mockS3Client.on(PutObjectCommand).resolves(mockResponse.putObject)

    s3Deploy = new S3Deploy({ region: 'us-west-1' })
  })

  describe('_md5', () => {
    it('md5("hoge") === "ea703e7aa1efda0064eaa507d9e8ab7e"', () => {
      assert.equal(s3Deploy._md5('hoge'), 'ea703e7aa1efda0064eaa507d9e8ab7e')
    })
  })

  describe('_convertRegionStringToEnvVarName', () => {
    it('Upper case. Replace "-" with "_".', () => {
      [{
        value: 'us-west-1',
        expected: 'US_WEST_1'
      }, {
        value: 'ap-southeast-2',
        expected: 'AP_SOUTHEAST_2'
      }].forEach((test) => {
        assert.equal(
          s3Deploy._convertRegionStringToEnvVarName(test.value),
          test.expected,
          test
        )
      })
    })
  })

  describe('_getBucketNameFromEnvVar', () => {
    after(() => {
      delete process.env.S3_US_WEST_1_BUCKET
    })

    it('is undefined', () => {
      assert.isUndefined(s3Deploy._getBucketNameFromEnvVar('us-west-1'))
    })

    it('Get values from environment variables', () => {
      process.env.S3_US_WEST_1_BUCKET = 'bucketName'
      assert.equal(
        s3Deploy._getBucketNameFromEnvVar('us-west-1'),
        'bucketName'
      )
    })
  })

  describe('_getS3KeyPrefixFromEnvVar', () => {
    after(() => {
      delete process.env.S3_US_WEST_1_PREFIX
    })

    it('is undefined', () => {
      assert.isUndefined(s3Deploy._getS3KeyPrefixFromEnvVar('us-west-1'))
    })

    it('Get values from environment variables', () => {
      process.env.S3_US_WEST_1_PREFIX = 's3KeyPrefix'
      assert.equal(
        s3Deploy._getS3KeyPrefixFromEnvVar('us-west-1'),
        's3KeyPrefix'
      )
    })
  })

  describe('_bucketName', () => {
    after(() => {
      delete process.env.S3_TEST_REGION_BUCKET
    })

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

    it('Use environment variables', () => {
      process.env.S3_TEST_REGION_BUCKET = 's3-test-region-bucket'
      const params = {
        FunctionName: 'node-lambda-name',
        region: 'test_region'
      }
      assert.equal(s3Deploy._bucketName(params), 's3-test-region-bucket')
    })
  })

  describe('_s3Key', () => {
    after(() => {
      delete process.env.S3_TEST_REGION_PREFIX
    })

    it('"deploy-package" + FunctionName + ".zip"', () => {
      const params = {
        FunctionName: 'node-lambda-name',
        region: 'test_region'
      }
      assert.equal(
        s3Deploy._s3Key(params),
        'deploy-package-node-lambda-name.zip'
      )
    })

    it('Use environment variables', () => {
      process.env.S3_TEST_REGION_PREFIX = 's3-test-region-prefix/'
      const params = {
        FunctionName: 'node-lambda-name',
        region: 'test_region'
      }
      assert.equal(
        s3Deploy._s3Key(params),
        's3-test-region-prefix/deploy-package-node-lambda-name.zip'
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
      const params = { FunctionName: 'node-lambda-test-bucket-20180801' }
      return s3Deploy.putPackage(params, 'ap-southeast-1', 'buffer').then((result) => {
        assert.deepEqual(result, {
          S3Bucket: 'node-lambda-test-bucket-20180801-ap-southeast-1-6c696118a497125',
          S3Key: 'deploy-package-node-lambda-test-bucket-20180801.zip'
        })
      })
    })
  })
})
