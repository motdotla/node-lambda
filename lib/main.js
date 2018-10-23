'use strict'

const path = require('path')
const os = require('os')
const aws = require('aws-sdk')
const { exec, execSync, execFile } = require('child_process')
const fs = require('fs-extra')
const klaw = require('klaw')
const packageJson = require(path.join(__dirname, '..', 'package.json'))
const minimatch = require('minimatch')
const archiver = require('archiver')
const dotenv = require('dotenv')
const proxy = require('proxy-agent')
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
    if (!['nodejs4.3', 'nodejs6.10', 'nodejs8.10'].includes(program.runtime)) {
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
    this._runHandler(handler, event, program, context)
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

  _isUseS3 (program) {
    if (typeof program.deployUseS3 === 'boolean') {
      return program.deployUseS3
    }
    return program.deployUseS3 === 'true'
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
      }
    }

    if (this._isUseS3(program)) {
      params.Code = {
        S3Bucket: null,
        S3Key: null
      }
    } else {
      params.Code = { ZipFile: buffer }
    }

    // Escape characters that is not allowed by AWS Lambda
    params.FunctionName = params.FunctionName.replace(/[^a-zA-Z0-9-_]/g, '_')

    if (program.vpcSubnets && program.vpcSecurityGroups) {
      params.VpcConfig = {
        'SubnetIds': program.vpcSubnets.split(','),
        'SecurityGroupIds': program.vpcSecurityGroups.split(',')
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
        '*.log',
        path.join('build', path.sep)
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
    const dirPatternRegExp = new RegExp(`(${dirBlobs.join('|')})$`)

    return new Promise((resolve, reject) => {
      fs.mkdirs(dest, (err) => {
        if (err) return reject(err)
        const options = {
          dereference: true, // same meaning as `-L` of `rsync` command
          filter: (src, dest) => {
            if (!program.prebuiltDirectory && src === 'package.json') {
              // include package.json unless prebuiltDirectory is set
              return true
            }

            if (!minimatch(src, pattern, { matchBase: true })) {
              return true
            }
            // Directory check. Even if `src` is a directory it will not end with '/'.
            if (!dirPatternRegExp.test(src)) {
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

  _npmInstall (program, codeDirectory) {
    const dockerBaseOptions = [
      'run', '--rm', '-v', `${codeDirectory}:/var/task`, '-w', '/var/task',
      program.dockerImage,
      'npm', '-s', 'install', '--production'
    ]
    const npmInstallBaseOptions = [
      '-s',
      'install',
      '--production',
      '--prefix', codeDirectory
    ]

    const params = (() => {
      // reference: https://nodejs.org/api/child_process.html#child_process_spawning_bat_and_cmd_files_on_windows

      // with docker
      if (program.dockerImage) {
        if (process.platform === 'win32') {
          return {
            command: 'cmd.exe',
            options: ['/c', 'docker'].concat(dockerBaseOptions)
          }
        }
        return {
          command: 'docker',
          options: dockerBaseOptions
        }
      }

      // simple npm install
      if (process.platform === 'win32') {
        return {
          command: 'cmd.exe',
          options: ['/c', 'npm']
            .concat(npmInstallBaseOptions)
            .concat(['--cwd', codeDirectory])
        }
      }
      return {
        command: 'npm',
        options: npmInstallBaseOptions
      }
    })()

    return new Promise((resolve, reject) => {
      execFile(params.command, params.options, {
        maxBuffer: maxBufferSize,
        env: process.env
      }, (err) => {
        if (err) return reject(err)
        resolve()
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
      klaw(codeDirectory)
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
    return path.join(os.tmpdir(), `${path.basename(path.resolve('.'))}-lambda`)
  }

  _cleanDirectory (codeDirectory) {
    return new Promise((resolve, reject) => {
      fs.remove(codeDirectory, (err) => {
        if (err) return reject(err)
        resolve()
      })
    }).then(() => {
      return new Promise((resolve, reject) => {
        fs.mkdirs(codeDirectory, (err) => {
          if (err) return reject(err)
          resolve()
        })
      })
    })
  }

  _setRunTimeEnvironmentVars (program) {
    const configValues = fs.readFileSync(program.configFile)
    const config = dotenv.parse(configValues)

    for (let k in config) {
      if (!config.hasOwnProperty(k)) {
        continue
      }

      process.env[k] = config[k]
    }
  }

  _uploadExisting (lambda, params) {
    const _params = Object.assign({
      'FunctionName': params.FunctionName,
      'Publish': params.Publish
    }, params.Code)
    return new Promise((resolve, reject) => {
      const request = lambda.updateFunctionCode(_params, (err) => {
        if (err) return reject(err)

        lambda.updateFunctionConfiguration({
          'FunctionName': params.FunctionName,
          'Description': params.Description,
          'Handler': params.Handler,
          'MemorySize': params.MemorySize,
          'Role': params.Role,
          'Timeout': params.Timeout,
          'Runtime': params.Runtime,
          'VpcConfig': params.VpcConfig,
          'Environment': params.Environment,
          'KMSKeyArn': params.KMSKeyArn,
          'DeadLetterConfig': params.DeadLetterConfig,
          'TracingConfig': params.TracingConfig
        }, (err, data) => {
          if (err) return reject(err)
          resolve(data)
        })
      })

      request.on('retry', (response) => {
        console.log(response.error.message)
        console.log('=> Retrying')
      })
    })
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

    return this._fileCopy(program, program.prebuiltDirectory, codeDirectory, false).then(() => {
      console.log('=> Zipping deployment package')
      return this._zip(program, codeDirectory)
    })
  }

  _buildAndArchive (program) {
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

    return Promise.resolve().then(() => {
      return this._cleanDirectory(codeDirectory)
    }).then(() => {
      console.log('=> Moving files to temporary directory')
      return this._fileCopy(program, lambdaSrcDirectory, codeDirectory, true)
    }).then(() => {
      console.log('=> Running npm install --production')
      return this._npmInstall(program, codeDirectory)
    }).then(() => {
      return this._postInstallScript(program, codeDirectory)
    }).then(() => {
      console.log('=> Zipping deployment package')
      return this._zip(program, codeDirectory)
    })
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
    if (eventSource.EventSourceArn.indexOf('arn:aws:sqs:') === 0) {
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
    for (let i in eventSourceList) {
      let isExisting = false
      for (let j in existingEventSourceList) {
        if (eventSourceList[i]['EventSourceArn'] === existingEventSourceList[j]['EventSourceArn']) {
          isExisting = true
          updateEventSourceList.push({
            'type': 'update',
            'FunctionName': functionName,
            'Enabled': eventSourceList[i]['Enabled'],
            'BatchSize': eventSourceList[i]['BatchSize'],
            'UUID': existingEventSourceList[j]['UUID']
          })
          break
        }
      }

      // If it is new source
      if (!isExisting) {
        updateEventSourceList.push({
          'type': 'create',
          'FunctionName': functionName,
          'EventSourceArn': eventSourceList[i]['EventSourceArn'],
          'Enabled': eventSourceList[i]['Enabled'] ? eventSourceList[i]['Enabled'] : false,
          'BatchSize': eventSourceList[i]['BatchSize'] ? eventSourceList[i]['BatchSize'] : 100,
          'StartingPosition': this._getStartingPosition(eventSourceList[i])
        })
      }
    }

    // Checking delete event sources
    for (let i in existingEventSourceList) {
      let isExisting = false
      for (let j in eventSourceList) {
        if (eventSourceList[j]['EventSourceArn'] === existingEventSourceList[i]['EventSourceArn']) {
          isExisting = true
          break
        }
      }

      // If delete the source
      if (!isExisting) {
        updateEventSourceList.push({
          'type': 'delete',
          'UUID': existingEventSourceList[i]['UUID']
        })
      }
    }

    return Promise.all(updateEventSourceList.map((updateEventSource) => {
      switch (updateEventSource['type']) {
        case 'create':
          delete updateEventSource['type']
          return new Promise((resolve, reject) => {
            lambda.createEventSourceMapping(updateEventSource, (err, data) => {
              if (err) return reject(err)
              resolve(data)
            })
          })
        case 'update':
          delete updateEventSource['type']
          return new Promise((resolve, reject) => {
            lambda.updateEventSourceMapping(updateEventSource, (err, data) => {
              if (err) return reject(err)
              resolve(data)
            })
          })
        case 'delete':
          delete updateEventSource['type']
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

  _awsConfigUpdate (program, region) {
    const awsSecurity = { region: region }

    if (program.profile) {
      aws.config.credentials = new aws.SharedIniFileCredentials({
        profile: program.profile
      })
    } else {
      awsSecurity.accessKeyId = program.accessKey
      awsSecurity.secretAccessKey = program.secretKey
    }

    if (program.sessionToken) {
      awsSecurity.sessionToken = program.sessionToken
    }

    if (program.deployTimeout) {
      aws.config.httpOptions.timeout = parseInt(program.deployTimeout)
    }

    if (program.proxy) {
      aws.config.httpOptions.agent = proxy(program.proxy)
    }

    if (program.endpoint) {
      aws.config.endpoint = program.endpoint
    }

    aws.config.update(awsSecurity)
  }

  _isFunctionDoesNotExist (err) {
    return err.code === 'ResourceNotFoundException' &&
      !!err.message.match(/^Function not found:/)
  }

  _deployToRegion (program, params, region, buffer) {
    this._awsConfigUpdate(program, region)

    console.log('=> Reading event source file to memory')
    const eventSourceList = this._eventSourceList(program)

    return Promise.resolve().then(() => {
      if (this._isUseS3(program)) {
        const s3Deploy = new S3Deploy(aws, region)
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

      const lambda = new aws.Lambda({
        region: region,
        apiVersion: '2015-03-31'
      })
      const scheduleEvents = new ScheduleEvents(aws, region)
      const s3Events = new S3Events(aws, region)
      const cloudWatchLogs = new CloudWatchLogs(aws, region)

      // Checking function
      return lambda.getFunction({
        'FunctionName': params.FunctionName
      }).promise().then(() => {
        // Function exists
        return this._listEventSourceMappings(lambda, {
          'FunctionName': params.FunctionName
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
                )
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

  deploy (program) {
    const regions = program.region.split(',')
    return this._archive(program).then((buffer) => {
      console.log('=> Reading zip file to memory')
      return buffer
    }).then((buffer) => {
      const params = this._params(program, buffer)

      return Promise.all(regions.map((region) => {
        return this._deployToRegion(
          program,
          params,
          region,
          this._isUseS3(program) ? buffer : null
        )
      })).then(results => {
        this._printDeployResults(results, true)
      })
    }).catch((err) => {
      process.exitCode = 1
      console.log(err)
    })
  }
}

module.exports = new Lambda()
