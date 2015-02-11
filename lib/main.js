"use strict";

var aws = require('aws-sdk');
var exec = require('child_process').exec;
var fs = require('fs');
var os = require('os');
var packageJson = require('./../package.json');
var path = require('path');
var async = require('async');
var uuid = require('node-uuid');
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

Lambda.prototype.deploy = function(program) {
  this._createSampleFile('.env');
  
  var _this = this;
  var regions = program.region.split(',');

  // Generate random directory name
  var dirName = uuid.v4();

  // Create folder where everything woll happen
  fs.mkdirSync('/tmp/' + dirName);

  // Move all files to tmp folder (except .git, .log, event.json and node_modules)
  exec('rsync -r --exclude=.git --exclude=*.log --exclude=event.json --exclude=node_modules . /tmp/' + dirName, function(err, stdout, stderr) {
    if (err) {
      throw err;
    }
    // Install production modules in the specified folder
    exec('npm install --production --prefix /tmp/' + dirName, function(err, stdout, stderr) {
      if (err) {
        throw err;
      }
      exec('zip -rq /tmp/' + dirName + '/' + dirName + '.zip /tmp/' + dirName + '/', function(err, stdout, stderr) {
        if (err) {
          throw err;
        }
        console.log(os.tmpDir());
        console.log('Reading zip file to memory');
        var buffer = fs.readFileSync('/tmp/' + dirName + '/' + dirName + '.zip');
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
          });

        }, function(err, results) {
          fs.rmdirSync('/tmp/' + dirName );
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
