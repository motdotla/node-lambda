'use strict';

var chai = require('chai');
var program = require('commander');
var fs = require('fs-extra');
var Hoek = require('hoek');
var lambda = require('../lib/main');
var _ = require('lodash');
var zip = require('node-zip');
var rimraf = require('rimraf');

var assert = chai.assert;

var originalProgram = {
  environment: 'development',
  accessKey: 'key',
  secretKey: 'secret',
  sessionToken: 'token',
  functionName: 'node-lambda',
  handler: 'index.handler',
  role: 'some:arn:aws:iam::role',
  memorySize: 128,
  timeout: 3,
  description: '',
  runtime: 'nodejs6.10',
  deadLetterConfigTargetArn: '',
  region: 'us-east-1,us-west-2,eu-west-1',
  eventFile: 'event.json',
  eventSourceFile: '',
  contextFile: 'context.json',
  prebuiltDirectory: '',
};

var codeDirectory = lambda._codeDirectory(Hoek.clone(originalProgram));

describe('node-lambda', function () {
  beforeEach(function () {
    program = Hoek.clone(originalProgram);
  });

  after(function () {
    this.timeout(30000); // give it time to remove
    fs.removeSync(`/tmp/${program.functionName}-[0-9]*`);
  });

  it('version should be set', function () {
    assert.equal(lambda.version, '0.9.0');
  });

  describe('_params', function () {
    it('appends environment to original functionName', function () {
      var params = lambda._params(program);
      assert.equal(params.FunctionName, 'node-lambda-development');
    });

    it('appends environment to original functionName (production)', function () {
      program.environment = 'production';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, 'node-lambda-production');
    });

    it('appends version to original functionName', function () {
      program.lambdaVersion = '2015-02-01';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, 'node-lambda-development-2015-02-01');
    });

    it('appends VpcConfig to params when vpc params set', function() {
      program.vpcSubnets = 'subnet-00000000,subnet-00000001,subnet-00000002';
      program.vpcSecurityGroups = 'sg-00000000,sg-00000001,sg-00000002';
      var params = lambda._params(program);
      assert.equal(params.VpcConfig.SubnetIds[0], program.vpcSubnets.split(',')[0]);
      assert.equal(params.VpcConfig.SubnetIds[1], program.vpcSubnets.split(',')[1]);
      assert.equal(params.VpcConfig.SubnetIds[2], program.vpcSubnets.split(',')[2]);
      assert.equal(params.VpcConfig.SecurityGroupIds[0], program.vpcSecurityGroups.split(',')[0]);
      assert.equal(params.VpcConfig.SecurityGroupIds[1], program.vpcSecurityGroups.split(',')[1]);
      assert.equal(params.VpcConfig.SecurityGroupIds[2], program.vpcSecurityGroups.split(',')[2]);
    });

    it('does not append VpcConfig when params are not set', function() {
      var params = lambda._params(program);
      assert.equal(Object.keys(params.VpcConfig.SubnetIds).length, 0);
      assert.equal(Object.keys(params.VpcConfig.SecurityGroupIds).length, 0);
    });

    it('appends DeadLetterConfig to params when DLQ params set', function() {
      ['', 'arn:aws:sqs:test'].forEach(function(v) {
        program.deadLetterConfigTargetArn = v;
        const params = lambda._params(program);
        assert.equal(params.DeadLetterConfig.TargetArn, v, v);
      });
    });

    it('does not append DeadLetterConfig when params are not set', function() {
      delete program.deadLetterConfigTargetArn;
      var params = lambda._params(program);
      assert.isNull(params.DeadLetterConfig.TargetArn);
    });

    describe('configFile', function () {
      beforeEach(function () {
        // Prep...
        fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n');
        fs.writeFileSync('empty.env', '');
      });

      afterEach(function () {
        fs.unlinkSync('tmp.env');
        fs.unlinkSync('empty.env');
      });

      it('adds variables when configFile param is set', function () {
        program.configFile = 'tmp.env';
        var params = lambda._params(program);
        assert.equal(params.Environment.Variables['FOO'], "bar");
        assert.equal(params.Environment.Variables['BAZ'], "bing");
      });

      it('when configFile param is set but it is an empty file', function () {
        program.configFile = 'empty.env';
        var params = lambda._params(program);
        assert.equal(Object.keys(params.Environment.Variables).length, 0);
      });

      it('does not add when configFile param is not set', function () {
        var params = lambda._params(program);
        assert.isNull(params.Environment.Variables);
      });
    });
  });

  describe('_zipfileTmpPath', function () {
    it('has the correct path', function () {
      var zipfileTmpPath = lambda._zipfileTmpPath(program);
      var value = zipfileTmpPath.indexOf(program.functionName) > 0;
      assert.equal(value, true);
    });
  });

  describe('_rsync', function () {
    beforeEach(function (done) {
      lambda._cleanDirectory(codeDirectory, done);
    });

    it('rsync an index.js as well as other files', function (done) {
      lambda._rsync(program, '.', codeDirectory, true, function (err, result) {
        var contents = fs.readdirSync(codeDirectory);

        result = _.includes(contents, 'index.js') &&
                 _.includes(contents, 'package.json') &&
                 !_.includes(contents, 'node_modules');
        assert.equal(result, true);

        done();
      });
    });

    describe("when there are excluded files", function () {
      beforeEach(function (done) {
        program.excludeGlobs="*.png test";
        done();
      });

      it('rsync an index.js as well as other files', function (done) {
        lambda._rsync(program, '.', codeDirectory, true, function (err, result) {
          var contents = fs.readdirSync(codeDirectory);

          result = _.includes(contents, 'index.js') &&
                   _.includes(contents, 'package.json');
          assert.equal(result, true);

          done();
        });
      });

      it('rsync excludes files matching excludeGlobs', function (done) {
        lambda._rsync(program, '.', codeDirectory, true, function (err, result) {
          var contents = fs.readdirSync(codeDirectory);

          result = _.includes(contents, 'node-lambda.png') &&
                   _.includes(contents, 'test');
          assert.equal(result, false);

          done();
        });
      });

      it('rsync should not exclude package.json, even when excluded by excludeGlobs', function (done) {
        program.excludeGlobs="*.json"
        lambda._rsync(program, '.', codeDirectory, true, function(err, result) {
          var contents = fs.readdirSync(codeDirectory);
          result = _.includes(contents, 'package.json');
          assert.equal(result, true);

          done();
        });
      });

      it('rsync should not include package.json when --prebuiltDirectory is set', function (done) {
        var path = '.build_' + Date.now();
        after(function() {
          rimraf.sync(path, fs);
        });

        fs.mkdirSync(path);
        fs.writeFileSync(path + '/testa');
        fs.writeFileSync(path + '/package.json');

        program.excludeGlobs = "*.json"
        program.prebuiltDirectory = path;
        lambda._rsync(program, path, codeDirectory, true, function(err, result) {
          var contents = fs.readdirSync(codeDirectory);
          result = !_.includes(contents, 'package.json') &&
                    _.includes(contents, 'testa');
          assert.equal(result, true);

          done();
        });
      });
    });
  });

  describe('_npmInstall', function () {
    beforeEach(function (done) {
      lambda._cleanDirectory(codeDirectory, function (err) {
        if (err) {
          return done(err);
        }

        lambda._rsync(program, '.', codeDirectory, true, function (err) {
          if (err) {
            return done(err);
          }
          done();
        });
      });
    });

    it('_npm adds node_modules', function (done) {
      this.timeout(60000); // give it time to build the node modules

      lambda._npmInstall(program, codeDirectory, function (err, result) {
        var contents = fs.readdirSync(codeDirectory);

        result = _.includes(contents, 'node_modules');
        assert.equal(result, true);

        done();
      });
    });
  });

  describe('_postInstallScript', function () {
    var hook;
    /**
     * Capture console output
     */
    function captureStream(stream){
      var oldWrite = stream.write;
      var buf = '';
      stream.write = function(chunk, encoding, callback){
        buf += chunk.toString(); // chunk is a String or Buffer
        oldWrite.apply(stream, arguments);
      }

      return {
        unhook: function unhook(){
         stream.write = oldWrite;
        },
        captured: function(){
          return buf;
        }
      };
    }
    beforeEach(function(){
      hook = captureStream(process.stdout);
    });
    afterEach(function(){
      hook.unhook();
    });


    it('should not throw any errors if no script', function (done) {
      lambda._postInstallScript(program, codeDirectory, function (err) {
        assert.equal(err, null);
        done();
      });
    });

    it('running script gives expected output', function (done) {
      fs.writeFileSync(codeDirectory + '/post_install.sh', fs.readFileSync('test/post_install.sh'));
      fs.chmodSync(codeDirectory + '/post_install.sh', '755');
      lambda._postInstallScript(program, codeDirectory, function (err) {
        assert.equal(err, null);
        assert.equal("=> Running post install script post_install.sh\n\t\tYour environment is "+program.environment+"\n", hook.captured());
        fs.unlinkSync(codeDirectory + '/post_install.sh');
        done();
      });
    });
  });

  describe('_zip', function () {
    beforeEach(function (done) {
      this.timeout(30000); // give it time to build the node modules
      lambda._cleanDirectory(codeDirectory, function (err) {
        if (err) {
          return done(err);
        }

        lambda._rsync(program, '.', codeDirectory, true, function (err) {
          if (err) {
            return done(err);
          }
          lambda._npmInstall(program, codeDirectory, function (err) {
            if (err) {
              return done(err);
            }
            done();
          });
        });
      });
    });

    it('zips the file and has an index.js file', function (done) {
      this.timeout(30000); // give it time to zip

      lambda._zip(program, codeDirectory, function (err, data) {
        var archive = new zip(data);
        var contents = _.map(archive.files, function (f) {
          return f.name.toString();
        });
        var result = _.includes(contents, 'index.js');
        assert.equal(result, true);

        done();
      });
    });
  });

  describe('_archive', function () {
    it('installs and zips with an index.js file and node_modules/async', function (done) {
      this.timeout(30000); // give it time to zip

      lambda._archive(program, function (err, data) {
        var archive = new zip(data);
        var contents = _.map(archive.files, function (f) {
          return f.name.toString();
        });
        var result = _.includes(contents, 'index.js');
        assert.equal(result, true);
        result = _.includes(contents, 'node_modules/async/lib/async.js');
        assert.equal(result, true);
        done();
      });
    });

    it('packages a prebuilt module without installing', function (done) {
      var path = '.build_' + Date.now();
      after(function() {
        rimraf.sync(path, fs);
      });

      fs.mkdirSync(path);
      fs.mkdirSync(path + '/d');
      fs.mkdirSync(path + '/node_modules');
      fs.writeFileSync(path + '/node_modules/a', '...');
      fs.writeFileSync(path + '/testa', '...');
      fs.writeFileSync(path + '/d/testb', '...');

      program.prebuiltDirectory = path;
      lambda._archive(program, function (err, data) {
        var archive = new zip(data);
        var contents = _.map(archive.files, function (f) {
          return f.name.toString();
        });
        var result = _.includes(contents, 'testa') &&
                     _.includes(contents, 'd/testb') &&
                     _.includes(contents, 'node_modules/a');
        assert.equal(result, true);
        done();
      });
    });
  });

  describe('_readArchive', function () {
    const testZipFile = '/tmp/node-lambda-test.zip';
    var bufferExpected = null;
    before(function(done) {
      this.timeout(30000); // give it time to zip

      lambda._zip(program, codeDirectory, function (err, data) {
        bufferExpected = data;
        fs.writeFileSync(testZipFile, data);
        done();
      });
    });

    after(function() {
      fs.unlinkSync(testZipFile);
    });

    it('_readArchive fails (undefined)', function (done) {
      lambda._readArchive(program, function (err, data) {
        assert.isUndefined(data);
        assert.instanceOf(err, Error);
        assert.equal(err.message, 'No such Zipfile [undefined]');
        done();
      });
    });

    it('_readArchive fails (does not exists file)', function (done) {
      const _program = Object.assign({ deployZipfile: '/aaaa/bbbb' }, program);
      lambda._readArchive(_program, function (err, data) {
        assert.isUndefined(data);
        assert.instanceOf(err, Error);
        assert.equal(err.message, 'No such Zipfile [/aaaa/bbbb]');
        done();
      });
    });

    it('_readArchive reads the contents of the zipfile', function (done) {
      const _program = Object.assign({ deployZipfile: testZipFile }, program);
      lambda._readArchive(_program, function (err, data) {
        assert.isNull(err);
        assert.deepEqual(data, bufferExpected);
        done();
      });
    });

    describe('If value is set in `deployZipfile`, _readArchive is executed in _archive', function () {
      it('`deployZipfile` is a invalid value. Process from creation of zip file', function (done) {
        const _program = Object.assign({ deployZipfile: '/aaaa/bbbb' }, program);
        this.timeout(30000); // give it time to zip
        lambda._archive(_program, function (err, data) {
          // same test as "installs and zips with an index.js file and node_modules/async"
          var archive = new zip(data);
          var contents = _.map(archive.files, function (f) {
            return f.name.toString();
          });
          var result = _.includes(contents, 'index.js');
          assert.equal(result, true);
          result = _.includes(contents, 'node_modules/async/lib/async.js');
          assert.equal(result, true);
          done();
        });
      });

      it('`deployZipfile` is a valid value._archive reads the contents of the zipfile', function (done) {
        const _program = Object.assign({ deployZipfile: testZipFile }, program);
        lambda._archive(_program, function (err, data) {
          assert.isNull(err);
          assert.deepEqual(data, bufferExpected);
          done();
        });
      });
    });
  });

  describe('environment variable injection at runtime', function () {
    beforeEach(function () {
      // Prep...
      fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n');
    });

    afterEach(function () {
      fs.unlinkSync('tmp.env');
    });

    it('should inject environment variables at runtime', function () {

      // Run it...
      lambda._setRunTimeEnvironmentVars({
        configFile: 'tmp.env'
      }, process.cwd());

      assert.equal(process.env["FOO"], 'bar');
      assert.equal(process.env["BAZ"], 'bing');
    });

  });

  describe('create sample files', function () {
    const targetFiles = [
      '.env',
      'context.json',
      'event.json',
      'deploy.env',
      'event_sources.json'
    ];

    after(function () {
      targetFiles.forEach(function(file) {
        fs.unlinkSync(file);
      });
      program.eventSourceFile = '';
    });

    it('should create sample files', function () {
      lambda.setup(program);

      const libPath = `${__dirname}/../lib`;
      targetFiles.forEach(function(targetFile) {
        const boilerplateFile = `${libPath}/${targetFile}.example`;

        assert.equal(
          fs.readFileSync(targetFile).toString(),
          fs.readFileSync(boilerplateFile).toString(),
          targetFile
        );
      });
    });

    describe('_eventSourceList', function () {
      it('program.eventSourceFile is empty value', function () {
        program.eventSourceFile = '';
        assert.deepEqual(
          lambda._eventSourceList(program),
          { EventSourceMappings: [], ScheduleEvents: [] }
        );
      });

      it('program.eventSourceFile is invalid value', function () {
        program.eventSourceFile = '/hoge/fuga';
        assert.throws(
          () => { lambda._eventSourceList(program); },
          Error,
          "ENOENT: no such file or directory, open '/hoge/fuga'"
        );
      });

      describe('program.eventSourceFile is valid value', function() {
        before(function () {
          fs.writeFileSync('only_EventSourceMappings.json', JSON.stringify({
            EventSourceMappings: [{ test: 1 }]
          }));
          fs.writeFileSync('only_ScheduleEvents.json', JSON.stringify({
            ScheduleEvents: [{ test: 2 }]
          }));
        });

        after(function () {
          fs.unlinkSync('only_EventSourceMappings.json');
          fs.unlinkSync('only_ScheduleEvents.json');
        });

        it('only EventSourceMappings', function () {
          program.eventSourceFile = 'only_EventSourceMappings.json';
          const expected = {
            EventSourceMappings: [{ test: 1 }],
            ScheduleEvents: [],
          };
          assert.deepEqual(lambda._eventSourceList(program), expected);
        });

        it('only ScheduleEvents', function () {
          program.eventSourceFile = 'only_ScheduleEvents.json';
          const expected = {
            EventSourceMappings: [],
            ScheduleEvents: [{ test: 2 }],
          };
          assert.deepEqual(lambda._eventSourceList(program), expected);
        });

        it('EventSourceMappings & ScheduleEvents', function () {
          program.eventSourceFile = 'event_sources.json';
          const expected = {
            EventSourceMappings: [{
              BatchSize: 100,
              Enabled: true,
              EventSourceArn: 'your event source arn',
              StartingPosition: 'LATEST',
            }],
            ScheduleEvents: [{
              ScheduleName: 'node-lambda-test-schedule',
              ScheduleState: 'ENABLED',
              ScheduleExpression: 'rate(1 hour)',
            }],
          };
          assert.deepEqual(lambda._eventSourceList(program), expected);
        });
      });

      describe('old style event_sources.json', function () {
        const oldStyleValue = [{
          BatchSize: 100,
          Enabled: true,
          EventSourceArn: 'your event source arn',
          StartingPosition: 'LATEST',
        }];
        const fileName = 'event_sources_old_style.json';

        before(function () {
          fs.writeFileSync(fileName, JSON.stringify(oldStyleValue));
        });

        after(function () {
          fs.unlinkSync(fileName);
        });

        it('program.eventSourceFile is valid value', function () {
          program.eventSourceFile = fileName;
          const expected = {
            EventSourceMappings: oldStyleValue,
            ScheduleEvents: []
          };
          assert.deepEqual(lambda._eventSourceList(program), expected);
        });
      });
    });
  });

  describe('_updateScheduleEvents', function () {
    const aws = require('aws-sdk-mock');
    const ScheduleEvents = require('../lib/schedule_events');
    const eventSourcesJsonValue = {
      ScheduleEvents: [{
        ScheduleName: 'node-lambda-test-schedule',
        ScheduleState: 'ENABLED',
        ScheduleExpression: 'rate(1 hour)',
      }]
    };

    var schedule = null;

    before(function () {
      aws.mock('CloudWatchEvents', 'putRule', function (params, callback) {
        callback(null, {});
      });
      aws.mock('CloudWatchEvents', 'putTargets', function (params, callback) {
        callback(null, {});
      });
      aws.mock('Lambda', 'addPermission', function (params, callback) {
        callback(null, {});
      });

      fs.writeFileSync(
        'event_sources.json',
        JSON.stringify(eventSourcesJsonValue)
      );

      schedule = new ScheduleEvents(require('aws-sdk'));
    });

    after(function () {
      fs.unlinkSync('event_sources.json');
      aws.restore('CloudWatchEvents');
      aws.restore('Lambda');
    });

    it('simple test with mock', function () {
      program.eventSourceFile = 'event_sources.json';
      const eventSourceList = lambda._eventSourceList(program);
      const functionArn = 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function';
      return new Promise(function (resolve) {
        lambda._updateScheduleEvents(schedule, functionArn, eventSourceList.ScheduleEvents, function(err, results) {
          resolve({ err: err, results: results });
        });
      }).then(function (actual) {
        const expected = {
          err: undefined,
          results: [Object.assign(
            eventSourcesJsonValue.ScheduleEvents[0],
            { FunctionArn: functionArn }
          )]
        };
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('check env vars before create sample files', function () {
    const filesCreatedBySetup = [
      '.env',
      'deploy.env',
      'event_sources.json'
    ];

    beforeEach(function () {
      fs.writeFileSync('newContext.json', '{"FOO"="bar"\n"BAZ"="bing"\n}');
      fs.writeFileSync('newEvent.json', '{"FOO"="bar"}');
    });

    afterEach(function () {
      fs.unlinkSync('newContext.json');
      fs.unlinkSync('newEvent.json');
      filesCreatedBySetup.forEach(function(file) {
        fs.unlinkSync(file);
      });
    });

    it('should use existing sample files', function () {
      program.eventFile = 'newEvent.json';
      program.contextFile = 'newContext.json';

      lambda.setup(program);

      assert.equal(fs.readFileSync('newContext.json').toString(), '{"FOO"="bar"\n"BAZ"="bing"\n}');
      assert.equal(fs.readFileSync('newEvent.json').toString(), '{"FOO"="bar"}');

      const libPath = `${__dirname}/../lib`;
      filesCreatedBySetup.forEach(function(targetFile) {
        const boilerplateFile = `${libPath}/${targetFile}.example`;

        assert.equal(
          fs.readFileSync(targetFile).toString(),
          fs.readFileSync(boilerplateFile).toString(),
          targetFile
        );
      });
    });
  });
});
