var assert = require('assert');
var program = require('commander');
var fs = require('fs');
var lambda = require('../lib/main');
var should = require('should');

var program = {
  environment: 'development',
  accessKey: 'key',
  secretKey: 'secret',
  functionName: 'node-lambda',
  handler: 'index.handler',
  mode: 'event',
  role: 'some:arn:aws:iam::role',
  memorySize: 128,
  timeout: 3,
  description: '',
  runtime: 'nodejs'
};

describe('node-lambda', function() {
  it('version should be set', function() {
    lambda.version.should.eql('0.3.6');
  });

  describe('_params', function() {
    it( 'appends environment to original functionName', function() {
      var params = lambda._params(program);
      params.FunctionName.should.eql('node-lambda-development');
    });
  });
});
