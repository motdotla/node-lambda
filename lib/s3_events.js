'use strict'

/**
 * Do not create S3 bucket.
 * Put the Notification Configuration in the existing Bucket.
 */
class S3Events {
  constructor (aws, region) {
    // Authenticated `aws` object in `lib/main.js`
    this.lambda = new aws.Lambda({
      region: region,
      apiVersion: '2015-03-31'
    })
    this.s3 = new aws.S3({
      region: region,
      apiVersion: '2006-03-01'
    })
  }

  _functionName (params) {
    return params.FunctionArn.split(':').pop()
  }

  _statementId (params) {
    return params.Bucket.replace(/[^a-zA-Z0-9-_]/g, '_')
  }

  _addPermissionParams (params) {
    return {
      Action: 'lambda:InvokeFunction',
      FunctionName: this._functionName(params),
      Principal: 's3.amazonaws.com',
      SourceArn: 'arn:aws:s3:::' + params.Bucket,
      StatementId: this._statementId(params)
    }
  }

  _addPermission (params) {
    return new Promise((resolve, reject) => {
      const _params = this._addPermissionParams(params)
      this.lambda.addPermission(_params, (err, data) => {
        if (err) {
          if (err.code !== 'ResourceConflictException') reject(err)
          // If it exists it will result in an error but there is no problem.
          resolve('Permission already set')
        }
        resolve(data)
      })
    })
  }

  _lambdaFunctionConfiguration (params) {
    const lambdaFunctionConfiguration = {
      Events: params.Events,
      LambdaFunctionArn: params.FunctionArn
    }
    if (params.Filter != null) {
      lambdaFunctionConfiguration.Filter = params.Filter
    }

    return lambdaFunctionConfiguration
  }

  _paramsListToBucketNotificationConfigurations (paramsList) {
    const lambdaFunctionConfigurations = {}
    for (const params of paramsList) {
      if (lambdaFunctionConfigurations[params.Bucket] == null) {
        lambdaFunctionConfigurations[params.Bucket] = [
          this._lambdaFunctionConfiguration(params)
        ]
        continue
      }
      lambdaFunctionConfigurations[params.Bucket].push(
        this._lambdaFunctionConfiguration(params)
      )
    }
    return Object.keys(lambdaFunctionConfigurations).map((bucket) => {
      return {
        Bucket: bucket,
        NotificationConfiguration: {
          LambdaFunctionConfigurations:
            lambdaFunctionConfigurations[bucket]
        }
      }
    })
  }

  _putBucketNotificationConfiguration (putBucketNotificationConfigurationParams) {
    return new Promise((resolve, reject) => {
      this.s3.putBucketNotificationConfiguration(putBucketNotificationConfigurationParams, (err, data) => {
        if (err) reject(err)
        resolve(data)
      })
    })
  }

  add (paramsList) {
    return paramsList.map(params => {
      return this._addPermission(params)
    }).reduce((a, b) => {
      return a.then(b)
    }, Promise.resolve()).then(() => {
      return this._paramsListToBucketNotificationConfigurations(paramsList).map(putBucketNotificationConfigurationParams => {
        return this._putBucketNotificationConfiguration(putBucketNotificationConfigurationParams)
      }).reduce((a, b) => {
        return a.then(b)
      }, Promise.resolve({}))
    })
  }
}

module.exports = S3Events
