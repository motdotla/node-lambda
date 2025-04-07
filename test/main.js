'use strict'

const process = require('process')
const path = require('path')
const os = require('os')
const fs = require('fs-extra')
const { execFileSync } = require('child_process')
const lambda = require(path.join(__dirname, '..', 'lib', 'main'))
const Zip = require('node-zip')
let assert
import('chai').then(chai => {
  assert = chai.assert
})

const awsMock = require('aws-sdk-mock')
awsMock.setSDK(path.resolve('node_modules/aws-sdk'))

// Migrating to v3.
const { mockClient } = require('aws-sdk-client-mock')
const {
  LambdaClient,
  CreateEventSourceMappingCommand,
  CreateFunctionCommand,
  DeleteEventSourceMappingCommand,
  GetFunctionCommand,
  ListEventSourceMappingsCommand,
  ListTagsCommand,
  TagResourceCommand,
  UntagResourceCommand,
  UpdateEventSourceMappingCommand,
  UpdateFunctionCodeCommand,
  UpdateFunctionConfigurationCommand
} = require('@aws-sdk/client-lambda')
const mockLambdaClient = mockClient(LambdaClient)
const lambdaClient = new LambdaClient({ region: 'us-east-1' })
const {
  CloudWatchLogsClient,
  CreateLogGroupCommand,
  PutRetentionPolicyCommand
} = require('@aws-sdk/client-cloudwatch-logs')
const mockCloudWatchLogsClient = mockClient(CloudWatchLogsClient)

const originalProgram = {
  packageManager: 'npm',
  environment: 'development',
  accessKey: 'key',
  secretKey: 'secret',
  sessionToken: 'token',
  functionName: '___node-lambda',
  handler: 'index.handler',
  role: 'arn:aws:iam::999999999999:role/test',
  memorySize: 128,
  timeout: 3,
  description: '',
  runtime: 'nodejs20.x',
  deadLetterConfigTargetArn: '',
  tracingConfig: '',
  Layers: '',
  retentionInDays: 30,
  region: 'us-east-1,us-west-2,eu-west-1',
  eventFile: 'event.json',
  eventSourceFile: '',
  contextFile: 'context.json',
  deployTimeout: 120000,
  prebuiltDirectory: '',
  proxy: '',
  optionalDependencies: true
}

let program = {}
let codeDirectory = lambda._codeDirectory()

const sourceDirectoryForTest = path.join('.', 'test', 'testPj')

const _timeout = function (params) {
  // Even if timeout is set for the whole test for Windows and Mac,
  // if it is set in local it will be valid.
  // For Windows and Mac, do not set it with local.
  if (!['win32', 'darwin'].includes(process.platform)) {
    params.this.timeout(params.sec * 1000)
  }
}

// It does not completely reproduce the response of the actual API.
const lambdaMockSettings = {
  addPermission: {},
  getFunction: {
    Code: {},
    Configuration: { LastUpdateStatus: 'Successful' },
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
  },
  listTags: {
    Tags: { tag1: 'key1' }
  },
  untagResource: {},
  tagResource: {}
}

const _mockSetting = () => {
  awsMock.mock('CloudWatchEvents', 'putRule', (params, callback) => {
    callback(null, {})
  })
  awsMock.mock('CloudWatchEvents', 'putTargets', (params, callback) => {
    callback(null, {})
  })
  awsMock.mock('S3', 'putBucketNotificationConfiguration', (params, callback) => {
    callback(null, {})
  })
  awsMock.mock('S3', 'putObject', (params, callback) => {
    callback(null, { test: 'putObject' })
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
  awsMock.restore('S3')
  awsMock.restore('Lambda')
}

/* global before, after, beforeEach, afterEach, describe, it */
describe('lib/main', function () {
  if (['win32', 'darwin'].includes(process.platform)) {
    // It seems that it takes time for file operation in Windows and Mac.
    // So set `timeout(120000)` for the whole test.
    this.timeout(120000)
  }

  let aws = null // mock
  before(() => {
    aws = _mockSetting()

    if (process.platform === 'win32') {
      execFileSync('cmd.exe', ['/c', 'npm', 'ci'], { cwd: sourceDirectoryForTest })
      return
    }
    execFileSync('npm', ['ci'], { cwd: sourceDirectoryForTest })

    // for sdk v3
    mockLambdaClient.reset()
    mockLambdaClient.on(CreateEventSourceMappingCommand).resolves(lambdaMockSettings.createEventSourceMapping)
    mockLambdaClient.on(CreateFunctionCommand).resolves(lambdaMockSettings.createFunction)
    mockLambdaClient.on(DeleteEventSourceMappingCommand).resolves(lambdaMockSettings.deleteEventSourceMapping)
    mockLambdaClient.on(GetFunctionCommand).resolves(lambdaMockSettings.getFunction)
    mockLambdaClient.on(ListEventSourceMappingsCommand).resolves(lambdaMockSettings.listEventSourceMappings)
    mockLambdaClient.on(ListTagsCommand).resolves(lambdaMockSettings.listTags)
    mockLambdaClient.on(TagResourceCommand).resolves(lambdaMockSettings.tagResource)
    mockLambdaClient.on(UntagResourceCommand).resolves(lambdaMockSettings.untagResource)
    mockLambdaClient.on(UpdateEventSourceMappingCommand).resolves(lambdaMockSettings.updateEventSourceMapping)
    mockLambdaClient.on(UpdateFunctionCodeCommand).resolves(lambdaMockSettings.updateFunctionCode)
    mockLambdaClient.on(UpdateFunctionConfigurationCommand).resolves(lambdaMockSettings.updateFunctionConfiguration)

    mockCloudWatchLogsClient.reset()
    mockCloudWatchLogsClient.on(CreateLogGroupCommand).resolves({})
    mockCloudWatchLogsClient.on(PutRetentionPolicyCommand).resolves({})
  })
  after(() => {
    _awsRestore()
  })

  beforeEach(() => {
    program = Object.assign({}, originalProgram) // clone
  })

  it('version should be set', () => {
    assert.equal(lambda.version, '1.3.0')
  })

  describe('_codeDirectory', () => {
    it('Working directory in the /tmp directory', () => {
      assert.equal(
        lambda._codeDirectory(),
        path.join(fs.realpathSync(os.tmpdir()), 'node-lambda-lambda')
      )
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

  describe('_isFunctionDoesNotExist', () => {
    it('=== true', () => {
      const err = {
        code: 'ResourceNotFoundException',
        message: 'Function not found: arn:aws:lambda:XXX'
      }
      assert.isTrue(lambda._isFunctionDoesNotExist(err))
    })

    it('=== false', () => {
      const err = {
        code: 'MissingRequiredParameter',
        message: 'Missing required key \'FunctionName\' in params'
      }
      assert.isFalse(lambda._isFunctionDoesNotExist(err))
    })
  })

  describe('_isUseS3', () => {
    it('=== true', () => {
      assert.isTrue(lambda._isUseS3({ deployUseS3: true }))
      assert.isTrue(lambda._isUseS3({ deployUseS3: 'true' }))
    })

    it('=== false', () => {
      [
        {},
        { deployUseS3: false },
        { deployUseS3: 'false' },
        { deployUseS3: 'foo' }
      ].forEach((params) => {
        assert.isFalse(lambda._isUseS3(params), params)
      })
    })
  })

  describe('_useECR', () => {
    it('=== true', () => {
      assert.isTrue(lambda._useECR({ imageUri: 'xxx' }))
    })

    it('=== false', () => {
      [
        {},
        { imageUri: null },
        { imageUri: '' }
      ].forEach((params) => {
        assert.isFalse(lambda._useECR(params), params)
      })
    })
  })

  describe('_params', () => {
    // http://docs.aws.amazon.com/lambda/latest/dg/API_CreateFunction.html#SSS-CreateFunction-request-FunctionName
    const functionNamePattern =
      /(arn:aws:lambda:)?([a-z]{2}-[a-z]+-\d{1}:)?(\d{12}:)?(function:)?([a-zA-Z0-9-_]+)(:(\$LATEST|[a-zA-Z0-9-_]+))?/
    it('appends environment to original functionName', () => {
      const params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-development')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends environment to original functionName (production)', () => {
      program.environment = 'production'
      const params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-production')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends version to original functionName', () => {
      program.lambdaVersion = '2015-02-01'
      const params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-development-2015-02-01')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends version to original functionName (value not allowed by AWS)', () => {
      program.lambdaVersion = '2015.02.01'
      const params = lambda._params(program)
      assert.equal(params.FunctionName, '___node-lambda-development-2015_02_01')
      assert.match(params.FunctionName, functionNamePattern)
    })

    it('appends VpcConfig to params when vpc params set', () => {
      program.vpcSubnets = 'subnet-00000000,subnet-00000001,subnet-00000002'
      program.vpcSecurityGroups = 'sg-00000000,sg-00000001,sg-00000002'
      const params = lambda._params(program)
      assert.equal(params.VpcConfig.SubnetIds[0], program.vpcSubnets.split(',')[0])
      assert.equal(params.VpcConfig.SubnetIds[1], program.vpcSubnets.split(',')[1])
      assert.equal(params.VpcConfig.SubnetIds[2], program.vpcSubnets.split(',')[2])
      assert.equal(params.VpcConfig.SecurityGroupIds[0], program.vpcSecurityGroups.split(',')[0])
      assert.equal(params.VpcConfig.SecurityGroupIds[1], program.vpcSecurityGroups.split(',')[1])
      assert.equal(params.VpcConfig.SecurityGroupIds[2], program.vpcSecurityGroups.split(',')[2])
    })

    it('does not append VpcConfig when params are not set', () => {
      const params = lambda._params(program)
      assert.equal(Object.keys(params.VpcConfig.SubnetIds).length, 0)
      assert.equal(Object.keys(params.VpcConfig.SecurityGroupIds).length, 0)
    })

    it('appends KMSKeyArn to params when KMS params set', () => {
      ['', 'arn:aws:kms:test'].forEach((v) => {
        program.kmsKeyArn = v
        const params = lambda._params(program)
        assert.equal(params.KMSKeyArn, v, v)
      })
    })

    it('does not append KMSKeyArn when params are not set', () => {
      const params = lambda._params(program)
      assert.isUndefined(params.KMSKeyArn)
    })

    it('appends DeadLetterConfig to params when DLQ params set', () => {
      ['', 'arn:aws:sqs:test'].forEach((v) => {
        program.deadLetterConfigTargetArn = v
        const params = lambda._params(program)
        assert.equal(params.DeadLetterConfig.TargetArn, v, v)
      })
    })

    it('does not append DeadLetterConfig when params are not set', () => {
      delete program.deadLetterConfigTargetArn
      const params = lambda._params(program)
      assert.isNull(params.DeadLetterConfig.TargetArn)
    })

    it('appends TracingConfig to params when params set', () => {
      program.tracingConfig = 'Active'
      const params = lambda._params(program)
      assert.equal(params.TracingConfig.Mode, 'Active')
    })

    it('does not append TracingConfig when params are not set', () => {
      program.tracingConfig = ''
      const params = lambda._params(program)
      assert.isNull(params.TracingConfig.Mode)
    })

    it('appends Layers to params when params set', () => {
      program.layers = 'Layer1,Layer2'
      const params = lambda._params(program)
      assert.deepEqual(params.Layers, ['Layer1', 'Layer2'])
    })

    it('does not append Layers when params are not set', () => {
      program.layers = ''
      const params = lambda._params(program)
      assert.deepEqual(params.Layers, [])
    })

    describe('S3 deploy', () => {
      it('Do not use S3 deploy', () => {
        const params = lambda._params(program, 'Buffer')
        assert.deepEqual(
          params.Code,
          { ZipFile: 'Buffer' }
        )
      })

      it('Use S3 deploy', () => {
        const params = lambda._params(Object.assign({ deployUseS3: true }, program), 'Buffer')
        assert.deepEqual(
          params.Code,
          {
            S3Bucket: null,
            S3Key: null
          }
        )
      })
    })

    describe('PackageType: Zip|Image', () => {
      it('PackageType: Zip', () => {
        const params = lambda._params(program, 'Buffer')
        assert.equal(params.PackageType, 'Zip')
        assert.deepEqual(
          params.Code,
          { ZipFile: 'Buffer' }
        )
      })

      it('PackageType: Image', () => {
        program.imageUri = 'xxx'
        const params = lambda._params(program, 'Buffer')
        assert.equal(params.PackageType, 'Image')

        assert.isUndefined(params.Handler)
        assert.isUndefined(params.Runtime)
        assert.isUndefined(params.KMSKeyArn)

        assert.deepEqual(
          params.Code,
          { ImageUri: 'xxx' }
        )
      })
    })

    describe('params.Publish', () => {
      describe('boolean', () => {
        it('If true, it is set to true', () => {
          program.publish = true
          const params = lambda._params(program)
          assert.isTrue(params.Publish)
        })
        it('If false, it is set to false', () => {
          program.publish = false
          const params = lambda._params(program)
          assert.isFalse(params.Publish)
        })
      })

      describe('string', () => {
        it('If "true", it is set to true', () => {
          program.publish = 'true'
          const params = lambda._params(program)
          assert.isTrue(params.Publish)
        })
        it('If not "true", it is set to false', () => {
          program.publish = 'false'
          assert.isFalse(lambda._params(program).Publish)
          program.publish = 'aaa'
          assert.isFalse(lambda._params(program).Publish)
        })
      })
    })

    describe('configFile', () => {
      beforeEach(() => {
        // Prep...
        fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n')
        fs.writeFileSync('empty.env', '')
      })

      afterEach(() => {
        fs.unlinkSync('tmp.env')
        fs.unlinkSync('empty.env')
      })

      it('adds variables when configFile param is set', () => {
        program.configFile = 'tmp.env'
        const params = lambda._params(program)
        assert.equal(params.Environment.Variables.FOO, 'bar')
        assert.equal(params.Environment.Variables.BAZ, 'bing')
      })

      it('when configFile param is set but it is an empty file', () => {
        program.configFile = 'empty.env'
        const params = lambda._params(program)
        assert.equal(Object.keys(params.Environment.Variables).length, 0)
      })

      it('does not add when configFile param is not set', () => {
        const params = lambda._params(program)
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
      fs.mkdirsSync(path.join('__unittest', 'hoge'))
      fs.mkdirsSync(path.join('__unittest', 'fuga'))
      fs.writeFileSync(path.join('__unittest', 'hoge', 'piyo'), '')
      fs.writeFileSync(path.join('__unittest', 'hoge', 'package.json'), '')
      fs.writeFileSync('fuga', '')
    })
    after(() => {
      ['fuga', '__unittest'].forEach((path) => {
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
      it('_fileCopy should not exclude package-lock.json, even when excluded by excludeGlobs', () => {
        program.excludeGlobs = '*.json'
        return lambda._fileCopy(program, '.', codeDirectory, true).then(() => {
          const contents = fs.readdirSync(codeDirectory)
          assert.include(contents, 'package-lock.json')
        })
      })

      it('_fileCopy should not include package.json when --prebuiltDirectory is set', () => {
        const buildDir = '.build_' + Date.now()
        after(() => fs.removeSync(buildDir))

        fs.mkdirSync(buildDir)
        fs.writeFileSync(path.join(buildDir, 'testa'), '')
        fs.writeFileSync(path.join(buildDir, 'package.json'), '')

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

  describe('_shouldUseNpmCi', () => {
    beforeEach(() => {
      return lambda._cleanDirectory(codeDirectory)
    })

    describe('when package-lock.json exists', () => {
      beforeEach(() => {
        fs.writeFileSync(path.join(codeDirectory, 'package-lock.json'), JSON.stringify({}))
      })

      it('returns true', () => {
        assert.isTrue(lambda._shouldUseNpmCi(codeDirectory))
      })
    })

    describe('when package-lock.json does not exist', () => {
      beforeEach(() => {
        fs.removeSync(path.join(codeDirectory, 'package-lock.json'))
      })

      it('returns false', () => {
        assert.isFalse(lambda._shouldUseNpmCi(codeDirectory))
      })
    })
  })

  describe('_getNpmInstallCommand', () => {
    describe('when package-lock.json exists', () => {
      const codeDirectory = '.'

      it('npm ci', () => {
        const { packageManager, installOptions } = lambda._getNpmInstallCommand(program, codeDirectory)
        assert.equal(packageManager, 'npm')
        assert.deepEqual(installOptions, ['-s', 'ci', '--production', '--no-audit', '--prefix', codeDirectory])
      })

      it('npm ci with "--no-optional"', () => {
        const { packageManager, installOptions } = lambda._getNpmInstallCommand(
          {
            ...program,
            optionalDependencies: false
          },
          codeDirectory
        )
        assert.equal(packageManager, 'npm')
        assert.deepEqual(
          installOptions,
          ['-s', 'ci', '--production', '--no-audit', '--no-optional', '--prefix', codeDirectory]
        )
      })

      it('npm ci on docker', () => {
        const { packageManager, installOptions } = lambda._getNpmInstallCommand(
          {
            ...program,
            dockerImage: 'test'
          },
          codeDirectory
        )
        assert.equal(packageManager, 'npm')
        assert.deepEqual(installOptions, ['-s', 'ci', '--production', '--no-audit'])
      })
    })

    describe('when package-lock.json does not exist', () => {
      const codeDirectory = './test'

      it('npm install', () => {
        const { packageManager, installOptions } = lambda._getNpmInstallCommand(program, './test')
        assert.equal(packageManager, 'npm')
        assert.deepEqual(installOptions, ['-s', 'install', '--production', '--no-audit', '--prefix', './test'])
      })

      it('npm install with "--no-optional"', () => {
        const { packageManager, installOptions } = lambda._getNpmInstallCommand(
          {
            ...program,
            optionalDependencies: false
          },
          codeDirectory
        )
        assert.equal(packageManager, 'npm')
        assert.deepEqual(
          installOptions,
          ['-s', 'install', '--production', '--no-audit', '--no-optional', '--prefix', codeDirectory]
        )
      })

      it('npm install on docker', () => {
        const { packageManager, installOptions } = lambda._getNpmInstallCommand(
          {
            ...program,
            dockerImage: 'test'
          },
          codeDirectory
        )
        assert.equal(packageManager, 'npm')
        assert.deepEqual(installOptions, ['-s', 'install', '--production', '--no-audit'])
      })
    })
  })

  describe('_getYarnInstallCommand', () => {
    const codeDirectory = '.'

    it('yarn install', () => {
      const { packageManager, installOptions } = lambda._getYarnInstallCommand(program, codeDirectory)
      assert.equal(packageManager, 'yarn')
      assert.deepEqual(installOptions, ['-s', 'install', '--production', '--cwd', codeDirectory])
    })

    it('yarn install with "--no-optional"', () => {
      const { packageManager, installOptions } = lambda._getYarnInstallCommand(
        {
          ...program,
          optionalDependencies: false
        },
        codeDirectory
      )
      assert.equal(packageManager, 'yarn')
      assert.deepEqual(
        installOptions,
        ['-s', 'install', '--production', '--ignore-optional', '--cwd', codeDirectory]
      )
    })

    it('yarn install on docker', () => {
      const { packageManager, installOptions } = lambda._getYarnInstallCommand(
        {
          ...program,
          dockerImage: 'test'
        },
        codeDirectory
      )
      assert.equal(packageManager, 'yarn')
      assert.deepEqual(installOptions, ['-s', 'install', '--production'])
    })
  })

  describe('_packageInstall', function () {
    _timeout({ this: this, sec: 60 }) // ci should be faster than install

    // npm treats files as packages when installing, and so removes them.
    // Test with `devDependencies` packages that are not installed with the `--production` option.
    const nodeModulesMocha = path.join(codeDirectory, 'node_modules', 'chai')

    const testCleanAndInstall = async (packageManager) => {
      const beforeDotenvStat = fs.statSync(path.join(codeDirectory, 'node_modules', 'dotenv'))

      const usedPackageManager = await lambda._packageInstall(
        {
          ...program,
          packageManager
        },
        codeDirectory
      )
      assert.equal(usedPackageManager, packageManager)

      const contents = fs.readdirSync(path.join(codeDirectory, 'node_modules'))
      assert.include(contents, 'dotenv')

      // To remove and then install.
      // beforeDotenvStat.ctimeMs < afterDotenvStat.ctimeMs
      const afterDotenvStat = fs.statSync(path.join(codeDirectory, 'node_modules', 'dotenv'))
      assert.isBelow(beforeDotenvStat.ctimeMs, afterDotenvStat.ctimeMs)

      // Not installed with the `--production` option.
      assert.isFalse(fs.existsSync(nodeModulesMocha))
    }

    const beforeEachOptionalDependencies = () => {
      const packageJsonPath = path.join(codeDirectory, 'package.json')
      const packageJson = require(packageJsonPath)
      packageJson.optionalDependencies = { commander: '*' }
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson))

      // Remove package-lock.json because it does not match the package.json to which optionalDependencies was added.
      fs.removeSync(path.join(codeDirectory, 'package-lock.json'))
    }

    const testOptionalDependenciesIsInstalled = async (packageManager) => {
      const usedPackageManager = await lambda._packageInstall(
        {
          ...program,
          packageManager
        },
        codeDirectory
      )
      assert.equal(usedPackageManager, packageManager)

      const contents = fs.readdirSync(path.join(codeDirectory, 'node_modules'))
      assert.include(contents, 'commander')
    }

    const testOptionalDependenciesIsNotInstalled = async (packageManager) => {
      const params = {
        ...program,
        packageManager,
        optionalDependencies: false
      }
      const usedPackageManager = await lambda._packageInstall(params, codeDirectory)
      assert.equal(usedPackageManager, packageManager)

      const contents = fs.readdirSync(path.join(codeDirectory, 'node_modules'))
      assert.notInclude(contents, 'npm')
    }

    beforeEach(async () => {
      await lambda._cleanDirectory(codeDirectory)
      await lambda._fileCopy(program, sourceDirectoryForTest, codeDirectory, false)
    })

    describe('Use npm', () => {
      describe('when package-lock.json does exist', () => {
        it('should use "npm ci"', () => testCleanAndInstall('npm'))
      })

      describe('when package-lock.json does not exist', () => {
        beforeEach(() => {
          return fs.removeSync(path.join(codeDirectory, 'package-lock.json'))
        })

        it('should use "npm install"', () => {
          const beforeDotenvStat = fs.statSync(path.join(codeDirectory, 'node_modules', 'dotenv'))
          return lambda._packageInstall(program, codeDirectory).then((usedPackageManager) => {
            assert.equal(usedPackageManager, 'npm')

            const contents = fs.readdirSync(path.join(codeDirectory, 'node_modules'))
            assert.include(contents, 'dotenv')

            // Installed packages will remain intact.
            // beforeDotenvStat.ctimeMs === afterDotenvStat.ctimeMs
            const afterDotenvStat = fs.statSync(path.join(codeDirectory, 'node_modules', 'dotenv'))
            assert.equal(beforeDotenvStat.ctimeMs, afterDotenvStat.ctimeMs)

            // Not installed with the `--production` option.
            assert.isFalse(fs.existsSync(nodeModulesMocha))
          })
        })
      })

      describe('optionalDependencies', () => {
        beforeEach(beforeEachOptionalDependencies)

        describe('No `--no-optionalDependencies`', () => {
          it('optionalDependencies is installed', () => testOptionalDependenciesIsInstalled('npm'))
        })

        describe('With `--no-optionalDependencies`', () => {
          it('optionalDependency is NOT installed', () => testOptionalDependenciesIsNotInstalled('npm'))
        })
      })
    })

    describe('Use yarn', () => {
      it('should use "yarn install"', () => testCleanAndInstall('yarn'))

      describe('optionalDependencies', () => {
        beforeEach(beforeEachOptionalDependencies)

        describe('No `--ignore-optionalDependencies`', () => {
          it('optionalDependencies is installed', () => testOptionalDependenciesIsInstalled('yarn'))
        })

        describe('With `--ignore-optionalDependencies`', () => {
          it('optionalDependency is NOT installed', () => testOptionalDependenciesIsNotInstalled('yarn'))
        })
      })
    })
  })

  describe('_packageInstall (When codeDirectory contains characters to be escaped)', function () {
    _timeout({ this: this, sec: 30 }) // give it time to build the node modules

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

    const testFunc = async (packageManager) => {
      const usedPackageManager = await lambda._packageInstall(
        {
          ...program,
          packageManager
        },
        codeDirectory
      )
      assert.equal(usedPackageManager, packageManager)
      const contents = fs.readdirSync(codeDirectory)
      assert.include(contents, 'node_modules')
    }

    it('npm adds node_modules', () => testFunc('npm'))
    it('yarn adds node_modules', () => testFunc('yarn'))
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
    const captureStream = function (stream) {
      const oldWrite = stream.write
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
      return lambda._postInstallScript(program, codeDirectory).catch((err) => {
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

  describe('_zip', function () {
    _timeout({ this: this, sec: 60 }) // give it time to zip

    const beforeTask = async (packageManager) => {
      await lambda._cleanDirectory(codeDirectory)
      await lambda._fileCopy(program, sourceDirectoryForTest, codeDirectory, true)
      fs.copySync(path.join(__dirname, '..', 'bin', 'node-lambda'), path.join(codeDirectory, 'bin', 'node-lambda'))
      const usedPackageManager = await lambda._packageInstall(
        {
          ...program,
          packageManager
        },
        codeDirectory
      )
      assert.equal(usedPackageManager, packageManager)
      if (process.platform !== 'win32') {
        fs.symlinkSync(
          path.join(__dirname, '..', 'bin', 'node-lambda'),
          path.join(codeDirectory, 'node-lambda-link')
        )
      }
    }

    const testFunc = async (packageManager) => {
      // setup
      await beforeTask(packageManager)

      // tests
      const data = await lambda._zip(program, codeDirectory)
      const archive = new Zip(data)
      assert.include(archive.files['index.js'].name, 'index.js')
      assert.include(archive.files['bin/node-lambda'].name, 'bin/node-lambda')

      if (process.platform !== 'win32') {
        const indexJsStat = fs.lstatSync('index.js')
        const binNodeLambdaStat = fs.lstatSync(path.join('bin', 'node-lambda'))
        assert.equal(
          archive.files['index.js'].unixPermissions,
          indexJsStat.mode
        )
        assert.equal(
          archive.files['bin/node-lambda'].unixPermissions,
          binNodeLambdaStat.mode
        )

        // isSymbolicLink
        assert.include(archive.files['node-lambda-link'].name, 'node-lambda-link')
        assert.equal(
          archive.files['node-lambda-link'].unixPermissions & fs.constants.S_IFMT,
          fs.constants.S_IFLNK
        )
      }
    }

    describe('Use npm', () => {
      it(
        'Compress the file. `index.js` and `bin/node-lambda` are included and the permission is also preserved.',
        () => testFunc('npm')
      )
    })
    describe('Use yarn', () => {
      it(
        'Compress the file. `index.js` and `bin/node-lambda` are included and the permission is also preserved.',
        () => testFunc('yarn')
      )
    })
  })

  describe('_archive', () => {
    // archive.files's name is a slash delimiter regardless of platform.
    it('installs and zips with an index.js file and node_modules/dotenv (It is also a test of `_buildAndArchive`)', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip

      return lambda._archive({ ...program, sourceDirectory: sourceDirectoryForTest }).then((data) => {
        const archive = new Zip(data)
        const contents = Object.keys(archive.files).map((k) => {
          return archive.files[k].name.toString()
        })
        assert.include(contents, 'index.js')
        assert.include(contents, 'node_modules/dotenv/lib/main.js')
      })
    })

    it('packages a prebuilt module without installing (It is also a test of `_archivePrebuilt`)', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip
      const buildDir = '.build_' + Date.now()
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

    it('cleans the temporary directory before running `_archivePrebuilt`', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip
      const buildDir = '.build_' + Date.now()
      const codeDir = lambda._codeDirectory()
      const tmpFile = path.join(codeDir, 'deleteme')
      after(() => fs.removeSync(buildDir))

      fs.mkdirSync(codeDir, { recursive: true })
      fs.writeFileSync(tmpFile, '...')
      fs.mkdirSync(buildDir)
      fs.writeFileSync(path.join(buildDir, 'test'), '...')

      program.prebuiltDirectory = buildDir
      return lambda._archive(program).then((_data) => {
        assert.isNotTrue(fs.existsSync(tmpFile))
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
        const _program = {
          program,
          deployZipfile: filePath,
          sourceDirectory: sourceDirectoryForTest
        }
        _timeout({ this: this, sec: 30 }) // give it time to zip
        return lambda._archive(_program).then((data) => {
          // same test as "installs and zips with an index.js file and node_modules/dotenv"
          const archive = new Zip(data)
          const contents = Object.keys(archive.files).map((k) => {
            return archive.files[k].name.toString()
          })
          assert.include(contents, 'index.js')
          assert.include(contents, 'node_modules/dotenv/lib/main.js')
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

  describe('environment variable injection at runtime', () => {
    beforeEach(() => {
      // Prep...
      fs.writeFileSync('tmp.env', 'FOO=bar\nBAZ=bing\n')
    })

    afterEach(() => fs.unlinkSync('tmp.env'))

    it('should inject environment variables at runtime', () => {
      // Run it...
      lambda._setRunTimeEnvironmentVars({
        configFile: 'tmp.env'
      }, process.cwd())

      assert.equal(process.env.FOO, 'bar')
      assert.equal(process.env.BAZ, 'bing')
    })
  })

  describe('create sample files', () => {
    const targetFiles = [
      '.env',
      'context.json',
      'event.json',
      'deploy.env',
      'event_sources.json'
    ]

    after(() => {
      targetFiles.forEach((file) => fs.unlinkSync(file))
      program.eventSourceFile = ''
    })

    it('should create sample files', () => {
      lambda.setup(program)

      const libPath = path.join(__dirname, '..', 'lib')
      targetFiles.forEach((targetFile) => {
        const boilerplateFile = path.join(libPath, `${targetFile}.example`)

        assert.equal(
          fs.readFileSync(targetFile).toString(),
          fs.readFileSync(boilerplateFile).toString(),
          targetFile
        )
      })
    })

    describe('_eventSourceList', () => {
      it('program.eventSourceFile is empty value', () => {
        program.eventSourceFile = ''
        assert.deepEqual(
          lambda._eventSourceList(program),
          {
            EventSourceMappings: null,
            ScheduleEvents: null,
            S3Events: null
          }
        )
      })

      it('program.eventSourceFile is invalid value', () => {
        const dirPath = path.join(path.resolve('/hoge'), 'fuga')
        program.eventSourceFile = dirPath
        assert.throws(
          () => { lambda._eventSourceList(program) },
          Error,
          `ENOENT: no such file or directory, open '${dirPath}'`
        )
      })

      describe('program.eventSourceFile is valid value', () => {
        before(() => {
          fs.writeFileSync('only_EventSourceMappings.json', JSON.stringify({
            EventSourceMappings: [{ test: 1 }]
          }))
          fs.writeFileSync('only_ScheduleEvents.json', JSON.stringify({
            ScheduleEvents: [{ test: 2 }]
          }))
          fs.writeFileSync('only_S3Events.json', JSON.stringify({
            S3Events: [{ test: 3 }]
          }))
        })

        after(() => {
          fs.unlinkSync('only_EventSourceMappings.json')
          fs.unlinkSync('only_ScheduleEvents.json')
          fs.unlinkSync('only_S3Events.json')
        })

        it('only EventSourceMappings', () => {
          program.eventSourceFile = 'only_EventSourceMappings.json'
          const expected = {
            EventSourceMappings: [{ test: 1 }],
            ScheduleEvents: [],
            S3Events: []
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })

        it('only ScheduleEvents', () => {
          program.eventSourceFile = 'only_ScheduleEvents.json'
          const expected = {
            EventSourceMappings: [],
            ScheduleEvents: [{ test: 2 }],
            S3Events: []
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })

        it('only S3Events', () => {
          program.eventSourceFile = 'only_S3Events.json'
          const expected = {
            EventSourceMappings: [],
            ScheduleEvents: [],
            S3Events: [{ test: 3 }]
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })

        it('EventSourceMappings & ScheduleEvents', () => {
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
              ScheduleExpression: 'rate(1 hour)',
              Input: {
                key1: 'value',
                key2: 'value'
              }
            }],
            S3Events: [{
              Bucket: 'BUCKET_NAME',
              Events: [
                's3:ObjectCreated:*'
              ],
              Filter: {
                Key: {
                  FilterRules: [{
                    Name: 'prefix',
                    Value: 'STRING_VALUE'
                  }]
                }
              }
            }]
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })
      })

      describe('old style event_sources.json', () => {
        const oldStyleValue = [{
          BatchSize: 100,
          Enabled: true,
          EventSourceArn: 'your event source arn',
          StartingPosition: 'LATEST'
        }]
        const fileName = 'event_sources_old_style.json'

        before(() => fs.writeFileSync(fileName, JSON.stringify(oldStyleValue)))
        after(() => fs.unlinkSync(fileName))

        it('program.eventSourceFile is valid value', () => {
          program.eventSourceFile = fileName
          const expected = {
            EventSourceMappings: oldStyleValue,
            ScheduleEvents: [],
            S3Events: []
          }
          assert.deepEqual(lambda._eventSourceList(program), expected)
        })
      })
    })
  })

  describe('_listEventSourceMappings', () => {
    it('simple test with mock', () => {
      return lambda._listEventSourceMappings(
        lambdaClient,
        { FunctionName: 'test-func' }
      ).then((results) => {
        assert.deepEqual(
          results,
          lambdaMockSettings.listEventSourceMappings.EventSourceMappings
        )
      })
    })
  })

  describe('_getStartingPosition', () => {
    it('null in SQS', () => {
      assert.isNull(lambda._getStartingPosition({
        EventSourceArn: 'arn:aws:sqs:us-east-1:sqs-queuename1'
      }))
    })

    it('When there is no setting', () => {
      assert.equal(
        lambda._getStartingPosition({
          EventSourceArn: 'arn:aws:kinesis:test'
        }),
        'LATEST'
      )
    })

    it('With StartingPosition', () => {
      assert.equal(
        lambda._getStartingPosition({
          EventSourceArn: 'arn:aws:kinesis:test',
          StartingPosition: 'test position'
        }),
        'test position'
      )
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
        lambdaClient,
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
        lambdaClient,
        'functionName',
        [],
        eventSourceList.EventSourceMappings
      ).then((results) => {
        assert.deepEqual(results, [lambdaMockSettings.createEventSourceMapping])
      })
    })

    it('simple test with mock (In case of deletion)', () => {
      return lambda._updateEventSources(
        lambdaClient,
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
        lambdaClient,
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

  describe('_updateS3Events', () => {
    const S3Events = require(path.join('..', 'lib', 's3_events'))
    const eventSourcesJsonValue = {
      S3Events: [{
        Bucket: 'node-lambda-test-bucket',
        Events: ['s3:ObjectCreated:*'],
        Filter: null
      }]
    }

    let s3Events = null

    before(() => {
      fs.writeFileSync(
        'event_sources.json',
        JSON.stringify(eventSourcesJsonValue)
      )
      s3Events = new S3Events(aws)
    })

    after(() => fs.unlinkSync('event_sources.json'))

    it('program.eventSourceFile is empty value', () => {
      program.eventSourceFile = ''
      const eventSourceList = lambda._eventSourceList(program)
      return lambda._updateS3Events(
        s3Events,
        '',
        eventSourceList.S3Events
      ).then(results => {
        assert.deepEqual(results, [])
      })
    })

    it('simple test with mock', () => {
      program.eventSourceFile = 'event_sources.json'
      const eventSourceList = lambda._eventSourceList(program)
      const functionArn = 'arn:aws:lambda:us-west-2:XXX:function:node-lambda-test-function'
      return lambda._updateS3Events(
        s3Events,
        functionArn,
        eventSourceList.S3Events
      ).then(results => {
        const expected = [Object.assign(
          eventSourcesJsonValue.S3Events[0],
          { FunctionArn: functionArn }
        )]
        assert.deepEqual(results, expected)
      })
    })
  })

  describe('_uploadNew', () => {
    it('simple test with mock', () => {
      const params = lambda._params(program, null)
      return lambda._uploadNew(lambdaClient, params, (results) => {
        assert.deepEqual(results, lambdaMockSettings.createFunction)
      })
    })
  })

  describe('_uploadExisting', () => {
    it('simple test with mock', () => {
      const params = lambda._params(program, null)
      return lambda._uploadExisting(lambdaClient, params).then((results) => {
        assert.deepEqual(results, lambdaMockSettings.updateFunctionConfiguration)
      })
    })
  })

  describe('_setLogsRetentionPolicy', () => {
    const CloudWatchLogs = require(path.join('..', 'lib', 'cloudwatch_logs'))
    it('simple test with mock', () => {
      const params = lambda._params(program, null)
      return lambda._setLogsRetentionPolicy(
        new CloudWatchLogs({ region: 'us-east-1' }),
        program,
        params.FunctionName
      ).then((results) => {
        assert.deepEqual(results, { retentionInDays: program.retentionInDays })
      })
    })
  })

  describe('check env vars before create sample files', () => {
    const filesCreatedBySetup = [
      '.env',
      'deploy.env',
      'event_sources.json'
    ]

    beforeEach(() => {
      fs.writeFileSync('newContext.json', '{"FOO"="bar"\n"BAZ"="bing"\n}')
      fs.writeFileSync('newEvent.json', '{"FOO"="bar"}')
    })

    afterEach(() => {
      fs.unlinkSync('newContext.json')
      fs.unlinkSync('newEvent.json')
      filesCreatedBySetup.forEach((file) => fs.unlinkSync(file))
    })

    it('should use existing sample files', () => {
      program.eventFile = 'newEvent.json'
      program.contextFile = 'newContext.json'

      lambda.setup(program)

      assert.equal(fs.readFileSync('newContext.json').toString(), '{"FOO"="bar"\n"BAZ"="bing"\n}')
      assert.equal(fs.readFileSync('newEvent.json').toString(), '{"FOO"="bar"}')

      const libPath = path.join(__dirname, '..', 'lib')
      filesCreatedBySetup.forEach((targetFile) => {
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
    it('simple test with mock', () => {
      const params = lambda._params(program, null)
      return lambda._deployToRegion(program, params, 'us-east-1').then((result) => {
        assert.deepEqual(
          result,
          [
            [[], [], []],
            [],
            { retentionInDays: 30 }
          ]
        )
      })
    })
  })

  describe('Lambda.prototype.deploy()', () => {
    it('simple test with mock', function () {
      _timeout({ this: this, sec: 30 }) // give it time to zip
      return lambda.deploy({ ...program, sourceDirectory: sourceDirectoryForTest }).then((result) => {
        assert.isUndefined(result)
      })
    })
  })

  describe('Lambda.prototype._updateTags()', () => {
    it('simple test with mock', () => {
      return lambda._updateTags(
        lambdaClient,
        'arn:aws:lambda:eu-central-1:1234567:function:test',
        { tagKey: 'tagValue' }).then((result) => {
        assert.deepEqual(
          result, {}
        )
      })
    })
  })
})
