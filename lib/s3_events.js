'use strict'

/**
 * Do not create S3 bucket.
 * Put the Notification Configuration in the existing Bucket.
 */
class S3Events {
  constructor (aws) {
    // Authenticated `aws` object in `lib/main.js`
    this.lambda = new aws.Lambda({
      apiVersion: '2015-03-31'
    })
    this.s3 = new aws.S3({
      apiVersion: '2006-03-01'
    })
  }

  _functionName (params) {
    return params.FunctionArn.split(':').pop()
  }

  _addPermissionParams (params) {
    return {
      Action: 'lambda:InvokeFunction',
      FunctionName: this._functionName(params),
      Principal: 's3.amazonaws.com',
      SourceArn: 'arn:aws:s3:::' + params.Bucket,
      StatementId: params.Bucket
    }
  }

  _addPermission (params) {
    return new Promise((resolve, reject) => {
      const _params = this._addPermissionParams(params)
      this.lambda.addPermission(_params, (err, data) => {
        if (err) {
          if (err.code !== 'ResourceConflictException') reject(err)
          // If it exists it will result in an error but there is no problem.
          resolve('Already exists permission')
        }
        resolve(data)
      })
    })
  }

  _putBucketNotificationConfigurationParams (params) {
    const lambdaFunctionConfiguration = {
      Events: params.Events,
      LambdaFunctionArn: params.FunctionArn
    }
    if (params.Filter != null) {
      lambdaFunctionConfiguration.Filter = params.Filter
    }

    return {
      Bucket: params.Bucket,
      NotificationConfiguration: {
        LambdaFunctionConfigurations: [
          lambdaFunctionConfiguration
        ]
      }
    }
  }

  _putBucketNotificationConfiguration (params) {
    return new Promise((resolve, reject) => {
      const _params = this._putBucketNotificationConfigurationParams(params)
      this.s3.putBucketNotificationConfiguration(_params, (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })
  }

  add (params) {
    return this._addPermission(params).then(() => {
      return this._putBucketNotificationConfiguration(params)
    })
  }
}

module.exports = S3Events
