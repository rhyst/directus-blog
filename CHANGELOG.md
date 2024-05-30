# Changelog

All notable changes to this project will be documented in this file. A "⚠️" emoji denotes a potentially breaking change.

## [2.0.0] - 2023-04-07

### Changed

- Minor change to extension definition to ensure its loaded on the correct subdomain in directus 10.11

### Other

## [2.0.0] - 2023-04-07

### Changed

- ⚠️ Config file is now a ES module not a CommonJS module
- Updated dependencies

### Other

- Updated project to use the official directus extension scaffolding and CLI tool

## [1.2.0] - 2022-10-27

### Added

- Table of contents showdown plugin

### Changed

- Updated example tags config to use CSV fields as Directus has removed support for searching in JSON fields.


## [1.1.0] - 2021-11-27

### Added

- `query` callback to allow completely replacing the directus query and an example of its use in the config.js with a tags page.
- Nunjucks views are now passed the express req object
- 
### Other

-  Improve heroku server documentation

## [1.0.2] - 2021-11-07

### Fixed

- Update hooks to user new hook registration functions
  
## [1.0.1] - 2021-11-04

### Fixed

- Sort field format updated
- 
## [1.0.0] - 2021-10-09

### Added

- Initial release.
