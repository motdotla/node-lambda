# Change Log
All notable changes to this project will be documented in this file.
This project adheres to [Semantic Versioning](http://semver.org/).

## [Unreleased]

## [0.8.0] - 2016-04-18
### Added
- CHANGELOG to ["make it easier for users and contributors to see precisely what notable changes have been made between each release"](http://keepachangelog.com/). Linked to from README
- LICENSE to be more explicit about what was defined in `package.json`. Linked to from README
- It is OK to not set default value for AWS Credentials so AWS can use Roles and internally set AWS credentials
- Added `context.json` so it can easily be overwritten
- Allow using a custom (and passed through) `event.json` file
- Added `package` command for easy zip creation and inspection
- Added `VpcConfig` support, see [this PR](https://github.com/motdotla/node-lambda/pull/64) for more information
- Updated the AWS API version used to `2015-03-31`
- Make sure we throw errors on unrecoverable failures so other programs can listen on that
- Added support for nodejs4.3 runtime ([introducted to AWS](https://aws.amazon.com/blogs/compute/node-js-4-3-2-runtime-now-available-on-lambda/) Apr 7 2016)
- Added support for `post install scripts`, this `post_install.sh` file will be triggered after `npm install --production` in case you want to run any code on your application before zipping
- Added `-x` / `--excludeGlobs` to allow custom file exclusion
- Excluding `*.swp`, `deploy.env` by default now

## [0.8.1] - 2016-04-22
### Bugfixes
- Resolved a problem with excludes not being set [#91](https://github.com/motdotla/node-lambda/pull/91)
- Resolved a problem with the package command and a custom config file [#90](https://github.com/motdotla/node-lambda/pull/90)
- Allow `use strict` [#86](https://github.com/motdotla/node-lambda/pull/86)
- Updated the `env.example` file to set the default (and by AWS recommended) runtime to `nodejs4.3` [#84](https://github.com/motdotla/node-lambda/pull/84)

## [0.8.2] - 2016-05-12
### Bugfixes
- Verify env vars before creating sample files [#99](https://github.com/motdotla/node-lambda/pull/99)
- Fix `AWS_PUBLIS` typo [#102](https://github.com/motdotla/node-lambda/pull/102)
### Added
- Allow checking on `process.env.environment` to context switch [#95](https://github.com/motdotla/node-lambda/pull/95)

## [0.8.3] - 2016-05-12
### Bugfixes
- Added `EXCLUDE_GLOBS` to `package`, so your local ZIPs are the same as the ZIPs uploaded to AWS Lambda [#104](https://github.com/motdotla/node-lambda/pull/104)

## [0.8.4] - 2016-05-20
### Bugfixes
- Added extra quotes around the parsed environment [#106](https://github.com/motdotla/node-lambda/pull/106)

## [0.8.5] - 2016-05-27
### Adjustment
- Extremely verbose NPM installs could crash node-lambda's buffer [#108](https://github.com/motdotla/node-lambda/pull/108)

## [0.8.6] - 2016-06-28
### Feature
- Added `prebuiltDirectory` flag for users that want to use an already generated directory [#116](https://github.com/motdotla/node-lambda/pull/116)

### Bugfixes
- README was lying about how to use `excludeGlobs` [#111](https://github.com/motdotla/node-lambda/pull/111)

## [0.8.7] - 2016-08-16
### Features
- Added `-L` to rsync to allow copying of symlinks [#126](https://github.com/motdotla/node-lambda/pull/126)
- Added travisci support for node 6 [#129](https://github.com/motdotla/node-lambda/pull/129)
- Support to use package.json description for AWS description [#133](https://github.com/motdotla/node-lambda/pull/133)
- Inject environment variables via config file for the `run` command [#136](https://github.com/motdotla/node-lambda/pull/136)

### Bugfixes
- rsync should not exclude node_modules when using --prebuiltDirectory. [#122](https://github.com/motdotla/node-lambda/pull/122)
- Set environment variables _before_ requiring module [#137](https://github.com/motdotla/node-lambda/pull/137)
- Typo fix publish when updating existing function [#138](https://github.com/motdotla/node-lambda/pull/138)

## [0.8.8] - 2016-09-02
### Features
- Support AWS_PROFILE and de-duped a few CLI options [#144](https://github.com/motdotla/node-lambda/pull/144)
- `wrench` was deprecated and has been replaced by `fs-extra` [#146](https://github.com/motdotla/node-lambda/pull/146)

### Bugs
- Displaying `node-lambda -h` returned an error [#127](https://github.com/motdotla/node-lambda/issues/127)
- NPM overwrites `$TMPDIR` [#134](https://github.com/motdotla/node-lambda/issues/134)

## [0.8.9] - 2016-09-06
### Bugs
- The above mentioned fix for issue [#127](https://github.com/motdotla/node-lambda/issues/127) exposed a commander bug, reverted the change
- Do not exclude package.json, even when specified in excludeGlobs [#141](https://github.com/motdotla/node-lambda/pull/141)

## [0.8.10] - 2016-09-20
### Features
- We are now passing the environment string to the post install script [#154](https://github.com/motdotla/node-lambda/pull/154)

## [0.8.11] - 2016-10-28
### Bugfixes
- Restore lambda version functionality [#156](https://github.com/motdotla/node-lambda/issues/156)
- Namespaced packages fail to deploy [#157](https://github.com/motdotla/node-lambda/issues/157)

## [0.8.12] - 2017-02-10
### Bugfixes
- Using path.join instead of hardcoded slashes [#173](https://github.com/motdotla/node-lambda/pull/173)
- Drop node-uuid from package.json [#174](https://github.com/motdotla/node-lambda/pull/174)
- Enforce max for timeout and update README docs [#180](https://github.com/motdotla/node-lambda/pull/180)
- Fill default VpcConfig to prevent errors [#183](https://github.com/motdotla/node-lambda/pull/183)

### Features
- Added getRemainingTimeInMillis() to the context when running locally. [#179](https://github.com/motdotla/node-lambda/pull/179)
- Adding support for lambda environment variables [#181](https://github.com/motdotla/node-lambda/pull/181)

## [0.8.13] - 2017-02-12
### Bugfixes
- Fixed wrong runtime call [#188](https://github.com/motdotla/node-lambda/pull/188)
- Docker support [#186](https://github.com/motdotla/node-lambda/pull/186)
- Make default excludes apply to root only [#185](https://github.com/motdotla/node-lambda/pull/185)


## [0.8.14] - 2017-03-27
### Features
- Event source mapping support [#189](https://github.com/motdotla/node-lambda/pull/189)
- Fix version of Node.js supported by AWS Lambda [#197](https://github.com/motdotla/node-lambda/pull/197)
- How about it if you have the option to specify the zip file? [#199](https://github.com/motdotla/node-lambda/pull/199)
- Add 'Runtime' to the params of lambda.updateFunctionConfiguration [#200](https://github.com/motdotla/node-lambda/pull/200)

### Bugfixes
- Fix unit test failure at travis [#198](https://github.com/motdotla/node-lambda/pull/198)

## [0.8.15] - 2017-03-28
### Features
- Added DeadLetterConfig parameter [#206](https://github.com/motdotla/node-lambda/pull/206)

### Bugfixes
- Fix default value of EVENT_SOURCE_FILE set '' [#205](https://github.com/motdotla/node-lambda/pull/205)
- Removed event_sources.json [#204](https://github.com/motdotla/node-lambda/pull/204)
- Add -S, --eventSourceFile option. [#203](https://github.com/motdotla/node-lambda/pull/203)

## [0.9.0] - 2017-04-13
### Features
- Add tests for `_readArchive` [#213](https://github.com/motdotla/node-lambda/pull/213)
- Add tests for event_sources.json [#214](https://github.com/motdotla/node-lambda/pull/214)
- Add tests for DeadLetterConfig [#215](https://github.com/motdotla/node-lambda/pull/215)
- Add `_readArchive` tests called in `_archive` [#216](https://github.com/motdotla/node-lambda/pull/216)
- modify badge from png to svg [#227](https://github.com/motdotla/node-lambda/pull/227)
- ScheduleEvents [#228](https://github.com/motdotla/node-lambda/pull/228)

### Bugfixes
- Bugfix InvalidParameterValueException is given when createFunction [#209](https://github.com/motdotla/node-lambda/pull/209)
- Clean unnecessary `else` [#217](https://github.com/motdotla/node-lambda/pull/217)
- Refactor `_eventSourceList` [#218](https://github.com/motdotla/node-lambda/pull/218)
- Clean deploy function [#220](https://github.com/motdotla/node-lambda/pull/220)
- Fix default value of params.Environment.Variables is null [#221](https://github.com/motdotla/node-lambda/pull/221)
- Fix to use authenticated `aws` object in main.js [#225](https://github.com/motdotla/node-lambda/pull/225)
- Changed the format of `event_sources.json` [#226](https://github.com/motdotla/node-lambda/pull/226)

## [0.10.0] - 2017-05-10
### Features
- Fix use fs object [#236](https://github.com/motdotla/node-lambda/pull/236)
- Upgrade lodash [#237](https://github.com/motdotla/node-lambda/pull/237)
- Add file copy function without rsync command [#238](https://github.com/motdotla/node-lambda/pull/238)
- Add node.js 7 to `travis.yml` [#239](https://github.com/motdotla/node-lambda/pull/239)
- Set http timeout to 30 mins. [#240](https://github.com/motdotla/node-lambda/pull/240)
- Supported `TracingConfig` [#243](https://github.com/motdotla/node-lambda/pull/243)
- Fix to using `path` object [#249](https://github.com/motdotla/node-lambda/pull/249)
- Allow use of docker container for npm install [#251](https://github.com/motdotla/node-lambda/pull/251)
- Bugfix `_filecopy` exclude [#253](https://github.com/motdotla/node-lambda/pull/253)
- Fix to replace `_rsync` with `_fileCopy` [#254](https://github.com/motdotla/node-lambda/pull/254)
- Custom ScheduleEvent rule description [#257](https://github.com/motdotla/node-lambda/pull/257)
- Add test `functionName` pattern [#263](https://github.com/motdotla/node-lambda/pull/263)
- Added `- cwd` option to `npm install` command [#265](https://github.com/motdotla/node-lambda/pull/265)

### Bugfixes
- Add an overview of `event_sources.json` [#230](https://github.com/motdotla/node-lambda/pull/230)
- Cleanup of `main.js run` [#231](https://github.com/motdotla/node-lambda/pull/231)
- Fix results outputs [#233](https://github.com/motdotla/node-lambda/pull/233)
- Bugfix for backward compatible objects [#234](https://github.com/motdotla/node-lambda/pull/234)
- Fix after process of tests [#235](https://github.com/motdotla/node-lambda/pull/235)
- Fix to be the same specification as `--exclude` of rsync command (about function which is an alternative to rsync command) [#244](https://github.com/motdotla/node-lambda/pull/244)
- Fix to avoid `commander` bug [#247](https://github.com/motdotla/node-lambda/pull/247)
- Fix `fs.exists` deprecated [#250](https://github.com/motdotla/node-lambda/pull/250)
- Fix using `assert.include` [#252](https://github.com/motdotla/node-lambda/pull/252)
- Fix not doing anything if `event_sources.json` is not specified [#256](https://github.com/motdotla/node-lambda/pull/256)
- Fix using `path` [#258](https://github.com/motdotla/node-lambda/pull/258)
- Fix tests for windows [#259](https://github.com/motdotla/node-lambda/pull/259)
- Add Command Prompt to README [#266](https://github.com/motdotla/node-lambda/pull/266)
- Fix indexjs current style [#268](https://github.com/motdotla/node-lambda/pull/268)
- Fixed typo - Labmda => Lambda [#269](https://github.com/motdotla/node-lambda/pull/269)
- Fix not to create `.env` sample file with `_buildAndArchive` [#270](https://github.com/motdotla/node-lambda/pull/270)

## [0.11.0] - 2017-06-16
### Features
- Fix to include only `package.json` in the source directory [#274](https://github.com/motdotla/node-lambda/pull/274)
- Fix os: deprecate 'tmpDir()' in favour of 'tmpdir()' https://github.c… [#275](https://github.com/motdotla/node-lambda/pull/275)
- Upgraded `aws-sdk`[#277](https://github.com/motdotla/node-lambda/pull/277)
- Unified in Camel Case & Remove unnecessary arguments [#278](https://github.com/motdotla/node-lambda/pull/278)
- Remove function `_nativeZip` [#279](https://github.com/motdotla/node-lambda/pull/279)
- Add known issue for duplicate trigger to ScheduleEvents section [#280](https://github.com/motdotla/node-lambda/pull/280)
- Feature simple callbackWaitsForEmptyEventLoop support [#284](https://github.com/motdotla/node-lambda/pull/284)
- Fix to use test handler by stopping replace processing of existing index.js [#285](https://github.com/motdotla/node-lambda/pull/285)
- Fix to use '===' instead of '==' (Including similar modifications) [#287](https://github.com/motdotla/node-lambda/pull/287)
- Replaced `rimraf` with `fs.remove` [#291](https://github.com/motdotla/node-lambda/pull/291)
- Refactored: JavaScript Standard Style [#292](https://github.com/motdotla/node-lambda/pull/292)
- Refactored and add test [#294](https://github.com/motdotla/node-lambda/pull/294)
- Refactored, improved error handling [#295](https://github.com/motdotla/node-lambda/pull/295)
- Remove semicolon (Automatic update with `standard --fix`) [#298](https://github.com/motdotla/node-lambda/pull/298)
- Adopted "JavaScript Standard Style" as coding style [#299](https://github.com/motdotla/node-lambda/pull/299)
- Replace async.js in `_updateScheduleEvents` with Promise [#302](https://github.com/motdotla/node-lambda/pull/302)
- Modify from `exec` to `execFile` with `_npmInstall` [#303](https://github.com/motdotla/node-lambda/pull/303)
- Automated NPM deploys (on tags) [#304](https://github.com/motdotla/node-lambda/pull/304)
- Add package-lock.json [#305](https://github.com/motdotla/node-lambda/pull/305)
- Added `_updateEventSources` test and refactoring [#308](https://github.com/motdotla/node-lambda/pull/308)
- Added test of function to upload Zip to Lambda [#309](https://github.com/motdotla/node-lambda/pull/309)
- Fix timing to check Runtime [#310](https://github.com/motdotla/node-lambda/pull/310)
- Feature event accept array [#311](https://github.com/motdotla/node-lambda/pull/311)
- Modify to use isArray [#312](https://github.com/motdotla/node-lambda/pull/312)
- Modify execution of multiple events to synchronous processing [#313](https://github.com/motdotla/node-lambda/pull/313)
- Fix to make `bin/node-lambda` conform to JavaScript Standard Style [#315](https://github.com/motdotla/node-lambda/pull/315)
- Replace asyncjs of `_updateEventSources` with Promise [#316](https://github.com/motdotla/node-lambda/pull/316)
- Replace async.js of deploy with Promise [#319](https://github.com/motdotla/node-lambda/pull/319)
- Modified the function used in `deploy` to return Promise [#320](https://github.com/motdotla/node-lambda/pull/320)
- Modify main process of deploy to another function [#323](https://github.com/motdotla/node-lambda/pull/323)
- Fix to use Proxy [#324](https://github.com/motdotla/node-lambda/pull/324)

### Bugfixes
- Remove the cleaning process after the test [#281](https://github.com/motdotla/node-lambda/pull/281)
- Fix run handler callback [#282](https://github.com/motdotla/node-lambda/pull/282)
- Remove 'os' [#286](https://github.com/motdotla/node-lambda/pull/286)
- Fix not specifying file name with test in package.json [#289](https://github.com/motdotla/node-lambda/pull/289)
- Update phase as it is necessary to separate release phase (.travis.yml) [#306](https://github.com/motdotla/node-lambda/pull/306)
- Refactoring and unnecessary package removal [#307](https://github.com/motdotla/node-lambda/pull/307)
- Modify `var` of global variable to `const` [#317](https://github.com/motdotla/node-lambda/pull/317)
- Remove Hoek [#318](https://github.com/motdotla/node-lambda/pull/318)

## [0.11.1] - 2017-07-04
### Features
- Improve deploy process with Promise [#327](https://github.com/motdotla/node-lambda/pull/327)
- Refactoring `_cleanDirectory` [#330](https://github.com/motdotla/node-lambda/pull/330)
- Refactoring `_npmInstall` [#331](https://github.com/motdotla/node-lambda/pull/331)
- Replace callback with Promise [#332](https://github.com/motdotla/node-lambda/pull/332)
- Upgrade commander.js [#334](https://github.com/motdotla/node-lambda/pull/332)
- Refactoring `_fileCopy` [#336](https://github.com/motdotla/node-lambda/pull/336)
- Add simple context method [#337](https://github.com/motdotla/node-lambda/pull/337)
- Refactoring `_archive` [#338](https://github.com/motdotla/node-lambda/pull/338)
- Refactoring `_listEventSourceMappings` [#339](https://github.com/motdotla/node-lambda/pull/339)
- Replace `var` with `const` [#341](https://github.com/motdotla/node-lambda/pull/341)
- Replace with arrow function [#342](https://github.com/motdotla/node-lambda/pull/342)

### Bugfixes
- Modify file used for test [#326](https://github.com/motdotla/node-lambda/pull/326)
- Update package-lock.json [#328](https://github.com/motdotla/node-lambda/pull/328)
- Remove `_rsync` [#329](https://github.com/motdotla/node-lambda/pull/329)
- Bugfixed that mode of file changes when zip is created [#335](https://github.com/motdotla/node-lambda/pull/335)

## [0.11.2] - 2017-07-05
### Features
- Fix to deprecated the `configFile` option in the `pacakage` command [#344](https://github.com/motdotla/node-lambda/pull/344)

### Bugfixes
- Fix to set boolean in params.Publish [#346](https://github.com/motdotla/node-lambda/pull/346)

## [0.11.3] - 2017-07-07
### Features
- Fix symlink at zip [#348](https://github.com/motdotla/node-lambda/pull/348)

## [0.11.4] - 2017-09-22
### Features
- Remove configFile Option of package command in README [#350](https://github.com/motdotla/node-lambda/pull/350)
- Remove configFile option in package command [#351](https://github.com/motdotla/node-lambda/pull/351)
- Uprade chai [#352](https://github.com/motdotla/node-lambda/pull/352)
- Add the ability to set KMSKeyArn to a Lambda function [#356](https://github.com/motdotla/node-lambda/pull/356)
- Add appveyor.yml[#357](https://github.com/motdotla/node-lambda/pull/357)
- Add function for setting CloudWatchLogs RetentionPolicy [#359](https://github.com/motdotla/node-lambda/pull/359)
- Switch ScheduleEvents to class syntax [#360](https://github.com/motdotla/node-lambda/pull/360)
- Add `_setLogsRetentionPolicy` to `lib/main.js` [#361](https://github.com/motdotla/node-lambda/pull/361)
- Change `lib/main.js` to class syntax [#362](https://github.com/motdotla/node-lambda/pull/362)
- Use stable node, at npm release. [#370](https://github.com/motdotla/node-lambda/pull/370)
- Add option to disable run multiple [#372](https://github.com/motdotla/node-lambda/pull/372)

### Bugfixes
- Update repository url [#358](https://github.com/motdotla/node-lambda/pull/358)
- Fix deploy command exit code [#366](https://github.com/motdotla/node-lambda/pull/366)
- Add invalidation of log output to make the test result easier to read [#367](https://github.com/motdotla/node-lambda/pull/367)
- Fix commandline version option [#368](https://github.com/motdotla/node-lambda/pull/368)
- Change: Ensure dotenv.load called before AWS load [#369](https://github.com/motdotla/node-lambda/pull/369)
- Update README with latest output for 'node-lambda run -h' [#373](https://github.com/motdotla/node-lambda/pull/373)
- Update Usage of README [#374](https://github.com/motdotla/node-lambda/pull/374)

## [0.11.5] - 2017-12-11
### Features
- Move node-zip to devDependencies [#378](https://github.com/motdotla/node-lambda/pull/378)
- Added the ability to set constants when scheduling a Lambda function Cloudwatch event [#380](https://github.com/motdotla/node-lambda/pull/380)
- Update CI's Node.js to LTS and latest version [#386](https://github.com/motdotla/node-lambda/pull/386)
- Update packages [#392](https://github.com/motdotla/node-lambda/pull/392)
- Added class to set S3 events [#393](https://github.com/motdotla/node-lambda/pull/393)
- Add updateS3Events to main [#394](https://github.com/motdotla/node-lambda/pull/394)
- Refactoring lib/schedule_events.js [#395](https://github.com/motdotla/node-lambda/pull/395)

### Bugfixes
- Set docker run working directory so npm install works [#381](https://github.com/motdotla/node-lambda/pull/381)
- Change short option of `--tracingConfig` to `-c` [#385](https://github.com/motdotla/node-lambda/pull/385)
- Fix to use Proxy when run locally [#389](https://github.com/motdotla/node-lambda/pull/389)

## [0.11.6] - 2018-01-07
### Features
- Refactoring lib/main.js [#398](https://github.com/motdotla/node-lambda/pull/398)
- Remove unnecessary `return this` for constructor [#399](https://github.com/motdotla/node-lambda/pull/399)
- Remove unnecessary try-cache [#401](https://github.com/motdotla/node-lambda/pull/401)
- Add event_sources.json to setup message [#402](https://github.com/motdotla/node-lambda/pull/402)
- Modify using template literals [#403](https://github.com/motdotla/node-lambda/pull/403)
- Remove unnecessary promise chain [#404](https://github.com/motdotla/node-lambda/pull/404)
- Local/Cloud flag [#405](https://github.com/motdotla/node-lambda/pull/405)

## [0.11.7] - 2018-04-12
### Features
- AWS X-Ray SDK Support [#414](https://github.com/motdotla/node-lambda/pull/414)
- Upgrade `standard` [#416](https://github.com/motdotla/node-lambda/pull/416)
- Added support for using custom endpoints like localstack [#417](https://github.com/motdotla/node-lambda/pull/417)
- NodeJS 8.10 runtime now available [#419](https://github.com/motdotla/node-lambda/pull/419)

### Bugfixes
- remove env var value from commanderjs flag definition [#409](https://github.com/motdotla/node-lambda/pull/409)

## [0.12.0] - 2018-08-10
### Features
- Implemente to specify bucket name of S3 [#458](https://github.com/motdotla/node-lambda/pull/458)
- Implement deployment using S3 (Create a bucket for each region.) [#455](https://github.com/motdotla/node-lambda/pull/455)
- Add class for uploading deploy package to S3 [#454](https://github.com/motdotla/node-lambda/pull/454)
- Fix to throw an error except ResourceNotFoundException [#452](https://github.com/motdotla/node-lambda/pull/452)
- Feature upload to s3 and deploy from bucket [#446](https://github.com/motdotla/node-lambda/pull/446)
- npm update [#445](https://github.com/motdotla/node-lambda/pull/445)
- Upgrade dependent packages [#441](https://github.com/motdotla/node-lambda/pull/441)
- Add simple test of `_deployToRegion()` and `deploy()` [#439](https://github.com/motdotla/node-lambda/pull/439)
- Remove unnecessary package load in `test/main.js` [#438](https://github.com/motdotla/node-lambda/pull/438)
- Add cache of `node modules` to CI setting [#436](https://github.com/motdotla/node-lambda/pull/436)
- Modify `require` to `{ }` statement [#435](https://github.com/motdotla/node-lambda/pull/435)
- Fix to use `includes` instead of `indexOf` [#433](https://github.com/motdotla/node-lambda/pull/433)
- Remove test code for Node.js4 [#432](https://github.com/motdotla/node-lambda/pull/432)
- Upgrade `fs-extra` [#431](https://github.com/motdotla/node-lambda/pull/431)
- Stop supporting Node.js 4 [#430](https://github.com/motdotla/node-lambda/pull/430)
- Fix using `klaw` instead of `fs.walk` [#424](https://github.com/motdotla/node-lambda/pull/424)
- Add Node.js10 to CI setting [#428](https://github.com/motdotla/node-lambda/pull/428)

### Bugfixes
- Fix StatementId [#451](https://github.com/motdotla/node-lambda/pull/451)
- Bugfix of initialValue of recude in s3events [#447](https://github.com/motdotla/node-lambda/pull/447)
- Added handling to catch and log error return from async lambda [#443](https://github.com/motdotla/node-lambda/pull/443)
- Log result of an async handler method by resolving promise if a promise [#440](https://github.com/motdotla/node-lambda/pull/440)
- Fix to display return value of handler [#427](https://github.com/motdotla/node-lambda/pull/427)
- Fix to set array when same bucket [#423](https://github.com/motdotla/node-lambda/pull/423)

## [0.13.0] - 2018-11-15
### Features
- Drop nodejs4.3 [#469](https://github.com/motdotla/node-lambda/pull/469)
- Update maximum timeout value from 300 to 900 [#465](https://github.com/motdotla/node-lambda/pull/465)
- Modify to follow the rules of the new 'standard' [#463](https://github.com/motdotla/node-lambda/pull/463)
- Add 'osx' to CI os [#464](https://github.com/motdotla/node-lambda/pull/464)
- Update CI test to LTS version [#462](https://github.com/motdotla/node-lambda/pull/462)
- Upgrade `archiver` [#460](https://github.com/motdotla/node-lambda/pull/460)

### Bugfixes
- Fix value of StartingPosition [#467](https://github.com/motdotla/node-lambda/pull/467)

## [0.14.0] - 2019-05-25
### Features
- Support Node.js 10.x [#487](https://github.com/motdotla/node-lambda/pull/487)
- Add Node.js 12 to CI setting [#486](https://github.com/motdotla/node-lambda/pull/486)
- Add file to configure aws authentication settings [#482](https://github.com/motdotla/node-lambda/pull/482)
- Add layers option to readme [#481](https://github.com/motdotla/node-lambda/pull/481)
- Add option to specify Lambda Layers [#480](https://github.com/motdotla/node-lambda/pull/480)
- Upgrade packages [#479](https://github.com/motdotla/node-lambda/pull/479)
- Add dockerVolumes option in package in order to mount additional volumes [#473](https://github.com/motdotla/node-lambda/pull/473)
- Add keepNodeModules option in package [#472](https://github.com/motdotla/node-lambda/pull/472)

### Bugfixes
- Remove 'packageDirectory' option from 'deploy' [#484](https://github.com/motdotla/node-lambda/pull/484)
- Update s3deploy bucket handling [#475](https://github.com/motdotla/node-lambda/pull/475)
- Fix Docker volume mount from OSX - #461 [#471](https://github.com/motdotla/node-lambda/pull/471)

## [0.15.0] - 2019-12-11
### Features
- adds tagging on new and updated functions [#508](https://github.com/motdotla/node-lambda/pull/508)
- Add nodejs12.x to runtime [#510](https://github.com/motdotla/node-lambda/pull/510)
- Don't audit packages when installing [#505](https://github.com/motdotla/node-lambda/pull/505)
- Use `ci` instead of `install` when installing packages [#502](https://github.com/motdotla/node-lambda/pull/502)
- Add reference to TypeScript example/template [#497](https://github.com/motdotla/node-lambda/pull/497)
- Drop nodejs6.10 [#495](https://github.com/motdotla/node-lambda/pull/495)
- Warn on providing unknown commands [#494](https://github.com/motdotla/node-lambda/pull/494)
- Fix tests
    - Fix GitHub Actions workflow [#506](https://github.com/motdotla/node-lambda/pull/506)
    - Fix `npm ci` test. [#509](https://github.com/motdotla/node-lambda/pull/509)
    - Remove appveyor.yml [#504](https://github.com/motdotla/node-lambda/pull/504)
    - Modify unit tests [#501](https://github.com/motdotla/node-lambda/pull/501)
    - Fix GitHub Actions workflow [#500](https://github.com/motdotla/node-lambda/pull/500)
    - Add GitHub Actions workflow [#499](https://github.com/motdotla/node-lambda/pull/499)

## [0.16.0] - 2020-02-12
### Features
- Remove osx from travis [#513](https://github.com/motdotla/node-lambda/pull/513)
- Drop nodejs8.10 from runtime [#516](https://github.com/motdotla/node-lambda/pull/516)

## [0.17.0] - 2020-05-14
### Features
- Implement a simple API Gateway event [#530](https://github.com/motdotla/node-lambda/pull/530)
    - [README] Add the 'apiGateway' option to the run command [#532](https://github.com/motdotla/node-lambda/pull/532)
- Add Node.js 14 to CI settings [#524](https://github.com/motdotla/node-lambda/pull/524)
- Drop old Node support  [#523](https://github.com/motdotla/node-lambda/pull/523)
- Bump acorn from 7.0.0 to 7.1.1 [#522](https://github.com/motdotla/node-lambda/pull/522)
- Add Silent or quiet mode when deploying [#520](https://github.com/motdotla/node-lambda/pull/520)
    - [README update] Add silent option to deploy command [#521](https://github.com/motdotla/node-lambda/pull/521)
- Update README (remove --endpoint of run subcommand, add --endpoint of deploy subcommand) [#514](https://github.com/motdotla/node-lambda/pull/514)

### Bugfixes
- Upgrade "aws-xray-sdk-core" [#529](https://github.com/motdotla/node-lambda/pull/529)
- Fix Lambda update failure [#526](https://github.com/motdotla/node-lambda/pull/526)
    - Fix typo [#527](https://github.com/motdotla/node-lambda/pull/527)

## [0.18.0] - 2021-02-19
### Features
- feat: support nodejs14.x runtime [#553](https://github.com/motdotla/node-lambda/pull/553)
- Upgrade Mocha to fix high sev vulnerability. [#551](https://github.com/motdotla/node-lambda/pull/551)
- docs: add a note to the README about deploying container image [#549](https://github.com/motdotla/node-lambda/pull/549)
- Support npm7 #[550](https://github.com/motdotla/node-lambda/pull/550)
- feat: support for 'ImageUri' parameter [#548](https://github.com/motdotla/node-lambda/pull/548)
- upgrade 'commander' to 7 [#547](https://github.com/motdotla/node-lambda/pull/547)
- ci: add 'fail-fast: false' setting #[546](https://github.com/motdotla/node-lambda/pull/546)
- use starsWith instead of indexOf [#545](https://github.com/motdotla/node-lambda/pull/545)
- Upgrade 'standard' [#543](https://github.com/motdotla/node-lambda/pull/543)
- Update S3_LOCATION_POSSIBLE_VALUES [#542](https://github.com/motdotla/node-lambda/pull/542)
- Bump bl from 4.0.2 to 4.0.3 [#541](https://github.com/motdotla/node-lambda/pull/541)
- Add description of vpc options [#540](https://github.com/motdotla/node-lambda/pull/540)
- Upgrade packages [#538](https://github.com/motdotla/node-lambda/pull/538)
- Bump lodash from 4.17.15 to 4.17.19 [#536](https://github.com/motdotla/node-lambda/pull/536)
- Add build badge in README [#534](https://github.com/motdotla/node-lambda/pull/534)

## [0.19.0] - 2021-03-30
### Features
- feat: support `--no-optional` option in npm install [#557](https://github.com/motdotla/node-lambda/pull/557)

## [0.19.1] - 2021-04-24
### Bugfixes
- Fix errors caused by old proxy-agent [#564](https://github.com/motdotla/node-lambda/pull/564)

## [0.20.0] - 2021-09-25
### Features
- updated proxy-agent to 5.0.0 [#574](https://github.com/motdotla/node-lambda/pull/574)
- show suggestions after an error for an unknown command or option [#572](https://github.com/motdotla/node-lambda/pull/572)
- feat: drop nodejs10x from lambda runtime [#571](https://github.com/motdotla/node-lambda/pull/571)

### Bugfixes
- fix(_uploadExisting): fix function update errors [#575](https://github.com/motdotla/node-lambda/pull/575)
- test: fix npm install test failing in some cases [#569](https://github.com/motdotla/node-lambda/pull/569)
- Clean the tmp dir during `_archivePrebuilt` to match `_buildAndArchive` behavior [#518](https://github.com/motdotla/node-lambda/pull/518)

## [0.21.0] - 2021-11-10
### Features
- feat: support for yarn [#581](https://github.com/motdotla/node-lambda/pull/581)

## [0.22.0] - 2022-02-17
### Features
- Support for Architectures parameter [#591](https://github.com/motdotla/node-lambda/pull/591)
### Bugfixes
- fix: skip installing the package, when there is no `package.json` [#589](https://github.com/motdotla/node-lambda/pull/589)

## [1.0.0] - 2022-05-19
### Features
- feat: remove BUILD from the exclusion list [#607](https://github.com/motdotla/node-lambda/pull/607)
    - BREAKING CHANGES
- add nodejs16.x to runtime [#605](https://github.com/motdotla/node-lambda/pull/605)
