var chai = require('chai');
var program = require('commander');
var fs = require('fs');
var Hoek = require('hoek');
var lambda = require('../lib/main');
var fs = require('fs');
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
  contextFile: 'context.json',
  prebuiltDirectory: '',
};

var codeDirectory = lambda._codeDirectory(program);

describe('node-lambda', function () {
  beforeEach(function () {
    program = Hoek.clone(originalProgram);
  });

  it('version should be set', function () {
    assert.equal(lambda.version, '0.8.15');
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

    describe('configFile', function () {
      beforeEach(function () {
        // Prep...
        fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n');
      });

      afterEach(function () {
        fs.unlinkSync('tmp.env');
      });

      it('adds variables when configFile param is set', function () {
        program.configFile = 'tmp.env';
        var params = lambda._params(program);
        assert.equal(params.Environment.Variables['FOO'], "bar");
        assert.equal(params.Environment.Variables['BAZ'], "bing");
      });

      it('does not add when configFile param is not set', function () {
        var params = lambda._params(program);
        assert.equal(Object.keys(params.Environment.Variables).length, 0);
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

    afterEach(function () {
      fs.unlinkSync('.env');
      fs.unlinkSync('context.json');
      fs.unlinkSync('event.json');
      fs.unlinkSync('deploy.env');
    });

    it('should create sample files', function () {
      lambda.setup(program);

      var envBoilerplateFile = __dirname + '/../lib/.env.example';
      var contextBoilerplateFile = __dirname + '/../lib/context.json.example';
      var eventBoilerplateFile = __dirname + '/../lib/event.json.example';
      var deployBoilerplateFile = __dirname + '/../lib/deploy.env.example';

      assert.equal(fs.readFileSync('.env').toString(), fs.readFileSync(envBoilerplateFile).toString());
      assert.equal(fs.readFileSync('context.json').toString(), fs.readFileSync(contextBoilerplateFile).toString());
      assert.equal(fs.readFileSync('event.json').toString(), fs.readFileSync(eventBoilerplateFile).toString());
      assert.equal(fs.readFileSync('deploy.env').toString(), fs.readFileSync(deployBoilerplateFile).toString());
    });
  });

  describe('check env vars before create sample files', function () {

    beforeEach(function () {
      fs.writeFileSync('newContext.json', '{"FOO"="bar"\n"BAZ"="bing"\n}');
      fs.writeFileSync('newEvent.json', '{"FOO"="bar"}');
    });

    afterEach(function () {
      fs.unlinkSync('.env');
      fs.unlinkSync('newContext.json');
      fs.unlinkSync('newEvent.json');
      fs.unlinkSync('deploy.env');
    });

    it('should use existing sample files', function () {
      program.eventFile = 'newEvent.json';
      program.contextFile = 'newContext.json';

      lambda.setup(program);

      var envBoilerplateFile = __dirname + '/../lib/.env.example';
      var deployBoilerplateFile = __dirname + '/../lib/deploy.env.example';

      assert.equal(fs.readFileSync('.env').toString(), fs.readFileSync(envBoilerplateFile).toString());
      assert.equal(fs.readFileSync('newContext.json').toString(), '{"FOO"="bar"\n"BAZ"="bing"\n}');
      assert.equal(fs.readFileSync('newEvent.json').toString(), '{"FOO"="bar"}');
      assert.equal(fs.readFileSync('deploy.env').toString(), fs.readFileSync(deployBoilerplateFile).toString());
    });

  });
});
