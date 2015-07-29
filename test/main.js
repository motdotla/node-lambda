var chai = require('chai');
var program = require('commander');
var fs = require('fs');
var Hoek = require('hoek');
var lambda = require('../lib/main');
var os = require('os');
var fs = require('fs');
var _ = require('lodash');
var zip = require('node-zip');

var assert = chai.assert;

var originalProgram = {
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
  runtime: 'nodejs',
  region: 'us-east-1,us-west-2,eu-west-1'
};

var codeDirectory = lambda._codeDirectory(program);

describe('node-lambda', function() {
  beforeEach(function() {
    program = Hoek.clone(originalProgram);
  });

  it('version should be set', function() {
    assert.equal(lambda.version, '0.5.0');
  });

  describe('_params', function() {
    it( 'appends environment to original functionName', function() {
      var params = lambda._params(program);
      assert.equal(params.FunctionName, 'node-lambda-development');
    });

    it( 'appends environment to original functionName (production)', function() {
      program.environment = 'production';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, 'node-lambda-production');
    });

    it( 'appends version to original functionName', function() {
      program.version = '2015-02-01';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, 'node-lambda-development-2015-02-01');
    });
  });

  describe('_zipfileTmpPath', function() {
    it('has the correct path', function() {
      var zipfileTmpPath = lambda._zipfileTmpPath(program);
      var value = zipfileTmpPath.indexOf(program.functionName) > 0;
      assert.equal(value, true);
    });
  });

  describe('_rsync', function() {
    it('rsync an index.js as well as other files', function(done) {
      lambda._rsync(program, codeDirectory, function(err, result) {
        var contents = fs.readdirSync(codeDirectory);

        var result = _.includes(contents, 'index.js');
        assert.equal(result, true);

        done();
      });
    });
  });

  describe('_npmInstall', function() {
    beforeEach(function(done) {
      lambda._rsync(program, codeDirectory, function(err, result) {
        done();
      });
    });

    it('_npm adds node_modules', function(done) {
      this.timeout(60000); // give it time to build the node modules

      lambda._npmInstall(program, codeDirectory, function(err, result) {
        var contents = fs.readdirSync(codeDirectory);

        var result = _.includes(contents, 'index.js');
        assert.equal(result, true);

        done();
      });
    });
  });

  describe('_zip', function() {
    beforeEach(function(done) {
      this.timeout(30000); // give it time to build the node modules
      lambda._rsync(program, codeDirectory, function(err, result) {

        lambda._npmInstall(program, codeDirectory, function(err, result) {
          done();
        });
      });
    });

    it('zips the file and has an index.js file', function(done) {
      this.timeout(30000); // give it time to zip

      lambda._zip(program, codeDirectory, function(err, data) {
        var archive = new zip(data);
        var contents = _.map(archive.files, function(f) { return f.name.toString() });
        var result = _.includes(contents, 'index.js');
        assert.equal(result, true);

        done();
      });
    });
  });
});
