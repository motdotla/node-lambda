'use strict'

const aws = require('aws-sdk')
const proxy = require('proxy-agent')

module.exports = {
  sdk: aws,
  updateConfig (config, region) {
    const awsSecurity = { region: region }

    if (config.profile) {
      aws.config.credentials = new aws.SharedIniFileCredentials({
        profile: config.profile
      })
    } else {
      awsSecurity.accessKeyId = config.accessKey
      awsSecurity.secretAccessKey = config.secretKey
    }

    if (config.sessionToken) {
      awsSecurity.sessionToken = config.sessionToken
    }

    if (config.deployTimeout) {
      aws.config.httpOptions.timeout = parseInt(config.deployTimeout)
    }

    if (config.proxy) {
      aws.config.httpOptions.agent = proxy(config.proxy)
    }

    if (config.endpoint) {
      aws.config.endpoint = config.endpoint
    }

    aws.config.update(awsSecurity)
  }
}
