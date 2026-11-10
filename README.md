# wait-group-promise

[![npm version](https://img.shields.io/npm/v/wait-group-promise.svg)](https://www.npmjs.com/package/wait-group-promise)
[![CI](https://github.com/zignd/wait-group-promise/actions/workflows/ci.yml/badge.svg)](https://github.com/zignd/wait-group-promise/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/wait-group-promise.svg)](./LICENSE)

A promise-based implementation of Go's [`sync.WaitGroup`](https://pkg.go.dev/sync#WaitGroup)
for Node.js, with optional timeouts and typed errors.

- Fully typed, written in TypeScript
- Zero runtime dependencies
- Dual ESM and CommonJS builds
- Optional timeouts with a reusable group after expiry
- Custom error classes with stable error codes
- 100% test coverage

## Requirements

Node.js 22.18 or newer.

## Installation

```sh
npm install wait-group-promise
```

## Usage

```ts
import { WaitGroup } from 'wait-group-promise';

const wg = new WaitGroup();

wg.add(2);

setTimeout(() => {
  wg.done();
}, 3_000);

setTimeout(() => {
  wg.done();
}, 5_000);

await wg.wait();
```

CommonJS works as well:

```js
const { WaitGroup } = require('wait-group-promise');
// or, for backwards compatibility with 0.x:
const WaitGroup = require('wait-group-promise');
```

### Timeouts

```ts
import { WaitGroup, WaitGroupTimeoutError } from 'wait-group-promise';

const wg = new WaitGroup();
wg.add(1);

try {
  await wg.wait(5_000);
} catch (error) {
  if (error instanceof WaitGroupTimeoutError) {
    // The timeout expired. The group has been reset and can be reused.
  }
}
```

`wait()` keeps the Node.js event loop alive until it settles. Pass a timeout when
you need an upper bound.

### Propagating failures

Calling `done(error)` rejects the pending `wait()` immediately and discards the
remaining counters, so the group can be reused.

```ts
const wg = new WaitGroup();
wg.add(2);

try {
  await wg.wait();
} catch (error) {
  console.error('One of the tasks failed:', error);
}
```

## API

### `new WaitGroup()`

Creates an empty group with no registered work.

### `add(count = 1)`

Registers `count` units of work. `count` must be a non-negative integer.

Throws a [`WaitGroupStateError`](#errors) when a `wait()` call is already in
progress, a `TypeError` when `count` is not a number, and a `RangeError` when
`count` is not a non-negative integer.

### `done(error?)`

Marks one registered unit of work as complete.

- When `error` is `undefined` or `null`, the counter resolves successfully.
- Any other value rejects the pending `wait()` with that value.

Throws a [`WaitGroupStateError`](#errors) when `wait()` has not been called yet or
when no counters remain.

### `wait(timeout?)`

Returns a `Promise<void>` that resolves once every registered counter has
completed.

- `timeout` is an optional positive, finite number of milliseconds.
- If the timeout expires first, the promise rejects with
  [`WaitGroupTimeoutError`](#errors) and the group is reset.
- If another `wait()` is already in progress, the promise rejects with
  [`WaitGroupStateError`](#errors).
- If no counters are registered, the promise rejects with
  [`WaitGroupStateError`](#errors).

### `count`

The number of registered units of work that have not completed yet.

### `waiting`

Whether a `wait()` call is currently in progress.

## Errors

All package-specific errors extend `WaitGroupError`, which exposes a stable
`code` property.

| Class                   | Code                               | When                                                       |
| ----------------------- | ---------------------------------- | ---------------------------------------------------------- |
| `WaitGroupStateError`   | `ERR_WAIT_GROUP_ADD_WHILE_WAITING` | `add()` was called while `wait()` was pending              |
| `WaitGroupStateError`   | `ERR_WAIT_GROUP_WAIT_IN_PROGRESS`  | A second `wait()` was started before the first one settled |
| `WaitGroupStateError`   | `ERR_WAIT_GROUP_EMPTY`             | `wait()` was called without any counters                   |
| `WaitGroupStateError`   | `ERR_WAIT_GROUP_DONE_BEFORE_WAIT`  | `done()` was called before `wait()`                        |
| `WaitGroupStateError`   | `ERR_WAIT_GROUP_DONE_EMPTY`        | `done()` was called with no counters remaining             |
| `WaitGroupTimeoutError` | `ERR_WAIT_GROUP_TIMEOUT`           | The timeout passed to `wait()` expired                     |

```ts
import { WaitGroupError } from 'wait-group-promise';

if (error instanceof WaitGroupError) {
  console.log(error.code);
}
```

## Migrating from 0.x

Version 1.0.0 is a TypeScript rewrite with a few intentional breaking changes:

1. **Bluebird was removed.** The package now uses native promises and has no
   runtime dependencies.
2. **Named exports are preferred.** Use
   `import { WaitGroup } from 'wait-group-promise'` or
   `const { WaitGroup } = require('wait-group-promise')`. The CommonJS default
   export still works for backwards compatibility.
3. **The internal `counters` array was replaced by the `count` getter.** It was
   never part of the documented API.
4. **Errors are typed.** State errors use `WaitGroupStateError` and timeouts use
   `WaitGroupTimeoutError`. Messages from 0.x are preserved.
5. **Timeouts reset the group.** After a timeout or a rejected wait, the group is
   left empty and can be reused.
6. **Node.js 22.18 or newer is required.** Node.js 20 reached end-of-life in
   April 2026.

## Development

```sh
npm install
npm run verify      # formatting, lint, typecheck, coverage, build, package checks
npm run test:watch  # run tests in watch mode
```

## Releasing

Publishing is automated by [`.github/workflows/release.yml`](./.github/workflows/release.yml):

1. Update the version in `package.json` and `CHANGELOG.md`.
2. Commit and push the changes.
3. Create a GitHub release whose tag matches the version (for example `v1.0.0`).

The workflow verifies that the tag and package version match, runs the full
verification suite, and publishes to npm with
[provenance](https://docs.npmjs.com/generating-provenance-statements). It requires
an `NPM_TOKEN` repository secret containing a granular access token with publish
permission for this package.

## License

[MIT](./LICENSE)
