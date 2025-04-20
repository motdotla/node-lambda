'use strict'

const { S3Client, PutBucketNotificationConfigurationCommand } = require('@aws-sdk/client-s3')
const { LambdaClient, AddPermissionCommand } = require('@aws-sdk/client-lambda')

/**
 * Do not create S3 bucket.
 * Put the Notification Configuration in the existing Bucket.
 */
class S3Events {
  constructor (config) {
    this.s3Client = new S3Client(config)
    this.lambdaClient = new LambdaClient(config)
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
    const _params = this._addPermissionParams(params)
    try {
      return this.lambdaClient.send(new AddPermissionCommand(_params))
    } catch (err) {
      if (err.code !== 'ResourceConflictException') throw err
      // If it exists it will result in an error but there is no problem.
      return 'Permission already set'
    }
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
    return this.s3Client.send(
      new PutBucketNotificationConfigurationCommand(putBucketNotificationConfigurationParams))
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
