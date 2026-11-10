# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-10

### Added

- First stable release, written in TypeScript with complete type declarations.
- `WaitGroupStateError` and `WaitGroupTimeoutError`, both extending
  `WaitGroupError` and exposing stable error codes.
- `count` and `waiting` getters.
- Optional `timeout` on `wait()`. Timed-out groups are reset and can be reused.
- Dual ESM and CommonJS builds with a backwards-compatible CommonJS default
  export.

### Changed

- Replaced Bluebird with native promises. The package now has zero runtime
  dependencies.
- Removed the internal `counters` array from the public surface.
- A rejected or timed-out wait now discards the remaining counters so the group
  can be reused.
- Raised the minimum supported Node.js version to 22.18.

### Removed

- The `bluebird` runtime dependency.
- AVA in favor of Vitest.

[1.0.0]: https://github.com/zignd/wait-group-promise/releases/tag/v1.0.0
