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
    const _testMain = (expectedValues, done) => {
      const run = spawn('node', [nodeLambdaPath, 'run', '--handler', '__test.handler']);
      var stdoutString = '';
      run.stdout.on('data', (data) => {
        stdoutString += data.toString().replace(/\r|\n/g, '');
      });

      run.on('exit', (code) => {
        assert.match(stdoutString, expectedValues.stdoutRegExp);
        assert.equal(code, expectedValues.exitCode);
        done();
      });
    };

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
      _generateHandlerFile('callback(null);');
      _testMain({ stdoutRegExp: /Success:$/, exitCode: 0 }, done);
    });

    it('`node-lambda run` exitCode is `0` (callback(null, "text"))', (done) => {
      _generateHandlerFile('callback(null, "text");');
      _testMain({ stdoutRegExp: /Success:"text"$/, exitCode: 0 }, done);
    });

    it('`node-lambda run` exitCode is `255` (callback(new Error("e")))', (done) => {
      _generateHandlerFile('callback(new Error("e"));');
      _testMain({ stdoutRegExp: /Error: Error: e$/, exitCode: 255 }, done);
    });

    describe('node-lambda run (async)', () => {
      const _generateHandlerFile = (callbackString, callbackWaitsForEmptyEventLoop) => {
        const asyncCodeAndCallbackWaitsForEmptyEventLoopSettig = `
          setTimeout(() => console.log('sleep 3500 msec'), 3500);
          context.callbackWaitsForEmptyEventLoop = ${callbackWaitsForEmptyEventLoop};
        `;
        const testJsText = fs
          .readFileSync('index.js').toString()
          .replace(
            /console.log\('Running index.handler'\);/,
            asyncCodeAndCallbackWaitsForEmptyEventLoopSettig
          )
          .replace(/callback\(null\);/, callbackString);
        fs.writeFileSync('__test.js', testJsText);
      };

      describe('callbackWaitsForEmptyEventLoop = true', function () {
        this.timeout(5000); // give it time to setTimeout
        it('`node-lambda run` exitCode is `0` (callback(null))', (done) => {
          _generateHandlerFile('callback(null);', true);
          _testMain({ stdoutRegExp: /Success:sleep 3500 msec$/, exitCode: 0 }, done);
        });

        it('`node-lambda run` exitCode is `0` (callback(null, "text"))', (done) => {
          _generateHandlerFile('callback(null, "text");', true);
          _testMain({ stdoutRegExp: /Success:"text"sleep 3500 msec$/, exitCode: 0 }, done);
        });

        it('`node-lambda run` exitCode is `255` (callback(new Error("e")))', (done) => {
          _generateHandlerFile('callback(new Error("e"));', true);
          _testMain({ stdoutRegExp: /Error: Error: esleep 3500 msec$/, exitCode: 255 }, done);
        });
      });

      describe('callbackWaitsForEmptyEventLoop = false', () => {
        it('`node-lambda run` exitCode is `0` (callback(null))', (done) => {
          _generateHandlerFile('callback(null);', false);
          _testMain({ stdoutRegExp: /Success:$/, exitCode: 0 }, done);
        });

        it('`node-lambda run` exitCode is `0` (callback(null, "text"))', (done) => {
          _generateHandlerFile('callback(null, "text");', false);
          _testMain({ stdoutRegExp: /Success:"text"$/, exitCode: 0 }, done);
        });

        it('`node-lambda run` exitCode is `255` (callback(new Error("e")))', (done) => {
          _generateHandlerFile('callback(new Error("e"));', false);
          _testMain({ stdoutRegExp: /Error: Error: e$/, exitCode: 255 }, done);
        });
      });
    });
  });
});
