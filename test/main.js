'use strict';

var path = require('path');
var os = require('os');
var chai = require('chai');
var program = require('commander');
var fs = require('fs-extra');
var Hoek = require('hoek');
var lambda = require(path.join(__dirname, '..', 'lib', 'main'));
var zip = require('node-zip');
var rimraf = require('rimraf');

var assert = chai.assert;

var originalProgram = {
  environment: 'development',
  accessKey: 'key',
  secretKey: 'secret',
  sessionToken: 'token',
  functionName: '___node-lambda',
  handler: 'index.handler',
  role: 'some:arn:aws:iam::role',
  memorySize: 128,
  timeout: 3,
  description: '',
  runtime: 'nodejs6.10',
  deadLetterConfigTargetArn: '',
  tracingConfig: '',
  region: 'us-east-1,us-west-2,eu-west-1',
  eventFile: 'event.json',
  eventSourceFile: '',
  contextFile: 'context.json',
  deployTimeout: 120000,
  prebuiltDirectory: '',
};

var codeDirectory = lambda._codeDirectory();

function _timeout(params) {
  // Even if timeout is set for the whole test for Windows,
  // if it is set in local it will be valid.
  // For Windows, do not set it with local.
  if (process.platform !== 'win32') {
    params.this.timeout(params.sec * 1000);
  }
}

describe('lib/main', function () {
  if (process.platform === 'win32') {
    // It seems that it takes time for file operation in Windows.
    // So set `timeout(60000)` for the whole test.
    this.timeout(60000);
  }

  beforeEach(function () {
    program = Hoek.clone(originalProgram);
  });

  it('version should be set', function () {
    assert.equal(lambda.version, '0.10.0');
  });

  describe('_codeDirectory', function () {
    it('.lambda in the current directory', function () {
      assert.equal(lambda._codeDirectory(), path.resolve('.', '.lambda'));
    });
  });

  describe('_params', function () {
    // http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-FunctionName
    const functionNamePattern =
      /(arn:aws:lambda:)?([a-z]{2}-[a-z]+-\d{1}:)?(\d{12}:)?(function:)?([a-zA-Z0-9-_]+)(:(\$LATEST|[a-zA-Z0-9-_]+))?/;
    it('appends environment to original functionName', function () {
      var params = lambda._params(program);
      assert.equal(params.FunctionName, '___node-lambda-development');
      assert.match(params.FunctionName, functionNamePattern);
    });

    it('appends environment to original functionName (production)', function () {
      program.environment = 'production';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, '___node-lambda-production');
      assert.match(params.FunctionName, functionNamePattern);
    });

    it('appends version to original functionName', function () {
      program.lambdaVersion = '2015-02-01';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, '___node-lambda-development-2015-02-01');
      assert.match(params.FunctionName, functionNamePattern);
    });

    it('appends version to original functionName (value not allowed by AWS)', function () {
      program.lambdaVersion = '2015.02.01';
      var params = lambda._params(program);
      assert.equal(params.FunctionName, '___node-lambda-development-2015_02_01');
      assert.match(params.FunctionName, functionNamePattern);
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

    it('appends TracingConfig to params when params set', function() {
      program.tracingConfig = 'Active';
      const params = lambda._params(program);
      assert.equal(params.TracingConfig.Mode, 'Active');
    });

    it('does not append TracingConfig when params are not set', function() {
      program.tracingConfig = '';
      const params = lambda._params(program);
      assert.isNull(params.TracingConfig.Mode);
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

  describe('_cleanDirectory', function () {
    it('`codeDirectory` is empty', function (done) {
      lambda._cleanDirectory(codeDirectory, function () {
        assert.isTrue(fs.existsSync(codeDirectory));
        const contents = fs.readdirSync(codeDirectory);
        assert.equal(contents.length, 0);
        done();
      });
    });

    it('`codeDirectory` is empty. (For `codeDirectory` where the file was present)', function (done) {
      lambda._fileCopy(program, '.', codeDirectory, true, function (err, result) {
        const contents = fs.readdirSync(codeDirectory);
        assert.isTrue(contents.length > 0);
        lambda._cleanDirectory(codeDirectory, function () {
          assert.isTrue(fs.existsSync(codeDirectory));
          const contents = fs.readdirSync(codeDirectory);
          assert.equal(contents.length, 0);
          done();
        });
      });
    });
  });

  function rsyncTests(funcName) {
    before(function () {
      fs.mkdirSync('build');
      fs.mkdirsSync(path.join('__unittest', 'hoge'));
      fs.mkdirsSync(path.join('__unittest', 'fuga'));
      fs.writeFileSync(path.join('__unittest', 'hoge', 'piyo'));
      fs.writeFileSync(path.join('__unittest', 'hoge', 'package.json'));
      fs.writeFileSync('fuga');
    });
    after(function () {
      ['build', 'fuga', '__unittest'].forEach(function (path) {
        fs.removeSync(path);
      });
    });

    beforeEach(function (done) {
      lambda._cleanDirectory(codeDirectory, done);
    });

    it(funcName + ' an index.js as well as other files', function (done) {
      lambda[funcName](program, '.', codeDirectory, true, function (err, result) {
        var contents = fs.readdirSync(codeDirectory);
        ['index.js', 'package.json'].forEach(function (needle) {
          assert.include(contents, needle, `Target: "${needle}"`);
        });
        ['node_modules', 'build'].forEach(function (needle) {
          assert.notInclude(contents, needle, `Target: "${needle}"`);
        });
        done();
      });
    });

    describe('when there are excluded files', function () {
      beforeEach(function (done) {
        // *main* => lib/main.js
        // In case of specifying files under the directory with wildcards
        program.excludeGlobs = [
          '*.png',
          'test',
          '*main*',
          path.join('__unittest', 'hoge', '*'),
          path.join('fuga', path.sep)
        ].join(' ');
        done();
      });

      it(funcName + ' an index.js as well as other files', function (done) {
        lambda[funcName](program, '.', codeDirectory, true, function (err, result) {
          var contents = fs.readdirSync(codeDirectory);
          ['index.js', 'package.json'].forEach(function (needle) {
            assert.include(contents, needle, `Target: "${needle}"`);
          });
          done();
        });
      });

      it(funcName + ' excludes files matching excludeGlobs', function (done) {
        lambda[funcName](program, '.', codeDirectory, true, function (err, result) {
          var contents = fs.readdirSync(codeDirectory);
          ['__unittest', 'fuga'].forEach(function (needle) {
            assert.include(contents, needle, `Target: "${needle}"`);
          });

          ['node-lambda.png', 'test'].forEach(function (needle) {
            assert.notInclude(contents, needle, `Target: "${needle}"`);
          });

          contents = fs.readdirSync(path.join(codeDirectory, 'lib'));
          assert.notInclude(contents, 'main.js', 'Target: "lib/main.js"');

          contents = fs.readdirSync(path.join(codeDirectory, '__unittest'));
          assert.include(contents, 'hoge', 'Target: "__unittest/hoge"');
          assert.notInclude(contents, 'fuga', 'Target: "__unittest/fuga"');

          contents = fs.readdirSync(path.join(codeDirectory, '__unittest', 'hoge'));
          assert.equal(contents.length, 0, 'directory:__unittest/hoge is empty');
          done();
        });
      });

      it(funcName + ' should not exclude package.json, even when excluded by excludeGlobs', function (done) {
        program.excludeGlobs = '*.json';
        lambda[funcName](program, '.', codeDirectory, true, function(err, result) {
          var contents = fs.readdirSync(codeDirectory);
          assert.include(contents, 'package.json');
          done();
        });
      });

      it(funcName + ' should not include package.json when --prebuiltDirectory is set', function (done) {
        var buildDir = '.build_' + Date.now();
        after(function() {
          rimraf.sync(buildDir, fs);
        });

        fs.mkdirSync(buildDir);
        fs.writeFileSync(path.join(buildDir, 'testa'));
        fs.writeFileSync(path.join(buildDir, 'package.json'));

        program.excludeGlobs = '*.json';
        program.prebuiltDirectory = buildDir;
        lambda[funcName](program, buildDir, codeDirectory, true, function(err, result) {
          var contents = fs.readdirSync(codeDirectory);
          assert.notInclude(contents, 'package.json', 'Target: "packages.json"');
          assert.include(contents, 'testa', 'Target: "testa"');
          done();
        });
      });
    });
  }

  describe('_fileCopy', function() { rsyncTests('_fileCopy'); });
  if (process.platform === 'win32') {
    it('For Windows, `_rsync` tests pending');
  } else {
    describe('_rsync', function() { rsyncTests('_rsync'); });
  }

  describe('_npmInstall', function () {
    beforeEach(function (done) {
      lambda._cleanDirectory(codeDirectory, function (err) {
        if (err) {
          return done(err);
        }

        lambda._fileCopy(program, '.', codeDirectory, true, function (err) {
          if (err) {
            return done(err);
          }
          done();
        });
      });
    });

    it('_npm adds node_modules', function (done) {
      _timeout({ this: this, sec: 30 }); // give it time to build the node modules

      lambda._npmInstall(program, codeDirectory, function (err, result) {
        var contents = fs.readdirSync(codeDirectory);
        assert.include(contents, 'node_modules');
        done();
      });
    });
  });

  describe('_postInstallScript', function () {
    if (process.platform === 'win32') {
      return it('`_postInstallScript` test does not support Windows.');
    }

    const postInstallScriptPath = path.join(codeDirectory, 'post_install.sh');
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
      if (fs.existsSync(postInstallScriptPath))
        fs.unlinkSync(postInstallScriptPath);
    });

    it('should not throw any errors if no script', function (done) {
      lambda._postInstallScript(program, codeDirectory, function (err) {
        assert.isNull(err);
        done();
      });
    });

    it('should throw any errors if script fails', function (done) {
      fs.writeFileSync(postInstallScriptPath, '___fails___');
      lambda._postInstallScript(program, codeDirectory, function (err) {
        assert.match(err, /^Error: Command failed:/);
        done();
      });
    });

    it('running script gives expected output', function (done) {
      fs.writeFileSync(postInstallScriptPath, fs.readFileSync(path.join('test', 'post_install.sh')));
      fs.chmodSync(path.join(codeDirectory, 'post_install.sh'), '755');
      lambda._postInstallScript(program, codeDirectory, function (err) {
        assert.isNull(err);
        assert.equal("=> Running post install script post_install.sh\n\t\tYour environment is "+program.environment+"\n", hook.captured());
        done();
      });
    });
  });

  describe('_zip', function () {
    beforeEach(function (done) {
      _timeout({ this: this, sec: 30 }); // give it time to build the node modules
      lambda._cleanDirectory(codeDirectory, function (err) {
        if (err) {
          return done(err);
        }

        lambda._fileCopy(program, '.', codeDirectory, true, function (err) {
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
      _timeout({ this: this, sec: 30 }); // give it time to zip

      lambda._zip(program, codeDirectory, function (err, data) {
        var archive = new zip(data);
        var contents = Object.keys(archive.files).map(function (k) {
          return archive.files[k].name.toString();
        });
        assert.include(contents, 'index.js');
        done();
      });
    });
  });

  describe('_archive', function () {
    it('installs and zips with an index.js file and node_modules/async', function (done) {
      _timeout({ this: this, sec: 30 }); // give it time to zip

      lambda._archive(program, function (err, data) {
        var archive = new zip(data);
        var contents = Object.keys(archive.files).map(function (k) {
          return archive.files[k].name.toString();
        });
        assert.include(contents, 'index.js');
        assert.include(contents, path.join('node_modules', 'async', 'lib', 'async.js'));
        done();
      });
    });

    it('packages a prebuilt module without installing', function (done) {
      _timeout({ this: this, sec: 30 }); // give it time to zip
      var buildDir = '.build_' + Date.now();
      after(function() {
        rimraf.sync(buildDir, fs);
      });

      fs.mkdirSync(buildDir);
      fs.mkdirSync(path.join(buildDir, 'd'));
      fs.mkdirSync(path.join(buildDir, 'node_modules'));
      fs.writeFileSync(path.join(buildDir, 'node_modules', 'a'), '...');
      fs.writeFileSync(path.join(buildDir, 'testa'), '...');
      fs.writeFileSync(path.join(buildDir, 'd', 'testb'), '...');

      program.prebuiltDirectory = buildDir;
      lambda._archive(program, function (err, data) {
        var archive = new zip(data);
        var contents = Object.keys(archive.files).map(function (k) {
          return archive.files[k].name.toString();
        });
        [
          'testa',
          path.join('d', 'testb'),
          path.join('node_modules', 'a')
        ].forEach(function (needle) {
          assert.include(contents, needle, `Target: "${needle}"`);
        });
        done();
      });
    });
  });

  describe('_readArchive', function () {
    const testZipFile = path.join(os.tmpdir(), 'node-lambda-test.zip');
    var bufferExpected = null;
    before(function(done) {
      _timeout({ this: this, sec: 30 }); // give it time to zip

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
      const filePath = path.join(path.resolve('/aaaa'), 'bbbb');
      const _program = Object.assign({ deployZipfile: filePath }, program);
      lambda._readArchive(_program, function (err, data) {
        assert.isUndefined(data);
        assert.instanceOf(err, Error);
        assert.equal(err.message, `No such Zipfile [${filePath}]`);
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
        const filePath = path.join(path.resolve('/aaaa'), 'bbbb');
        const _program = Object.assign({ deployZipfile: filePath }, program);
        _timeout({ this: this, sec: 30 }); // give it time to zip
        lambda._archive(_program, function (err, data) {
          // same test as "installs and zips with an index.js file and node_modules/async"
          var archive = new zip(data);
          var contents = Object.keys(archive.files).map(function (k) {
            return archive.files[k].name.toString();
          });
          assert.include(contents, 'index.js');
          assert.include(contents, path.join('node_modules', 'async', 'lib', 'async.js'));
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

      assert.equal(process.env.FOO, 'bar');
      assert.equal(process.env.BAZ, 'bing');
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

      const libPath = path.join(__dirname, '..', 'lib');
      targetFiles.forEach(function(targetFile) {
        const boilerplateFile = path.join(libPath, `${targetFile}.example`);

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
          { EventSourceMappings: null, ScheduleEvents: null }
        );
      });

      it('program.eventSourceFile is invalid value', function () {
        const dirPath = path.join(path.resolve('/hoge'), 'fuga');
        program.eventSourceFile = dirPath;
        assert.throws(
          () => { lambda._eventSourceList(program); },
          Error,
          `ENOENT: no such file or directory, open '${dirPath}'`
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
              ScheduleExpression: 'rate(1 hour)'
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

  describe('_updateEventSources', function () {
    it('program.eventSourceFile is empty value', function () {
      program.eventSourceFile = '';
      const eventSourceList = lambda._eventSourceList(program);
      return new Promise(function (resolve) {
        lambda._updateEventSources(lambda, '', [], eventSourceList.EventSourceMappings, function(err, results) {
          resolve({ err: err, results: results });
        });
      }).then(function (actual) {
        const expected = { err: null, results: [] };
        assert.deepEqual(actual, expected);
      });
    });
  });

  describe('_updateScheduleEvents', function () {
    const aws = require('aws-sdk-mock');
    const ScheduleEvents = require(path.join('..', 'lib', 'schedule_events'));
    const eventSourcesJsonValue = {
      ScheduleEvents: [{
        ScheduleName: 'node-lambda-test-schedule',
        ScheduleState: 'ENABLED',
        ScheduleExpression: 'rate(1 hour)',
        ScheduleDescription: 'Run node-lambda-test-function once per hour'
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

    it('program.eventSourceFile is empty value', function () {
      program.eventSourceFile = '';
      const eventSourceList = lambda._eventSourceList(program);
      return new Promise(function (resolve) {
        lambda._updateScheduleEvents(schedule, '', eventSourceList.ScheduleEvents, function(err, results) {
          resolve({ err: err, results: results });
        });
      }).then(function (actual) {
        const expected = { err: null, results: [] };
        assert.deepEqual(actual, expected);
      });
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

      const libPath = path.join(__dirname, '..', 'lib');
      filesCreatedBySetup.forEach(function(targetFile) {
        const boilerplateFile = path.join(libPath, `${targetFile}.example`);

        assert.equal(
          fs.readFileSync(targetFile).toString(),
          fs.readFileSync(boilerplateFile).toString(),
          targetFile
        );
      });
    });
  });
});
