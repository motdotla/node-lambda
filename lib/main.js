'use strict'

const process = require('process')
const path = require('path')
const os = require('os')
const aws = require(path.join(__dirname, 'aws'))
const { exec, execSync, execFile } = require('child_process')
const fs = require('fs-extra')
const klaw = require('klaw')
const packageJson = require(path.join(__dirname, '..', 'package.json'))
const minimatch = require('minimatch')
const archiver = require('archiver')
const dotenv = require('dotenv')
const ScheduleEvents = require(path.join(__dirname, 'schedule_events'))
const S3Events = require(path.join(__dirname, 's3_events'))
const S3Deploy = require(path.join(__dirname, 's3_deploy'))
const CloudWatchLogs = require(path.join(__dirname, 'cloudwatch_logs'))

const AWSXRay = require('aws-xray-sdk-core')
const { createNamespace } = require('continuation-local-storage')

const maxBufferSize = 50 * 1024 * 1024

class Lambda {
  constructor () {
    this.version = packageJson.version
  }

  _createSampleFile (file, boilerplateName) {
    const exampleFile = path.join(process.cwd(), file)
    const boilerplateFile = path.join(
      __dirname,
      (boilerplateName || file) + '.example'
    )

    if (!fs.existsSync(exampleFile)) {
      fs.writeFileSync(exampleFile, fs.readFileSync(boilerplateFile))
      console.log(exampleFile + ' file successfully created')
    }
  }

  setup (program) {
    console.log('Running setup.')
    this._createSampleFile('.env', '.env')
    this._createSampleFile(program.eventFile, 'event.json')
    this._createSampleFile('deploy.env', 'deploy.env')
    this._createSampleFile(program.contextFile, 'context.json')
    this._createSampleFile('event_sources.json', 'event_sources.json')
    console.log(`Setup done.
Edit the .env, deploy.env, ${program.contextFile}, \
event_sources.json and ${program.eventFile} files as needed.`)
  }

  run (program) {
    if (!['nodejs12.x', 'nodejs14.x'].includes(program.runtime)) {
      console.error(`Runtime [${program.runtime}] is not supported.`)
      process.exit(254)
    }

    this._createSampleFile(program.eventFile, 'event.json')
    const splitHandler = program.handler.split('.')
    const filename = splitHandler[0] + '.js'
    const handlername = splitHandler[1]

    // Set custom environment variables if program.configFile is defined
    if (program.configFile) {
      this._setRunTimeEnvironmentVars(program)
    }

    const handler = require(path.join(process.cwd(), filename))[handlername]
    const event = require(path.join(process.cwd(), program.eventFile))
    const context = require(path.join(process.cwd(), program.contextFile))
    const enableRunMultipleEvents = (() => {
      if (typeof program.enableRunMultipleEvents === 'boolean') {
        return program.enableRunMultipleEvents
      }
      return program.enableRunMultipleEvents === 'true'
    })()

    if (Array.isArray(event) && enableRunMultipleEvents === true) {
      return this._runMultipleHandlers(event)
    }
    context.local = true
    const eventObject = (() => {
      if (program.apiGateway) {
        return this._convertToApiGatewayEvents(event)
      }
      return event
    })()
    this._runHandler(handler, eventObject, program, context)
  }

  _runHandler (handler, event, program, context) {
    const startTime = new Date()
    const timeout = Math.min(program.timeout, 900) * 1000 // convert the timeout into milliseconds

    const callback = (err, result) => {
      if (err) {
        process.exitCode = 255
        console.log('Error: ' + err)
      } else {
        process.exitCode = 0
        console.log('Success:')
        if (result) {
          console.log(JSON.stringify(result))
        }
      }
      if (context.callbackWaitsForEmptyEventLoop === false) {
        process.exit()
      }
    }

    context.getRemainingTimeInMillis = () => {
      const currentTime = new Date()
      return timeout - (currentTime - startTime)
    }

    // The following three functions are deprecated in AWS Lambda.
    // Since it is sometimes used by other SDK,
    // it is a simple one that does not result in `not function` error
    context.succeed = (result) => console.log(JSON.stringify(result))
    context.fail = (error) => console.log(JSON.stringify(error))
    context.done = (error, results) => {
      console.log(JSON.stringify(error))
      console.log(JSON.stringify(results))
    }

    const nameSpace = createNamespace('AWSXRay')
    nameSpace.run(() => {
      nameSpace.set('segment', new AWSXRay.Segment('annotations'))
      const result = handler(event, context, callback)
      if (result != null) {
        Promise.resolve(result).then(
          resolved => {
            console.log('Result:')
            console.log(JSON.stringify(resolved))
          },
          rejected => {
            console.log('Error:')
            console.log(rejected)
          }
        )
      }
    })
  }

  _runMultipleHandlers (events) {
    console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
Usually you will receive a single Object from AWS Lambda.
We added support for event.json to contain an array,
so you can easily test run multiple events.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`)

    const _argv = process.argv
    const eventFileOptionIndex = (() => {
      const index = _argv.indexOf('-j')
      if (index >= 0) return index
      return _argv.indexOf('--eventFile')
    })()
    _argv[0] = 'node' // For Windows support

    // In order to reproduce the logic of callbackWaitsForEmptyEventLoop,
    // we are going to execute `node-lambda run`.
    events.forEach((event, i) => {
      const tmpEventFile = `.${i}_tmp_event.json`
      const command = () => {
        if (eventFileOptionIndex === -1) {
          return _argv.concat(['-j', tmpEventFile]).join(' ')
        }
        _argv[eventFileOptionIndex + 1] = tmpEventFile
        return _argv.join(' ')
      }

      fs.writeFileSync(tmpEventFile, JSON.stringify(event))
      const stdout = execSync(command(), {
        maxBuffer: maxBufferSize,
        env: process.env
      })
      console.log('>>> Event:', event, '<<<')
      console.log(stdout.toString())
      fs.unlinkSync(tmpEventFile)
    })
  }

  _convertToApiGatewayEvents (event) {
    console.log(`!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
Emulate only the body of the API Gateway event.
!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
`)
    return {
      body: JSON.stringify(event)
    }
  }

  _isUseS3 (program) {
    if (typeof program.deployUseS3 === 'boolean') {
      return program.deployUseS3
    }
    return program.deployUseS3 === 'true'
  }

  _useECR (program) {
    return program.imageUri != null && program.imageUri.length > 0
  }

  _params (program, buffer) {
    const params = {
      FunctionName: program.functionName +
        (program.environment ? '-' + program.environment : '') +
        (program.lambdaVersion ? '-' + program.lambdaVersion : ''),
      Code: {},
      Handler: program.handler,
      Role: program.role,
      Runtime: program.runtime,
      Description: program.description,
      MemorySize: program.memorySize,
      Timeout: program.timeout,
      Architectures: program.architecture ? [program.architecture] : ['x86_64'],
      Publish: (() => {
        if (typeof program.publish === 'boolean') {
          return program.publish
        }
        return program.publish === 'true'
      })(),
      VpcConfig: {
        SubnetIds: [],
        SecurityGroupIds: []
      },
      Environment: {
        Variables: null
      },
      KMSKeyArn: program.kmsKeyArn,
      DeadLetterConfig: {
        TargetArn: null
      },
      TracingConfig: {
        Mode: null
      },
      Layers: [],
      Tags: {},
      PackageType: 'Zip'
    }

    if (this._isUseS3(program)) {
      params.Code = {
        S3Bucket: null,
        S3Key: null
      }
    } else if (this._useECR(program)) {
      params.Code = { ImageUri: program.imageUri }
      params.PackageType = 'Image'
      delete params.Handler
      delete params.Runtime
      delete params.KMSKeyArn
    } else {
      params.Code = { ZipFile: buffer }
    }

    // Escape characters that is not allowed by AWS Lambda
    params.FunctionName = params.FunctionName.replace(/[^a-zA-Z0-9-_]/g, '_')

    if (program.vpcSubnets && program.vpcSecurityGroups) {
      params.VpcConfig = {
        SubnetIds: program.vpcSubnets.split(','),
        SecurityGroupIds: program.vpcSecurityGroups.split(',')
      }
    }
    if (program.configFile) {
      const configValues = fs.readFileSync(program.configFile)
      const config = dotenv.parse(configValues)
      // If `configFile` is an empty file, `config` value will be `{}`
      params.Environment = {
        Variables: config
      }
    }
    if (program.deadLetterConfigTargetArn !== undefined) {
      params.DeadLetterConfig = {
        TargetArn: program.deadLetterConfigTargetArn
      }
    }
    if (program.tracingConfig) {
      params.TracingConfig.Mode = program.tracingConfig
    }
    if (program.layers) {
      params.Layers = program.layers.split(',')
    }
    if (program.tags) {
      const tags = program.tags.split(',')
      for (const tag of tags) {
        const kvPair = tag.split('=')
        if (kvPair && kvPair.length === 2) {
          params.Tags[kvPair[0].toString()] = kvPair[1].toString()
        }
      }
    }

    return params
  }

  _eventSourceList (program) {
    if (!program.eventSourceFile) {
      return {
        EventSourceMappings: null,
        ScheduleEvents: null,
        S3Events: null
      }
    }
    const list = fs.readJsonSync(program.eventSourceFile)

    if (Array.isArray(list)) {
      // backward-compatible
      return {
        EventSourceMappings: list,
        ScheduleEvents: [],
        S3Events: []
      }
    }
    if (!list.EventSourceMappings) {
      list.EventSourceMappings = []
    }
    if (!list.ScheduleEvents) {
      list.ScheduleEvents = []
    }
    if (!list.S3Events) {
      list.S3Events = []
    }
    return list
  }

  _fileCopy (program, src, dest, excludeNodeModules) {
    const excludes = (() => {
      return [
        '.git*',
        '*.swp',
        '.editorconfig',
        '.lambda',
        'deploy.env',
        '*.log'
      ]
        .concat(program.excludeGlobs ? program.excludeGlobs.split(' ') : [])
        .concat(excludeNodeModules ? [path.join('node_modules')] : [])
    })()

    // Formatting for `filter` of `fs.copy`
    const dirBlobs = []
    const pattern = '{' + excludes.map((str) => {
      if (str.charAt(str.length - 1) === path.sep) {
        str = str.substr(0, str.length - 1)
        dirBlobs.push(str)
      }
      return str
    }).join(',') + '}'
    const dirPatternRegExp = dirBlobs.length > 0 ? new RegExp(`(${dirBlobs.join('|')})$`) : null

    return new Promise((resolve, reject) => {
      fs.mkdirs(dest, (err) => {
        if (err) return reject(err)
        const options = {
          dereference: true, // same meaning as `-L` of `rsync` command
          filter: (src, dest) => {
            if (!program.prebuiltDirectory && ['package.json', 'package-lock.json'].includes(src)) {
              // include package.json & package-lock.json unless prebuiltDirectory is set
              return true
            }

            if (!minimatch(src, pattern, { matchBase: true })) {
              return true
            }

            // Directory check. Even if `src` is a directory it will not end with '/'.
            if (dirPatternRegExp === null || !dirPatternRegExp.test(src)) {
              return false
            }

            return !fs.statSync(src).isDirectory()
          }
        }
        fs.copy(src, dest, options, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  _shouldUseNpmCi (codeDirectory) {
    return fs.existsSync(path.join(codeDirectory, 'package-lock.json'))
  }

  _getNpmInstallCommand (program, codeDirectory) {
    const installOptions = [
      '-s',
      this._shouldUseNpmCi(codeDirectory) ? 'ci' : 'install',
      '--production',
      '--no-audit'
    ]

    if (program.optionalDependencies === false) {
      installOptions.push('--no-optional')
    }

    if (!program.dockerImage) {
      installOptions.push('--prefix', codeDirectory)
    }

    return {
      packageManager: 'npm',
      installOptions
    }
  }

  _getYarnInstallCommand (program, codeDirectory) {
    const installOptions = [
      '-s',
      'install',
      '--production'
    ]

    if (program.optionalDependencies === false) {
      installOptions.push('--ignore-optional')
    }

    if (!program.dockerImage) {
      installOptions.push('--cwd', codeDirectory)
    }

    return {
      packageManager: 'yarn',
      installOptions
    }
  }

  _packageInstall (program, codeDirectory) {
    if (!fs.existsSync(path.join(codeDirectory, 'package.json'))) {
      console.log('Skip the installation of the package. (Because package.json is not found.)')
      return
    }

    // Run on windows:
    // https://nodejs.org/api/child_process.html#child_process_spawning_bat_and_cmd_files_on_windows

    const { packageManager, installOptions } = (() => {
      // default npm
      if (program.packageManager === 'yarn') {
        return this._getYarnInstallCommand(program, codeDirectory)
      }
      return this._getNpmInstallCommand(program, codeDirectory)
    })()

    const paramsOnContainer = (() => {
      // with docker
      let dockerVolumesOptions = []
      program.dockerVolumes && program.dockerVolumes.split(' ').forEach((volume) => {
        dockerVolumesOptions = dockerVolumesOptions.concat(['-v', volume])
      })
      const dockerCommand = [program.dockerImage, packageManager].concat(installOptions)
      const dockerBaseOptions = [
        'run', '--rm',
        '-v', `${fs.realpathSync(codeDirectory)}:/var/task`,
        '-w', '/var/task'
      ]
      const dockerOptions = dockerBaseOptions.concat(dockerVolumesOptions).concat(dockerCommand)
      if (process.platform === 'win32') {
        return {
          command: 'cmd.exe',
          options: ['/c', 'docker'].concat(dockerOptions)
        }
      }
      return {
        command: 'docker',
        options: dockerOptions
      }
    })()

    const paramsOnHost = (() => {
      // simple install
      if (process.platform === 'win32') {
        return {
          command: 'cmd.exe',
          options: ['/c', packageManager].concat(installOptions)
        }
      }
      return {
        command: packageManager,
        options: installOptions
      }
    })()

    const params = program.dockerImage ? paramsOnContainer : paramsOnHost
    return new Promise((resolve, reject) => {
      execFile(params.command, params.options, {
        maxBuffer: maxBufferSize,
        env: process.env
      }, (err) => {
        if (err) return reject(err)
        resolve(packageManager)
      })
    })
  }

  _postInstallScript (program, codeDirectory) {
    const scriptFilename = 'post_install.sh'
    const filePath = path.join(codeDirectory, scriptFilename)
    if (!fs.existsSync(filePath)) return Promise.resolve()

    const cmd = path.join(codeDirectory, scriptFilename) + ' ' + program.environment
    console.log('=> Running post install script ' + scriptFilename)

    return new Promise((resolve, reject) => {
      exec(cmd, {
        env: process.env,
        cwd: codeDirectory,
        maxBuffer: maxBufferSize
      }, (error, stdout, stderr) => {
        if (error) {
          return reject(new Error(`${error} stdout: ${stdout} stderr: ${stderr}`))
        }
        console.log('\t\t' + stdout)
        resolve()
      })
    })
  }

  _zip (program, codeDirectory) {
    console.log('=> Zipping repo. This might take up to 30 seconds')

    const tmpZipFile = path.join(os.tmpdir(), +(new Date()) + '.zip')
    const output = fs.createWriteStream(tmpZipFile)
    const archive = archiver('zip', {
      zlib: { level: 9 } // Sets the compression level.
    })
    return new Promise((resolve) => {
      output.on('close', () => {
        const contents = fs.readFileSync(tmpZipFile)
        fs.unlinkSync(tmpZipFile)
        resolve(contents)
      })
      archive.pipe(output)
      klaw(codeDirectory, { preserveSymlinks: true })
        .on('data', (file) => {
          if (file.stats.isDirectory()) return

          const filePath = file.path.replace(path.join(codeDirectory, path.sep), '')
          if (file.stats.isSymbolicLink()) {
            return archive.symlink(filePath, fs.readlinkSync(file.path))
          }

          archive.append(
            fs.createReadStream(file.path),
            {
              name: filePath,
              stats: file.stats
            }
          )
        })
        .on('end', () => {
          archive.finalize()
        })
    })
  }

  _codeDirectory () {
    // Why realpathSync?:
    // If tmpdir is symbolic link and npm>=7, `this._packageInstall()` may not work properly.
    return path.join(fs.realpathSync(os.tmpdir()), `${path.basename(path.resolve('.'))}-lambda`)
  }

  _cleanDirectory (codeDirectory, keepNodeModules) {
    if (!fs.existsSync(codeDirectory)) {
      return new Promise((resolve, reject) => {
        fs.mkdirs(codeDirectory, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    }
    return new Promise((resolve, reject) => {
      fs.readdir(codeDirectory, (err, files) => {
        if (err) return reject(err)

        Promise.all(files.map(file => {
          return new Promise((resolve, reject) => {
            if (keepNodeModules && file === 'node_modules') {
              resolve()
            } else {
              fs.remove(path.join(codeDirectory, file), err => {
                if (err) return reject(err)
                resolve()
              })
            }
          })
        })).then(() => {
          resolve()
        })
      })
    })
  }

  _setRunTimeEnvironmentVars (program) {
    const configValues = fs.readFileSync(program.configFile)
    const config = dotenv.parse(configValues)

    for (const k in config) {
      if (!Object.getOwnPropertyDescriptor(config, k)) {
        continue
      }

      process.env[k] = config[k]
    }
  }

  async _uploadExisting (lambda, params) {
    const functionCodeParams = Object.assign({
      FunctionName: params.FunctionName,
      Publish: params.Publish,
      Architectures: params.Architectures
    }, params.Code)

    const functionConfigParams = {
      FunctionName: params.FunctionName,
      Description: params.Description,
      Handler: params.Handler,
      MemorySize: params.MemorySize,
      Role: params.Role,
      Timeout: params.Timeout,
      Runtime: params.Runtime,
      VpcConfig: params.VpcConfig,
      Environment: params.Environment,
      KMSKeyArn: params.KMSKeyArn,
      DeadLetterConfig: params.DeadLetterConfig,
      TracingConfig: params.TracingConfig,
      Layers: params.Layers
    }
    if (functionCodeParams.ImageUri != null) {
      delete functionConfigParams.Handler
      delete functionConfigParams.Runtime
      delete functionConfigParams.KMSKeyArn
      delete functionConfigParams.Layers
    }

    const updateConfigRequest = lambda.updateFunctionConfiguration(functionConfigParams)
    updateConfigRequest.on('retry', (response) => {
      console.log(response.error.message)
      console.log('=> Retrying')
    })
    const updateConfigResponse = await updateConfigRequest.promise()

    // Wait for the `Configuration.LastUpdateStatus` to change from `InProgress` to `Successful`.
    for (let i = 0; i < 10; i++) {
      const data = await lambda.getFunction({ FunctionName: params.FunctionName }).promise()
      if (data.Configuration.LastUpdateStatus === 'Successful') {
        break
      }
      await new Promise((resolve) => setTimeout(resolve, 3000))
    }

    const updateCodeRequest = lambda.updateFunctionCode(functionCodeParams)
    updateCodeRequest.on('retry', (response) => {
      console.log(response.error.message)
      console.log('=> Retrying')
    })
    await updateCodeRequest.promise()

    return updateConfigResponse
  }

  _uploadNew (lambda, params) {
    return new Promise((resolve, reject) => {
      const request = lambda.createFunction(params, (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
      request.on('retry', (response) => {
        console.log(response.error.message)
        console.log('=> Retrying')
      })
    })
  }

  _readArchive (program) {
    if (!fs.existsSync(program.deployZipfile)) {
      const err = new Error('No such Zipfile [' + program.deployZipfile + ']')
      return Promise.reject(err)
    }
    return new Promise((resolve, reject) => {
      fs.readFile(program.deployZipfile, (err, data) => {
        if (err) return reject(err)
        resolve(data)
      })
    })
  }

  _archive (program) {
    if (program.deployZipfile && fs.existsSync(program.deployZipfile)) {
      return this._readArchive(program)
    }
    return program.prebuiltDirectory
      ? this._archivePrebuilt(program)
      : this._buildAndArchive(program)
  }

  _archivePrebuilt (program) {
    const codeDirectory = this._codeDirectory()

    return Promise.resolve().then(() => {
      return this._cleanDirectory(codeDirectory, program.keepNodeModules)
    }).then(() => {
      return this._fileCopy(program, program.prebuiltDirectory, codeDirectory, false).then(() => {
        console.log('=> Zipping deployment package')
        return this._zip(program, codeDirectory)
      })
    })
  }

  async _buildAndArchive (program) {
    if (!fs.existsSync('.env')) {
      console.warn('[Warning] `.env` file does not exist.')
      console.info('Execute `node-lambda setup` as necessary and set it up.')
    }

    // Warn if not building on 64-bit linux
    const arch = process.platform + '.' + process.arch
    if (arch !== 'linux.x64' && !program.dockerImage) {
      console.warn(`Warning!!! You are building on a platform that is not 64-bit Linux (${arch}).
If any of your Node dependencies include C-extensions, \
they may not work as expected in the Lambda environment.

`)
    }

    const codeDirectory = this._codeDirectory()
    const lambdaSrcDirectory = program.sourceDirectory ? program.sourceDirectory.replace(/\/$/, '') : '.'

    await this._cleanDirectory(codeDirectory, program.keepNodeModules)
    console.log('=> Moving files to temporary directory')
    await this._fileCopy(program, lambdaSrcDirectory, codeDirectory, true)
    if (!program.keepNodeModules) {
      console.log('=> Running package install')
      const usedPackageManager = await this._packageInstall(program, codeDirectory)
      if (usedPackageManager) {
        console.log(`(Package manager used was '${usedPackageManager}'.)`)
      }
    }
    await this._postInstallScript(program, codeDirectory)
    console.log('=> Zipping deployment package')
    return this._zip(program, codeDirectory)
  }

  _listEventSourceMappings (lambda, params) {
    return new Promise((resolve, reject) => {
      lambda.listEventSourceMappings(params, (err, data) => {
        if (err) return reject(err)
        if (data && data.EventSourceMappings) {
          return resolve(data.EventSourceMappings)
        }
        return resolve([])
      })
    })
  }

  _getStartingPosition (eventSource) {
    if (eventSource.EventSourceArn.startsWith('arn:aws:sqs:')) {
      return null
    }
    return eventSource.StartingPosition ? eventSource.StartingPosition : 'LATEST'
  }

  _updateEventSources (lambda, functionName, existingEventSourceList, eventSourceList) {
    if (eventSourceList == null) {
      return Promise.resolve([])
    }
    const updateEventSourceList = []
    // Checking new and update event sources
    for (const i in eventSourceList) {
      let isExisting = false
      for (const j in existingEventSourceList) {
        if (eventSourceList[i].EventSourceArn === existingEventSourceList[j].EventSourceArn) {
          isExisting = true
          updateEventSourceList.push({
            type: 'update',
            FunctionName: functionName,
            Enabled: eventSourceList[i].Enabled,
            BatchSize: eventSourceList[i].BatchSize,
            UUID: existingEventSourceList[j].UUID
          })
          break
        }
      }

      // If it is new source
      if (!isExisting) {
        updateEventSourceList.push({
          type: 'create',
          FunctionName: functionName,
          EventSourceArn: eventSourceList[i].EventSourceArn,
          Enabled: eventSourceList[i].Enabled ? eventSourceList[i].Enabled : false,
          BatchSize: eventSourceList[i].BatchSize ? eventSourceList[i].BatchSize : 100,
          StartingPosition: this._getStartingPosition(eventSourceList[i])
        })
      }
    }

    // Checking delete event sources
    for (const i in existingEventSourceList) {
      let isExisting = false
      for (const j in eventSourceList) {
        if (eventSourceList[j].EventSourceArn === existingEventSourceList[i].EventSourceArn) {
          isExisting = true
          break
        }
      }

      // If delete the source
      if (!isExisting) {
        updateEventSourceList.push({
          type: 'delete',
          UUID: existingEventSourceList[i].UUID
        })
      }
    }

    return Promise.all(updateEventSourceList.map((updateEventSource) => {
      switch (updateEventSource.type) {
        case 'create':
          delete updateEventSource.type
          return new Promise((resolve, reject) => {
            lambda.createEventSourceMapping(updateEventSource, (err, data) => {
              if (err) return reject(err)
              resolve(data)
            })
          })
        case 'update':
          delete updateEventSource.type
          return new Promise((resolve, reject) => {
            lambda.updateEventSourceMapping(updateEventSource, (err, data) => {
              if (err) return reject(err)
              resolve(data)
            })
          })
        case 'delete':
          delete updateEventSource.type
          return new Promise((resolve, reject) => {
            lambda.deleteEventSourceMapping(updateEventSource, (err, data) => {
              if (err) return reject(err)
              resolve(data)
            })
          })
      }
      return Promise.resolve()
    }))
  }

  _updateTags (lambda, functionArn, tags) {
    if (!tags || Object.keys(tags).length <= 0) {
      return Promise.resolve([])
    } else {
      return lambda.listTags({ Resource: functionArn }).promise()
        .then(data => {
          const keys = Object.keys(data.Tags)
          return keys && keys.length > 0
            ? lambda.untagResource({ Resource: functionArn, TagKeys: keys }).promise()
            : Promise.resolve()
        })
        .then(() => {
          return lambda.tagResource({ Resource: functionArn, Tags: tags }).promise()
        })
    }
  }

  _updateScheduleEvents (scheduleEvents, functionArn, scheduleList) {
    if (scheduleList == null) {
      return Promise.resolve([])
    }

    const paramsList = scheduleList.map((schedule) =>
      Object.assign(schedule, { FunctionArn: functionArn }))

    // series
    return paramsList.map((params) => {
      return scheduleEvents.add(params)
    }).reduce((a, b) => {
      return a.then(b)
    }, Promise.resolve()).then(() => {
      // Since `scheduleEvents.add(params)` returns only `{}` if it succeeds
      // it is not very meaningful.
      // Therefore, return the params used for execution
      return paramsList
    })
  }

  _updateS3Events (s3Events, functionArn, s3EventsList) {
    if (s3EventsList == null) return Promise.resolve([])

    const paramsList = s3EventsList.map(s3event =>
      Object.assign(s3event, { FunctionArn: functionArn }))

    return s3Events.add(paramsList).then(() => {
      // Since it is similar to _updateScheduleEvents, it returns meaningful values
      return paramsList
    })
  }

  _setLogsRetentionPolicy (cloudWatchLogs, program, functionName) {
    const days = parseInt(program.retentionInDays)
    if (!Number.isInteger(days)) return Promise.resolve({})
    return cloudWatchLogs.setLogsRetentionPolicy({
      FunctionName: functionName,
      retentionInDays: days
    }).then(() => {
      // Since it is similar to _updateScheduleEvents, it returns meaningful values
      return { retentionInDays: days }
    })
  }

  package (program) {
    if (!program.packageDirectory) {
      throw new Error('packageDirectory not specified!')
    }
    try {
      const isDir = fs.lstatSync(program.packageDirectory).isDirectory()

      if (!isDir) {
        throw new Error(program.packageDirectory + ' is not a directory!')
      }
    } catch (err) {
      if (err.code !== 'ENOENT') {
        throw err
      }
      console.log('=> Creating package directory')
      fs.mkdirsSync(program.packageDirectory)
    }

    return this._archive(program).then((buffer) => {
      const basename = program.functionName + (program.environment ? '-' + program.environment : '')
      const zipfile = path.join(program.packageDirectory, basename + '.zip')
      console.log('=> Writing packaged zip')
      fs.writeFile(zipfile, buffer, (err) => {
        if (err) {
          throw err
        }
        console.log('Packaged zip created: ' + zipfile)
      })
    }).catch((err) => {
      throw err
    })
  }

  _isFunctionDoesNotExist (err) {
    return err.code === 'ResourceNotFoundException' &&
      !!err.message.match(/^Function not found:/)
  }

  _deployToRegion (program, params, region, buffer) {
    aws.updateConfig(program, region)

    console.log('=> Reading event source file to memory')
    const eventSourceList = this._eventSourceList(program)

    return Promise.resolve().then(() => {
      if (this._isUseS3(program)) {
        const s3Deploy = new S3Deploy(aws.sdk, region)
        return s3Deploy.putPackage(params, region, buffer)
      }
      return null
    }).then((code) => {
      if (code != null) params.Code = code
    }).then(() => {
      if (!this._isUseS3(program)) {
        console.log(`=> Uploading zip file to AWS Lambda ${region} with parameters:`)
      } else {
        console.log(`=> Uploading AWS Lambda ${region} with parameters:`)
      }
      console.log(params)

      const lambda = new aws.sdk.Lambda({
        region,
        apiVersion: '2015-03-31'
      })
      const scheduleEvents = new ScheduleEvents(aws.sdk, region)
      const s3Events = new S3Events(aws.sdk, region)
      const cloudWatchLogs = new CloudWatchLogs(aws.sdk, region)

      // Checking function
      return lambda.getFunction({
        FunctionName: params.FunctionName
      }).promise().then(() => {
        // Function exists
        return this._listEventSourceMappings(lambda, {
          FunctionName: params.FunctionName
        }).then((existingEventSourceList) => {
          return Promise.all([
            this._uploadExisting(lambda, params).then((results) => {
              console.log('=> Done uploading. Results follow: ')
              console.log(results)
              return results
            }).then(results => {
              return Promise.all([
                this._updateScheduleEvents(
                  scheduleEvents,
                  results.FunctionArn,
                  eventSourceList.ScheduleEvents
                ),
                this._updateS3Events(
                  s3Events,
                  results.FunctionArn,
                  eventSourceList.S3Events
                ),
                this._updateTags(
                  lambda,
                  results.FunctionArn,
                  params.Tags)
              ])
            }),
            this._updateEventSources(
              lambda,
              params.FunctionName,
              existingEventSourceList,
              eventSourceList.EventSourceMappings
            ),
            this._setLogsRetentionPolicy(
              cloudWatchLogs,
              program,
              params.FunctionName
            )
          ])
        })
      }).catch((err) => {
        if (!this._isFunctionDoesNotExist(err)) {
          throw err
        }
        // Function does not exist
        return this._uploadNew(lambda, params).then((results) => {
          console.log('=> Done uploading. Results follow: ')
          console.log(results)

          return Promise.all([
            this._updateEventSources(
              lambda,
              params.FunctionName,
              [],
              eventSourceList.EventSourceMappings
            ),
            this._updateScheduleEvents(
              scheduleEvents,
              results.FunctionArn,
              eventSourceList.ScheduleEvents
            ),
            this._updateS3Events(
              s3Events,
              results.FunctionArn,
              eventSourceList.S3Events
            ),
            this._setLogsRetentionPolicy(
              cloudWatchLogs,
              program,
              params.FunctionName
            )
          ])
        })
      })
    })
  }

  _printDeployResults (results, isFirst) {
    if (!Array.isArray(results)) {
      if (results == null) return
      console.log(results)
      return
    }
    if (results.length === 0) return

    if (isFirst === true) console.log('=> All tasks done. Results follow:')
    results.forEach(result => {
      this._printDeployResults(result)
    })
  }

  async deploy (program) {
    const regions = program.region.split(',')
    let buffer = null
    if (!this._useECR(program)) {
      try {
        buffer = await this._archive(program)
        console.log('=> Reading zip file to memory')
      } catch (err) {
        process.exitCode = 1
        console.log(err)
        return
      }
    }

    try {
      const params = this._params(program, buffer)
      const results = await Promise.all(regions.map((region) => {
        return this._deployToRegion(
          program,
          params,
          region,
          this._isUseS3(program) ? buffer : null
        )
      }))
      this._printDeployResults(results, true)
    } catch (err) {
      process.exitCode = 1
      console.log(err)
    }
  }
}

module.exports = new Lambda()
