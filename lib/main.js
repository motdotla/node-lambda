"use strict";

var aws = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var os = require('os');
var packageJson = require('./../package.json');
var path = require('path');
var async = require('async');

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
    done: function() {
      process.exit(0);
    }
  };

  handler(event, context);
};

Lambda.prototype._zipfileTmpPath = function(program) {
  var ms_since_epoch = +new Date();
  var filename = program.functionName + '-' + ms_since_epoch + '.zip';
  var zipfile = path.join(os.tmpDir(), filename);

  return zipfile;
};

Lambda.prototype._params = function(program, buffer)  { 
  var params = {               
    FunctionName: program.functionName + '-' + program.environment + (program.version ? '/' + program.version: ''),
    FunctionZip: buffer,       
    Handler: program.handler,  
    Mode: program.mode,        
    Role: program.role,
    Runtime: program.runtime,
    Description: program.description,
    MemorySize: program.memorySize, 
    Timeout: program.timeout
  };

  return params;
};

Lambda.prototype.deploy = function(program) {
  this._createSampleFile('.env');
  
  var _this = this;
  var zipfile = _this._zipfileTmpPath(program);
  var regions = program.region.split(',');

  // zip up but ignore .git, .dotfiles, .log files, and the event.json file.
  console.log('Generating zip file');
  exec( "zip -roq " + zipfile + " * -x '.git' -x '*/\.*' -x '*/\*.log' -x 'event.json'", function(err, stdout, stderr) {
    if (err) {
      throw err;
    }

    console.log('Reading zip file to memory');
    var buffer = fs.readFileSync(zipfile);
    var params = _this._params(program, buffer);
  
    async.map(regions, function(region, cb) {
      console.log('Working in region: ' + region);
      console.log('Uploading zip file to AWS Lambda with parameters:');
      console.log(params);
      
      aws.config.update({
        accessKeyId: program.accessKey,
        secretAccessKey: program.secretKey,
        region: region
      });
      
      var lambda = new aws.Lambda({ apiVersion: '2014-11-11' });
      
      lambda.uploadFunction(params, function(err, data) {
          cb(err, data);
        }
      });

    }, function(err, results) {
        if (err) {
          console.log(err);
        } else {  
          console.log('Zip file(s) done uploading. Results follow: ');
          console.log(data);
        }
      }
    });     
  });
};

module.exports = new Lambda();
