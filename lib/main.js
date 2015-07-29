'use strict';

var aws = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var os = require('os');
var packageJson = require('./../package.json');
var path = require('path');
var async = require('async');
var zip = new require('node-zip')();
var wrench = require('wrench');

var Lambda = function() {
  this.version = packageJson.version;

  return this;
};

Lambda.prototype._createSampleFile = function(file) {
  var exampleFile = process.cwd() + '/' + file;
  var boilerplateFile = __dirname + '/' + file + '.example';

  if (!fs.existsSync(exampleFile)) {
    fs.writeFileSync(exampleFile, fs.readFileSync(boilerplateFile));
    console.log(exampleFile + ' file successfully created');
  }
};

Lambda.prototype.setup = function() {
  console.log('Running setup.');
  this._createSampleFile('.env');
  this._createSampleFile('event.json');
  console.log('Setup done. Edit the .env and event.json files as needed.');
};

Lambda.prototype.run = function(program) {
  this._createSampleFile('event.json');

  var dir = program.directory;
  var splitHandler = program.handler.split('.');
  var filename = splitHandler[0] + '.js';
  var handlername = splitHandler[1];

  var handler = require(process.cwd() + '/' + filename)[handlername];
  var event = require(process.cwd() + '/event.json');

  this._runHandler(handler, event);
};

Lambda.prototype._runHandler = function(handler, event) {
  var context = {
    succeed: function(result) {
      console.log('succeed: ' + result);
      process.exit(0);
    },
    fail: function(error) {
      console.log('fail: ' + error);
      process.exit(-1);
    },
    done: function() {
      process.exit(0);
    }
  };

  handler(event, context);
};

Lambda.prototype._params = function(program, buffer)  {
  var params = {
    FunctionName: program.functionName + '-' + program.environment,
    FunctionZip: buffer,
    Handler: program.handler,
    Mode: program.mode,
    Role: program.role,
    Runtime: program.runtime,
    Description: program.description,
    MemorySize: program.memorySize,
    Timeout: program.timeout
  };
  params.FunctionName += (program.version ? '-' + program.version.replace(/\./g, '-'): '');

  return params;
};

Lambda.prototype._zipfileTmpPath = function(program) {
  var ms_since_epoch = +new Date;
  var filename = program.functionName + '-' + ms_since_epoch + '.zip';
  var zipfile = path.join(os.tmpDir(), filename);

  return zipfile;
};

Lambda.prototype._rsync = function(program, codeDirectory, callback) {
  exec('rsync -r --exclude=.git --exclude=*.log --exclude=node_modules . ' + codeDirectory, function(err, stdout, stderr) {
    if (err) {
      throw err;
    }

    return callback(null, true);
  });
};

Lambda.prototype._npmInstall = function(program, codeDirectory, callback) {
  exec('npm install --production --prefix ' + codeDirectory, function(err, stdout, stderr) {
    if (err) {
      throw err;
    }

    return callback(null, true);
  });
};

Lambda.prototype._zip = function(program, codeDirectory, callback) {
  var zipfile = this._zipfileTmpPath(program);

  var options = {
    type: 'nodebuffer',
    compression: 'DEFLATE'
  }

  console.log('Zipping repo. This might take up to 30 seconds');
  var files = wrench.readdirSyncRecursive(codeDirectory);
  files.forEach(function(file) {
    var filePath = [codeDirectory, file].join('/');
    var isFile = fs.lstatSync(filePath).isFile();
    if (isFile) {
      var content = fs.readFileSync(filePath);
      zip.file(file, content);
    }
  });

  var data = zip.generate(options);

  return callback(null, data);
};

Lambda.prototype._nativeZip = function(program, codeDirectory, callback) {
  var zipfile = this._zipfileTmpPath(program)
    , cmd = 'zip -r ' + zipfile + ' .'
    , run = exec(cmd, { cwd: codeDirectory }, function (err, stdout, stderr) {
        if (err !== null) {
          return callback(err, null)
        }

        var data = fs.readFileSync(zipfile)
        callback(null, data)
    })
};

Lambda.prototype._codeDirectory = function(program) {
  var epoch_time = +new Date;
  return os.tmpDir() + '/' + program.functionName + '-' + epoch_time;
};

Lambda.prototype.deploy = function(program) {
  this._createSampleFile('.env');

  var _this = this;
  var regions = program.region.split(',');
  var codeDirectory = _this._codeDirectory(program);

  // Move all files to tmp folder (except .git, .log, event.json and node_modules)
  _this._rsync(program, codeDirectory, function(err, result) {
    _this._npmInstall(program, codeDirectory, function(err, result) {
      // Use zip from the command line on non-windows systems to preserve file permissions
      var archive = process.platform != 'win32' ? _this._nativeZip : _this._zip;
      archive = archive.bind(_this)

      archive(program, codeDirectory, function(err, buffer) {

        console.log('Reading zip file to memory');
        //var buffer = fs.readFileSync(zipfile);
        var params = _this._params(program, buffer);

        async.map(regions, function(region, cb) {
          console.log('Uploading zip file to AWS Lambda '+ region + ' with parameters:');
          console.log(params);

          aws.config.update({
            accessKeyId: program.accessKey,
            secretAccessKey: program.secretKey,
            region: region
          });

          var lambda = new aws.Lambda({ apiVersion: '2014-11-11' });

          lambda.uploadFunction(params, function(err, data) {
              cb(err, data);
          });

        }, function(err, results) {
          if (err) {
            console.log(err);
          } else {
            console.log('Zip file(s) done uploading. Results follow: ');
            console.log(results);
          }
        });

      });
    });
  });
};

module.exports = new Lambda();
