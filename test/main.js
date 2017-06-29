'use strict'

const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const lambda = require(path.join(__dirname, '..', 'lib', 'main'))
const Zip = require('node-zip')
const assert = require('chai').assert
const awsMock = require('aws-sdk-mock')
awsMock.setSDK(path.resolve('node_modules/aws-sdk'))

const originalProgram = {
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
  proxy: ''
}

var program = require('commander')
var codeDirectory = lambda._codeDirectory()

const _timeout = function (params) {
  // Even if timeout is set for the whole test for Windows,
  // if it is set in local it will be valid.
  // For Windows, do not set it with local.
  if (process.platform !== 'win32') {
    params.this.timeout(params.sec * 1000)
  }
}

// It does not completely reproduce the response of the actual API.
const lambdaMockSettings = {
  addPermission: {},
  getFunction: {
    Code: {},
    Configuration: {},
    FunctionArn: 'Lambda.getFunction.mock.FunctionArn'
  },
  createFunction: {
    FunctionArn: 'Lambda.createFunction.mock.FunctionArn',
    FunctionName: 'Lambda.createFunction.mock.FunctionName'
  },
  listEventSourceMappings: {
    EventSourceMappings: [{
      EventSourceArn: 'Lambda.listEventSourceMappings.mock.EventSourceArn',
      UUID: 'Lambda.listEventSourceMappings.mock.UUID'
    }]
  },
  updateFunctionCode: {
    FunctionArn: 'Lambda.updateFunctionCode.mock.FunctionArn',
    FunctionName: 'Lambda.updateFunctionCode.mock.FunctionName'
  },
  updateFunctionConfiguration: {
    FunctionArn: 'Lambda.updateFunctionConfiguration.mock.FunctionArn',
    FunctionName: 'Lambda.updateFunctionConfiguration.mock.FunctionName'
  },
  createEventSourceMapping: {
    EventSourceArn: 'Lambda.createEventSourceMapping.mock.EventSourceArn',
    FunctionName: 'Lambda.createEventSourceMapping.mock.EventSourceArn'
  },
  updateEventSourceMapping: {
    EventSourceArn: 'Lambda.updateEventSourceMapping.mock.EventSourceArn',
    FunctionName: 'Lambda.updateEventSourceMapping.mock.EventSourceArn'
  },
  deleteEventSourceMapping: {
    EventSourceArn: 'Lambda.deleteEventSourceMapping.mock.EventSourceArn',
    FunctionName: 'Lambda.deleteEventSourceMapping.mock.EventSourceArn'
  }
}
const _mockSetting = () => {
  awsMock.mock('CloudWatchEvents', 'putRule', (params, callback) => {
    callback(null, {})
  })
  awsMock.mock('CloudWatchEvents', 'putTargets', (params, callback) => {
    callback(null, {})
  })

  Object.keys(lambdaMockSettings).forEach((method) => {
    awsMock.mock('Lambda', method, (params, callback) => {
      callback(null, lambdaMockSettings[method])
    })
  })

  return require('aws-sdk')
}

const _awsRestore = () => {
  awsMock.restore('CloudWatchEvents')
  awsMock.restore('Lambda')
}

/* global before, after, beforeEach, afterEach, describe, it */
describe('lib/main', function () {
  if (process.platform === 'win32') {
    // It seems that it takes time for file operation in Windows.
    // So set `timeout(60000)` for the whole test.
    this.timeout(60000)
  }

  let aws = null // mock
  let awsLambda = null // mock
  before(() => {
    aws = _mockSetting()
    awsLambda = new aws.Lambda({ apiVersion: '2015-03-31' })
  })
  after(() => _awsRestore())

  beforeEach(() => {
    program = Object.assign({}, originalProgram) // clone
  })

  it('version should be set', function () {
    assert.equal(lambda.version, '0.11.0')
  })

  describe('_codeDirectory', function () {
    it('.lambda in the current directory', function () {
      assert.equal(lambda._codeDirectory(), path.resolve('.', '.lambda'))
    })
  })

  describe('_runHandler', () => {
    it('context methods is a function', (done) => {
      const handler = (event, context, callback) => {
        assert.isFunction(context.succeed)
        assert.isFunction(context.fail)
        assert.isFunction(context.done)
        done()
      }
      lambda._runHandler(handler, {}, program, {})
    })
  })

  describe('_params', function () {
    // http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-FunctionName
    const functionNamePattern =
      /(arn:aws:lambda:)?([a-z]{2}-[a-z]+-\d{1}:)?(\d{12}:)?(function:)?([a-zA-Z0-9-_]+)(:(\$LATEST|[a-zA-Z0-9-_]+))?/
    it('appends environment to original functionName', function () {
      var params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-development')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends environment to original functionName (production)', function () {
      program.environment = 'production'
      var params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-production')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends version to original functionName', function () {
      program.lambdaVersion = '2015-02-01'
      var params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-development-2015-02-01')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends version to original functionName (value not allowed by AWS)', function () {
      program.lambdaVersion = '2015.02.01'
      var params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-development-2015_02_01')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends VpcConfig to params when vpc params set', function () {
      program.vpcSubnets = 'subnet-00000000,subnet-00000001,subnet-00000002'
      program.vpcSecurityGroups = 'sg-00000000,sg-00000001,sg-00000002'
      var params = lambda._params(program)
      assert.equal(params.VpcConfig.SubnetIds[0], program.vpcSubnets.split(',')[0])
      assert.equal(params.VpcConfig.SubnetIds[1], program.vpcSubnets.split(',')[1])
      assert.equal(params.VpcConfig.SubnetIds[2], program.vpcSubnets.split(',')[2])
      assert.equal(params.VpcConfig.SecurityGroupIds[0], program.vpcSecurityGroups.split(',')[0])
      assert.equal(params.VpcConfig.SecurityGroupIds[1], program.vpcSecurityGroups.split(',')[1])
      assert.equal(params.VpcConfig.SecurityGroupIds[2], program.vpcSecurityGroups.split(',')[2])
    })

    it('does not append VpcConfig when params are not set', function () {
      var params = lambda._params(program)
      assert.equal(Object.keys(params.VpcConfig.SubnetIds).length, 0)
      assert.equal(Object.keys(params.VpcConfig.SecurityGroupIds).length, 0)
    })

    it('appends DeadLetterConfig to params when DLQ params set', function () {
      ['', 'arn:aws:sqs:test'].forEach(function (v) {
        program.deadLetterConfigTargetArn = v
        const params = lambda._params(program)
        assert.equal(params.DeadLetterConfig.TargetArn, v, v)
      })
    })

    it('does not append DeadLetterConfig when params are not set', function () {
      delete program.deadLetterConfigTargetArn
      var params = lambda._params(program)
      assert.isNull(params.DeadLetterConfig.TargetArn)
    })

    it('appends TracingConfig to params when params set', function () {
      program.tracingConfig = 'Active'
      const params = lambda._params(program)
      assert.equal(params.TracingConfig.Mode, 'Active')
    })

    it('does not append TracingConfig when params are not set', function () {
      program.tracingConfig = ''
      const params = lambda._params(program)
      assert.isNull(params.TracingConfig.Mode)
    })

    describe('configFile', function () {
      beforeEach(function () {
        // Prep...
        fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n')
        fs.writeFileSync('empty.env', '')
      })

      afterEach(function () {
        fs.unlinkSync('tmp.env')
        fs.unlinkSync('empty.env')
      })

      it('adds variables when configFile param is set', function () {
        program.configFile = 'tmp.env'
        var params = lambda._params(program)
        assert.equal(params.Environment.Variables['FOO'], 'bar')
        assert.equal(params.Environment.Variables['BAZ'], 'bing')
      })

      it('when configFile param is set but it is an empty file', function () {
        program.configFile = 'empty.env'
        var params = lambda._params(program)
        assert.equal(Object.keys(params.Environment.Variables).length, 0)
      })

      it('does not add when configFile param is not set', function () {
        var params = lambda._params(program)
        assert.isNull(params.Environment.Variables)
      })
    })
  })

  describe('_cleanDirectory', () => {
    it('`codeDirectory` is empty', () => {
      return lambda._cleanDirectory(codeDirectory).then(() => {
        assert.isTrue(fs.existsSync(codeDirectory))
        const contents = fs.readdirSync(codeDirectory)
        assert.equal(contents.length, 0)
      })
    })

    it('`codeDirectory` is empty. (For `codeDirectory` where the file was present)', () => {
      return lambda._fileCopy(program, '.', codeDirectory, true).then(() => {
        const contents = fs.readdirSync(codeDirectory)
        assert.isTrue(contents.length > 0)
        return lambda._cleanDirectory(codeDirectory).then(() => {
          assert.isTrue(fs.existsSync(codeDirectory))
          const contents = fs.readdirSync(codeDirectory)
          assert.equal(contents.length, 0)
        })
      })
    })
  })

  describe('_fileCopy', () => {
    before(() => {
      fs.mkdirSync('build')
      fs.mkdirsSync(path.join('__unittest', 'hoge'))
      fs.mkdirsSync(path.join('__unittest', 'fuga'))
      fs.writeFileSync(path.join('__unittest', 'hoge', 'piyo'))
      fs.writeFileSync(path.join('__unittest', 'hoge', 'package.json'))
      fs.writeFileSync('fuga')
    })
    after(() => {
      ['build', 'fuga', '__unittest'].forEach((path) => {
        fs.removeSync(path)
      })
    })

    beforeEach(() => lambda._cleanDirectory(codeDirectory))

    it('_fileCopy an index.js as well as other files', () => {
      return lambda._fileCopy(program, '.', codeDirectory, true).then(() => {
        const contents = fs.readdirSync(codeDirectory);
        ['index.js', 'package.json'].forEach((needle) => {
          assert.include(contents, needle, `Target: "${needle}"`)
        });
        ['node_modules', 'build'].forEach((needle) => {
          assert.notInclude(contents, needle, `Target: "${needle}"`)
        })
      })
    })

    describe('when there are excluded files', () => {
      beforeEach((done) => {
        // *main* => lib/main.js
        // In case of specifying files under the directory with wildcards
        program.excludeGlobs = [
          '*.png',
          'test',
          '*main*',
          path.join('__unittest', 'hoge', '*'),
          path.join('fuga', path.sep)
        ].join(' ')
        done()
      })

      it('_fileCopy an index.js as well as other files', () => {
        return lambda._fileCopy(program, '.', codeDirectory, true).then(() => {
          const contents = fs.readdirSync(codeDirectory);
          ['index.js', 'package.json'].forEach((needle) => {
            assert.include(contents, needle, `Target: "${needle}"`)
          })
        })
      })

      it('_fileCopy excludes files matching excludeGlobs', () => {
        return lambda._fileCopy(program, '.', codeDirectory, true).then(() => {
          let contents = fs.readdirSync(codeDirectory);
          ['__unittest', 'fuga'].forEach((needle) => {
            assert.include(contents, needle, `Target: "${needle}"`)
          });

          ['node-lambda.png', 'test'].forEach((needle) => {
            assert.notInclude(contents, needle, `Target: "${needle}"`)
          })

          contents = fs.readdirSync(path.join(codeDirectory, 'lib'))
          assert.notInclude(contents, 'main.js', 'Target: "lib/main.js"')

          contents = fs.readdirSync(path.join(codeDirectory, '__unittest'))
          assert.include(contents, 'hoge', 'Target: "__unittest/hoge"')
          assert.notInclude(contents, 'fuga', 'Target: "__unittest/fuga"')

          contents = fs.readdirSync(path.join(codeDirectory, '__unittest', 'hoge'))
          assert.equal(contents.length, 0, 'directory:__unittest/hoge is empty')
        })
      })

      it('_fileCopy should not exclude package.json, even when excluded by excludeGlobs', () => {
        program.excludeGlobs = '*.json'
        return lambda._fileCopy(program, '.', codeDirectory, true).then(() => {
          const contents = fs.readdirSync(codeDirectory)
          assert.include(contents, 'package.json')
        })
      })

      it('_fileCopy should not include package.json when --prebuiltDirectory is set', () => {
        const buildDir = '.build_' + Date.now()
        after(() => fs.removeSync(buildDir))

        fs.mkdirSync(buildDir)
        fs.writeFileSync(path.join(buildDir, 'testa'))
        fs.writeFileSync(path.join(buildDir, 'package.json'))

        program.excludeGlobs = '*.json'
        program.prebuiltDirectory = buildDir
        return lambda._fileCopy(program, buildDir, codeDirectory, true).then(() => {
          const contents = fs.readdirSync(codeDirectory)
          assert.notInclude(contents, 'package.json', 'Target: "packages.json"')
          assert.include(contents, 'testa', 'Target: "testa"')
        })
      })
    })
  })

  describe('_npmInstall', () => {
    beforeEach(() => {
      return lambda._cleanDirectory(codeDirectory).then(() => {
        return lambda._fileCopy(program, '.', codeDirectory, true)
      })
    })

    it('_npm adds node_modules', function () {
      _timeout({ this: this, sec: 30 }) // give it time to build the node modules

      return lambda._npmInstall(program, codeDirectory).then(() => {
        const contents = fs.readdirSync(codeDirectory)
        assert.include(contents, 'node_modules')
      })
    })
  })

  describe('_npmInstall (When codeDirectory contains characters to be escaped)', () => {
    beforeEach(() => {
      // Since '\' can not be included in the file or directory name in Windows
      const directoryName = process.platform === 'win32'
        ? 'hoge fuga\' piyo'
        : 'hoge "fuga\' \\piyo'
      codeDirectory = path.join(os.tmpdir(), directoryName)
      return lambda._cleanDirectory(codeDirectory).then(() => {
        return lambda._fileCopy(program, '.', codeDirectory, true)
      })
    })

    afterEach(() => {
      fs.removeSync(codeDirectory)
      codeDirectory = lambda._codeDirectory()
    })

    it('_npm adds node_modules', function () {
      _timeout({ this: this, sec: 30 }) // give it time to build the node modules

      return lambda._npmInstall(program, codeDirectory).then(() => {
        const contents = fs.readdirSync(codeDirectory)
        assert.include(contents, 'node_modules')
      })
    })
  })

  describe('_postInstallScript', () => {
    if (process.platform === 'win32') {
      return it('`_postInstallScript` test does not support Windows.')
    }

    const postInstallScriptPath = path.join(codeDirectory, 'post_install.sh')
    let hook
    /**
     * Capture console output
     */
    function captureStream (stream) {
      let oldWrite = stream.write
      let buf = ''
      stream.write = function (chunk, encoding, callback) {
        buf += chunk.toString() // chunk is a String or Buffer
        oldWrite.apply(stream, arguments)
      }

      return {
        unhook: () => {
          stream.write = oldWrite
        },
        captured: () => buf
      }
    }
    beforeEach(() => {
      hook = captureStream(process.stdout)
    })
    afterEach(() => {
      hook.unhook()
      if (fs.existsSync(postInstallScriptPath)) {
        fs.unlinkSync(postInstallScriptPath)
      }
    })

    it('should not throw any errors if no script', () => {
      return lambda._postInstallScript(program, codeDirectory).then((dummy) => {
        assert.isUndefined(dummy)
      })
    })

    it('should throw any errors if script fails', () => {
      fs.writeFileSync(postInstallScriptPath, '___fails___')
      return lambda._postInstallScript(program, codeDirectory).then((dummy) => {
        assert.isUndefined(dummy)
      }).catch((err) => {
        assert.instanceOf(err, Error)
        assert.match(err.message, /^Error: Command failed:/)
      })
    })

    it('running script gives expected output', () => {
      fs.writeFileSync(
        postInstallScriptPath,
        fs.readFileSync(path.join('test', 'post_install.sh'))
      )
      fs.chmodSync(path.join(codeDirectory, 'post_install.sh'), '755')
      return lambda._postInstallScript(program, codeDirectory).then((dummy) => {
        assert.isUndefined(dummy)
      }).catch((err) => {
        assert.isNull(err)
        assert.equal(
          `=> Running post install script post_install.sh\n\t\tYour environment is ${program.environment}\n`,
          hook.captured()
        )
      })
    })
  })

  describe('_zip', () => {
    beforeEach(function () {
      _timeout({ this: this, sec: 30 }) // give it time to build the node modules
      return Promise.resolve().then(() => {
        return lambda._cleanDirectory(codeDirectory)
      }).then(() => {
        return lambda._fileCopy(program, '.', codeDirectory, true)
      }).then(() => {
        return lambda._npmInstall(program, codeDirectory)
      })
    })

    it('Compress the file. `index.js` and `bin/node-lambda` are included and the permission is also preserved.', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip

      return lambda._zip(program, codeDirectory).then((data) => {
        const indexJsStat = fs.lstatSync('index.js')
        const binNodeLambdaStat = fs.lstatSync(path.join('bin', 'node-lambda'))

        const archive = new Zip(data)
        assert.include(archive.files['index.js'].name, 'index.js')
        assert.include(archive.files['bin/node-lambda'].name, 'bin/node-lambda')

        if (process.platform !== 'win32') {
          assert.equal(
            archive.files['index.js'].unixPermissions,
            indexJsStat.mode
          )
          assert.equal(
            archive.files['bin/node-lambda'].unixPermissions,
            binNodeLambdaStat.mode
          )
        }
      })
    })
  })

  describe('_archive', () => {
    // archive.files's name is a slash delimiter regardless of platform.
    it('installs and zips with an index.js file and node_modules/aws-sdk (It is also a test of `_buildAndArchive`)', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip

      return lambda._archive(program).then((data) => {
        const archive = new Zip(data)
        const contents = Object.keys(archive.files).map((k) => {
          return archive.files[k].name.toString()
        })
        assert.include(contents, 'index.js')
        assert.include(contents, 'node_modules/aws-sdk/lib/aws.js')
      })
    })

    it('packages a prebuilt module without installing (It is also a test of `_archivePrebuilt`)', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip
      let buildDir = '.build_' + Date.now()
      after(() => fs.removeSync(buildDir))

      fs.mkdirSync(buildDir)
      fs.mkdirSync(path.join(buildDir, 'd'))
      fs.mkdirSync(path.join(buildDir, 'node_modules'))
      fs.writeFileSync(path.join(buildDir, 'node_modules', 'a'), '...')
      fs.writeFileSync(path.join(buildDir, 'testa'), '...')
      fs.writeFileSync(path.join(buildDir, 'd', 'testb'), '...')

      program.prebuiltDirectory = buildDir
      return lambda._archive(program).then((data) => {
        const archive = new Zip(data)
        const contents = Object.keys(archive.files).map((k) => {
          return archive.files[k].name.toString()
        });
        [
          'testa',
          'd/testb',
          'node_modules/a'
        ].forEach((needle) => {
          assert.include(contents, needle, `Target: "${needle}"`)
        })
      })
    })
  })

  describe('_readArchive', () => {
    const testZipFile = path.join(os.tmpdir(), 'node-lambda-test.zip')
    let bufferExpected = null
    before(function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip

      return lambda._zip(program, codeDirectory).then((data) => {
        bufferExpected = data
        fs.writeFileSync(testZipFile, data)
      })
    })

    after(() => fs.unlinkSync(testZipFile))

    it('_readArchive fails (undefined)', () => {
      return lambda._readArchive(program).then((data) => {
        assert.isUndefined(data)
      }).catch((err) => {
        assert.instanceOf(err, Error)
        assert.equal(err.message, 'No such Zipfile [undefined]')
      })
    })

    it('_readArchive fails (does not exists file)', () => {
      const filePath = path.join(path.resolve('/aaaa'), 'bbbb')
      const _program = Object.assign({ deployZipfile: filePath }, program)
      return lambda._readArchive(_program).then((data) => {
        assert.isUndefined(data)
      }).catch((err) => {
        assert.instanceOf(err, Error)
        assert.equal(err.message, `No such Zipfile [${filePath}]`)
      })
    })

    it('_readArchive reads the contents of the zipfile', () => {
      const _program = Object.assign({ deployZipfile: testZipFile }, program)
      return lambda._readArchive(_program).then((data) => {
        assert.deepEqual(data, bufferExpected)
      })
    })

    describe('If value is set in `deployZipfile`, _readArchive is executed in _archive', () => {
      it('`deployZipfile` is a invalid value. Process from creation of zip file', function () {
        const filePath = path.join(path.resolve('/aaaa'), 'bbbb')
        const _program = Object.assign({ deployZipfile: filePath }, program)
        _timeout({ this: this, sec: 30 }) // give it time to zip
        return lambda._archive(_program).then((data) => {
          // same test as "installs and zips with an index.js file and node_modules/aws-sdk"
          const archive = new Zip(data)
          const contents = Object.keys(archive.files).map((k) => {
            return archive.files[k].name.toString()
          })
          assert.include(contents, 'index.js')
          assert.include(contents, 'node_modules/aws-sdk/lib/aws.js')
        })
      })

      it('`deployZipfile` is a valid value._archive reads the contents of the zipfile', () => {
        const _program = Object.assign({ deployZipfile: testZipFile }, program)
        return lambda._archive(_program).then((data) => {
          assert.deepEqual(data, bufferExpected)
        })
      })
    })
  })

  describe('environment variable injection at runtime', function () {
    beforeEach(function () {
      // Prep...
      fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n')
    })

    afterEach(function () {
      fs.unlinkSync('tmp.env')
    })

    it('should inject environment variables at runtime', function () {
      // Run it...
      lambda._setRunTimeEnvironmentVars({
        configFile: 'tmp.env'
      }, process.cwd())

      assert.equal(process.env.FOO, 'bar')
      assert.equal(process.env.BAZ, 'bing')
    })
  })

  describe('create sample files', function () {
    const targetFiles = [
      '.env',
      'context.json',
      'event.json',
      'deploy.env',
      'event_sources.json'
    ]

    after(function () {
      targetFiles.forEach(function (file) {
        fs.unlinkSync(file)
      })
      program.eventSourceFile = ''
    })

    it('should create sample files', function () {
      lambda.setup(program)

      const libPath = path.join(__dirname, '..', 'lib')
      targetFiles.forEach(function (targetFile) {
        const boilerplateFile = path.join(libPath, `${targetFile}.example`)

        assert.equal(
          fs.readFileSync(targetFile).toString(),
          fs.readFileSync(boilerplateFile).toString(),
          targetFile
        )
      })
    })

    describe('_eventSourceList', function () {
      it('program.eventSourceFile is empty value', function () {
        program.eventSourceFile = ''
        assert.deepEqual(
          lambda._eventSourceList(program),
          { EventSourceMappings: null, ScheduleEvents: null }
        )
      })

      it('program.eventSourceFile is invalid value', function () {
        const dirPath = path.join(path.resolve('/hoge'), 'fuga')
        program.eventSourceFile = dirPath
        assert.throws(
          () => { lambda._eventSourceList(program) },
          Error,
          `ENOENT: no such file or directory, open '${dirPath}'`
        )
      })

      describe('program.eventSourceFile is valid value', function () {
        before(function () {
          fs.writeFileSync('only_EventSourceMappings.json', JSON.stringify({
            EventSourceMappings: [{ test: 1 }]
          }))
          fs.writeFileSync('only_ScheduleEvents.json', JSON.stringify({
            ScheduleEvents: [{ test: 2 }]
          }))
        })

        after(function () {
          fs.unlinkSync('only_EventSourceMappings.json')
          fs.unlinkSync('only_ScheduleEvents.json')
        })

        it('only EventSourceMappings', function () {
          program.eventSourceFile = 'only_EventSourceMappings.json'
          const expected = {
            EventSourceMappings: [{ test: 1 }],
            ScheduleEvents: []
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })

        it('only ScheduleEvents', function () {
          program.eventSourceFile = 'only_ScheduleEvents.json'
          const expected = {
            EventSourceMappings: [],
            ScheduleEvents: [{ test: 2 }]
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })

        it('EventSourceMappings & ScheduleEvents', function () {
          program.eventSourceFile = 'event_sources.json'
          const expected = {
            EventSourceMappings: [{
              BatchSize: 100,
              Enabled: true,
              EventSourceArn: 'your event source arn',
              StartingPosition: 'LATEST'
            }],
            ScheduleEvents: [{
              ScheduleName: 'node-lambda-test-schedule',
              ScheduleState: 'ENABLED',
              ScheduleExpression: 'rate(1 hour)'
            }]
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })
      })

      describe('old style event_sources.json', function () {
        const oldStyleValue = [{
          BatchSize: 100,
          Enabled: true,
          EventSourceArn: 'your event source arn',
          StartingPosition: 'LATEST'
        }]
        const fileName = 'event_sources_old_style.json'

        before(function () {
          fs.writeFileSync(fileName, JSON.stringify(oldStyleValue))
        })

        after(function () {
          fs.unlinkSync(fileName)
        })

        it('program.eventSourceFile is valid value', function () {
          program.eventSourceFile = fileName
          const expected = {
            EventSourceMappings: oldStyleValue,
            ScheduleEvents: []
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })
      })
    })
  })

  describe('_listEventSourceMappings', () => {
    it('simple test with mock', () => {
      return lambda._listEventSourceMappings(
        awsLambda,
        { FunctionName: 'test-func' }
      ).then((results) => {
        assert.deepEqual(
          results,
          lambdaMockSettings.listEventSourceMappings.EventSourceMappings
        )
      })
    })
  })

  describe('_updateEventSources', () => {
    const eventSourcesJsonValue = {
      EventSourceMappings: [{
        EventSourceArn: lambdaMockSettings
          .listEventSourceMappings
          .EventSourceMappings[0]
          .EventSourceArn,
        StartingPosition: 'LATEST',
        BatchSize: 100,
        Enabled: true
      }]
    }

    before(() => {
      fs.writeFileSync(
        'event_sources.json',
        JSON.stringify(eventSourcesJsonValue)
      )
    })

    after(() => fs.unlinkSync('event_sources.json'))

    it('program.eventSourceFile is empty value', () => {
      program.eventSourceFile = ''
      const eventSourceList = lambda._eventSourceList(program)
      return lambda._updateEventSources(
        awsLambda,
        '',
        [],
        eventSourceList.EventSourceMappings
      ).then((results) => {
        assert.deepEqual(results, [])
      })
    })

    it('simple test with mock (In case of new addition)', () => {
      program.eventSourceFile = 'event_sources.json'
      const eventSourceList = lambda._eventSourceList(program)
      return lambda._updateEventSources(
        awsLambda,
        'functionName',
        [],
        eventSourceList.EventSourceMappings
      ).then((results) => {
        assert.deepEqual(results, [lambdaMockSettings.createEventSourceMapping])
      })
    })

    it('simple test with mock (In case of deletion)', () => {
      return lambda._updateEventSources(
        awsLambda,
        'functionName',
        lambdaMockSettings.listEventSourceMappings.EventSourceMappings,
        {}
      ).then((results) => {
        assert.deepEqual(results, [lambdaMockSettings.deleteEventSourceMapping])
      })
    })

    it('simple test with mock (In case of update)', () => {
      program.eventSourceFile = 'event_sources.json'
      const eventSourceList = lambda._eventSourceList(program)
      return lambda._updateEventSources(
        awsLambda,
        'functionName',
        lambdaMockSettings.listEventSourceMappings.EventSourceMappings,
        eventSourceList.EventSourceMappings
      ).then((results) => {
        assert.deepEqual(results, [lambdaMockSettings.updateEventSourceMapping])
      })
    })
  })

  describe('_updateScheduleEvents', () => {
    const ScheduleEvents = require(path.join('..', 'lib', 'schedule_events'))
    const eventSourcesJsonValue = {
      ScheduleEvents: [{
        ScheduleName: 'node-lambda-test-schedule',
        ScheduleState: 'ENABLED',
        ScheduleExpression: 'rate(1 hour)',
        ScheduleDescription: 'Run node-lambda-test-function once per hour'
      }]
    }

    let schedule = null

    before(() => {
      fs.writeFileSync(
        'event_sources.json',
        JSON.stringify(eventSourcesJsonValue)
      )
      schedule = new ScheduleEvents(aws)
    })

    after(() => fs.unlinkSync('event_sources.json'))

    it('program.eventSourceFile is empty value', () => {
      program.eventSourceFile = ''
      const eventSourceList = lambda._eventSourceList(program)
      return lambda._updateScheduleEvents(
        schedule,
        '',
        eventSourceList.ScheduleEvents
      ).then((results) => {
        assert.deepEqual(results, [])
      })
    })

    it('simple test with mock', () => {
      program.eventSourceFile = 'event_sources.json'
      const eventSourceList = lambda._eventSourceList(program)
      const functionArn = 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
      return lambda._updateScheduleEvents(
        schedule,
        functionArn,
        eventSourceList.ScheduleEvents
      ).then((results) => {
        const expected = [Object.assign(
          eventSourcesJsonValue.ScheduleEvents[0],
          { FunctionArn: functionArn }
        )]
        assert.deepEqual(results, expected)
      })
    })
  })

  describe('_uploadNew', () => {
    it('simple test with mock', () => {
      const params = lambda._params(program, null)
      return lambda._uploadNew(awsLambda, params, (results) => {
        assert.deepEqual(results, lambdaMockSettings.createFunction)
      })
    })
  })

  describe('_uploadExisting', () => {
    it('simple test with mock', () => {
      const params = lambda._params(program, null)
      return lambda._uploadExisting(awsLambda, params).then((results) => {
        assert.deepEqual(results, lambdaMockSettings.updateFunctionConfiguration)
      })
    })
  })

  describe('check env vars before create sample files', function () {
    const filesCreatedBySetup = [
      '.env',
      'deploy.env',
      'event_sources.json'
    ]

    beforeEach(function () {
      fs.writeFileSync('newContext.json', '{"FOO"="bar"\n"BAZ"="bing"\n}')
      fs.writeFileSync('newEvent.json', '{"FOO"="bar"}')
    })

    afterEach(function () {
      fs.unlinkSync('newContext.json')
      fs.unlinkSync('newEvent.json')
      filesCreatedBySetup.forEach(function (file) {
        fs.unlinkSync(file)
      })
    })

    it('should use existing sample files', function () {
      program.eventFile = 'newEvent.json'
      program.contextFile = 'newContext.json'

      lambda.setup(program)

      assert.equal(fs.readFileSync('newContext.json').toString(), '{"FOO"="bar"\n"BAZ"="bing"\n}')
      assert.equal(fs.readFileSync('newEvent.json').toString(), '{"FOO"="bar"}')

      const libPath = path.join(__dirname, '..', 'lib')
      filesCreatedBySetup.forEach(function (targetFile) {
        const boilerplateFile = path.join(libPath, `${targetFile}.example`)

        assert.equal(
          fs.readFileSync(targetFile).toString(),
          fs.readFileSync(boilerplateFile).toString(),
          targetFile
        )
      })
    })
  })

  describe('Lambda.prototype._deployToRegion()', () => {
    it('Since `aws-mock` does not correspond to `request.on`, it is impossible to test with Mock')
  })

  describe('Lambda.prototype.deploy()', () => {
    it('Since `aws-mock` does not correspond to `request.on`, it is impossible to test with Mock')
  })
})
