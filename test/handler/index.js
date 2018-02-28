'use strict'

// For testing AWSXRay support
const AWSXRay = require('aws-xray-sdk-core')

exports.handler = (event, context, callback) => {
  // It changes to a boolean value with `!!`
  context.callbackWaitsForEmptyEventLoop =
    !!event.callbackWaitsForEmptyEventLoop

  if (event.asyncTest) {
    setTimeout(() => console.log('sleep 3500 msec'), 3500)
  }

  // https://docs.aws.amazon.com/xray/latest/devguide/scorekeep-lambda.html
  // For testing AWSXRay support
  AWSXRay.captureFunc('annotations', (subsegment) => {
    subsegment.addAnnotation('Name', 'name')
    subsegment.addAnnotation('UserID', 'piyo')
  })

  /* eslint-disable no-eval */
  eval(event.callbackCode)
}
