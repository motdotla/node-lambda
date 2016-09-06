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
- The above mentioned fix for issue [#127](https://github.com/motdotla/node-lambda/issues/127) exposed a commander bug, reverted the change.
- Do not exclude package.json, even when specified in excludeGlobs [#141](https://github.com/motdotla/node-lambda/pull/141)
