'use strict'

const process = require('process')
const crypto = require('crypto')

const {
  S3Client,
  CreateBucketCommand,
  PutObjectCommand
} = require('@aws-sdk/client-s3')

// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/S3.html#createBucket-property
const S3_LOCATION_POSSIBLE_VALUES = [
  'EU',
  'af-south-1',
  'ap-east-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ap-south-1',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ca-central-1',
  'cn-north-1',
  'cn-northwest-1',
  'eu-central-1',
  'eu-north-1',
  'eu-south-1',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'me-south-1',
  'sa-east-1',
  'us-east-2',
  'us-gov-east-1',
  'us-gov-west-1',
  'us-west-1',
  'us-west-2'
]

class S3Deploy {
  constructor (config) {
    this.client = new S3Client(config)
  }

  _md5 (str) {
    return crypto
      .createHash('md5')
      .update(str, 'utf8')
      .digest('hex')
  }

  _convertRegionStringToEnvVarName (region) {
    if (region == null) return 'undefined'
    return region.replace(/-/g, '_').toUpperCase()
  }

  _getBucketNameFromEnvVar (region) {
    const key = [
      'S3',
      this._convertRegionStringToEnvVarName(region),
      'BUCKET'
    ].join('_')
    return process.env[key]
  }

  _getS3KeyPrefixFromEnvVar (region) {
    const key = [
      'S3',
      this._convertRegionStringToEnvVarName(region),
      'PREFIX'
    ].join('_')
    return process.env[key]
  }

  _bucketName (params) {
    const bucketNameFromEnvVar = this._getBucketNameFromEnvVar(params.region)
    if (bucketNameFromEnvVar != null) return bucketNameFromEnvVar

    return [
      params.FunctionName,
      params.region,
      this._md5(params.FunctionName + params.region)
    ]
      .join('-')
      .substr(0, 63).toLowerCase()
  }

  _s3Key (params) {
    const s3Prefix = this._getS3KeyPrefixFromEnvVar(params.region)
    const keys = [`deploy-package-${params.FunctionName}.zip`]
    if (s3Prefix != null) {
      keys.unshift(s3Prefix.replace(/\/$/, ''))
    }
    return keys.join('/')
  }

  _getS3Location (region) {
    return S3_LOCATION_POSSIBLE_VALUES.includes(region) ? region : null
  }

  _createBucket (params) {
    const _params = {
      Bucket: params.bucketName
    }
    const s3Location = this._getS3Location(params.region)
    if (s3Location != null) {
      _params.CreateBucketConfiguration = {
        LocationConstraint: s3Location
      }
    }
    try {
      return this.client.send(new CreateBucketCommand(_params))
    } catch (err) {
      // Ignored created
      if (err.code === 'BucketAlreadyOwnedByYou') return {}
      throw err
    }
  }

  _putObject (params, buffer) {
    return this.client.send(new PutObjectCommand({
      Body: buffer,
      Bucket: params.bucketName,
      Key: params.s3Key
    }))
  }

  putPackage (params, region, buffer) {
    const _params = Object.assign({ region }, params)
    _params.bucketName = this._bucketName(_params)
    _params.s3Key = this._s3Key(_params)

    return this._createBucket(_params).then((result) => {
      if (result.Location != null) {
        console.log('=> S3 Bucket created:')
        console.log(`===> ${_params.bucketName}`)
      }
      return this._putObject(_params, buffer)
    }).then((result) => {
      console.log('=> Deploy the zip file to S3:')
      console.log(`===> ${_params.bucketName}/${_params.s3Key}`)
      return {
        S3Bucket: _params.bucketName,
        S3Key: _params.s3Key
      }
    })
  }
}

module.exports = S3Deploy
