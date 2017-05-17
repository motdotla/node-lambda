'use strict';

const assert = require('chai').assert;
const path = require('path');
const fs = require('fs-extra');
const spawn = require('child_process').spawn;
const execSync = require('child_process').execSync;
const nodeLambdaPath = path.join(__dirname, '..', 'bin', 'node-lambda');

// The reason for specifying the node command in this test is to support Windows.
describe('bin/node-lambda', () => {
  describe('node-lambda run', () => {
    const _generateHandlerFile = (callbackString) => {
      fs.writeFileSync(
        '__test.js',
        fs.readFileSync('index.js').toString()
          .replace(/callback\(null\);/, callbackString)
      );
    };

    before(() => execSync(`node ${nodeLambdaPath} setup`));

    after(() => {
      [
        '.env',
        'context.json',
        'event.json',
        'deploy.env',
        'event_sources.json',
        '__test.js'
      ].forEach((file) => fs.unlinkSync(file));
    });

    it('`node-lambda run` exitCode is `0` (callback(null))', (done) => {
      const run = spawn('node', [nodeLambdaPath, 'run']);
      var stdoutString = '';
      run.stdout.on('data', (data) => {
        stdoutString += data.toString().replace(/\r|\n/g, '');
      });

      run.on('exit', (code) => {
        assert.match(stdoutString, /Success:$/);
        assert.equal(code, 0);
        done();
      });
    });

    it('`node-lambda run` exitCode is `0` (callback(null, "text"))', (done) => {
      _generateHandlerFile('callback(null, "text");');

      const run = spawn('node', [nodeLambdaPath, 'run', '--handler', '__test.handler']);
      var stdoutString = '';
      run.stdout.on('data', (data) => {
        stdoutString += data.toString().replace(/\r|\n/g, '');
      });

      run.on('exit', (code) => {
        assert.match(stdoutString, /Success:"text"$/);
        assert.equal(code, 0);
        done();
      });
    });

    it('`node-lambda run` exitCode is `255` (callback(new Error("e")))', (done) => {
      _generateHandlerFile('callback(new Error("e"));');

      const run = spawn('node', [nodeLambdaPath, 'run', '--handler', '__test.handler']);
      var stdoutString = '';
      run.stdout.on('data', (data) => {
        stdoutString += data.toString().replace(/\r|\n/g, '');
      });

      run.on('exit', (code) => {
        assert.match(stdoutString, /Error: Error: e$/);
        assert.equal(code, 255);
        done();
      });
    });
  });
});
