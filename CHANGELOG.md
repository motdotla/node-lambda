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
