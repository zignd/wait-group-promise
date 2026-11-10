/**
 * Error codes emitted by {@link WaitGroupError} instances.
 */
export type WaitGroupErrorCode =
  | 'ERR_WAIT_GROUP_ADD_WHILE_WAITING'
  | 'ERR_WAIT_GROUP_WAIT_IN_PROGRESS'
  | 'ERR_WAIT_GROUP_EMPTY'
  | 'ERR_WAIT_GROUP_DONE_BEFORE_WAIT'
  | 'ERR_WAIT_GROUP_DONE_EMPTY'
  | 'ERR_WAIT_GROUP_TIMEOUT';

/**
 * Base class for all errors raised by this package.
 */
export class WaitGroupError extends Error {
  /** A stable, machine-readable error code. */
  readonly code: WaitGroupErrorCode;

  constructor(message: string, code: WaitGroupErrorCode) {
    super(message);
    this.name = new.target.name;
    this.code = code;
  }
}

/**
 * Raised when a {@link WaitGroup} method is called in an invalid state.
 */
export class WaitGroupStateError extends WaitGroupError {
  constructor(message: string, code: WaitGroupErrorCode) {
    super(message, code);
  }
}

/**
 * Raised when {@link WaitGroup.wait} exceeds its timeout.
 */
export class WaitGroupTimeoutError extends WaitGroupError {
  constructor(message = 'Timeout reached') {
    super(message, 'ERR_WAIT_GROUP_TIMEOUT');
  }
}

interface PendingCounter {
  readonly promise: Promise<void>;
  readonly resolve: () => void;
  readonly reject: (reason?: unknown) => void;
}

function createCounter(): PendingCounter {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;

  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
}

/**
 * A promise-based implementation of Go's
 * [WaitGroup](https://pkg.go.dev/sync#WaitGroup).
 *
 * Call {@link add} to register work, {@link done} when a unit of work
 * finishes, and await {@link wait} to block until every registered unit has
 * completed.
 *
 * @example
 * ```ts
 * import { WaitGroup } from 'wait-group-promise';
 *
 * const wg = new WaitGroup();
 * wg.add(2);
 *
 * void doWork().finally(() => wg.done());
 * void doMoreWork().finally(() => wg.done());
 *
 * await wg.wait();
 * ```
 */
export class WaitGroup {
  readonly [Symbol.toStringTag] = 'WaitGroup';

  #counters: PendingCounter[] = [];
  #waiting = false;

  /** The number of registered units of work that have not completed yet. */
  get count(): number {
    return this.#counters.length;
  }

  /** Whether a call to {@link wait} is currently in progress. */
  get waiting(): boolean {
    return this.#waiting;
  }

  /**
   * Registers `count` units of work.
   *
   * @param count Number of units to register. Must be a non-negative integer.
   * Defaults to `1`.
   * @throws {TypeError} If `count` is not a number.
   * @throws {RangeError} If `count` is not a non-negative integer.
   * @throws {WaitGroupStateError} If {@link wait} is currently in progress.
   */
  add(count = 1): void {
    if (this.#waiting) {
      throw new WaitGroupStateError(
        "Can't call `add` if there's an `wait` call waiting resolution",
        'ERR_WAIT_GROUP_ADD_WHILE_WAITING',
      );
    }

    if (typeof count !== 'number') {
      throw new TypeError('`count` must be a number');
    }

    if (!Number.isInteger(count)) {
      throw new RangeError('`count` must be an integer');
    }

    if (count < 0) {
      throw new RangeError('`count` must be greater than or equal to 0');
    }

    for (let i = 0; i < count; i += 1) {
      this.#counters.push(createCounter());
    }
  }

  /**
   * Marks one registered unit of work as complete.
   *
   * If `error` is provided, the pending {@link wait} call is rejected with it
   * immediately and the remaining counters are discarded.
   *
   * @param error Optional rejection reason forwarded to {@link wait}. `null`
   * and `undefined` are treated as successful completion.
   * @throws {WaitGroupStateError} If {@link wait} was not called first, or if
   * no counters remain.
   */
  done(error?: unknown): void {
    if (!this.#waiting) {
      throw new WaitGroupStateError(
        "Can't call `done` before `wait`",
        'ERR_WAIT_GROUP_DONE_BEFORE_WAIT',
      );
    }

    const counter = this.#counters.shift();

    if (!counter) {
      throw new WaitGroupStateError(
        "Can't call `done` when there are no counters",
        'ERR_WAIT_GROUP_DONE_EMPTY',
      );
    }

    if (error !== undefined && error !== null) {
      counter.reject(error);
    } else {
      counter.resolve();
    }
  }

  /**
   * Waits for every registered unit of work to complete.
   *
   * If `timeout` is provided and expires first, the returned promise rejects
   * with a {@link WaitGroupTimeoutError} and the group is reset so it can be
   * reused.
   *
   * @param timeout Optional timeout in milliseconds. Must be a positive,
   * finite number.
   * @returns A promise that resolves once every counter has completed.
   * @throws {TypeError} If `timeout` is not a number.
   * @throws {RangeError} If `timeout` is not a positive, finite number.
   * @throws {WaitGroupStateError} If another {@link wait} call is in progress
   * or no counters are registered.
   */
  wait(timeout?: number): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      if (this.#waiting) {
        reject(
          new WaitGroupStateError(
            "There's already an `wait` call waiting resolution",
            'ERR_WAIT_GROUP_WAIT_IN_PROGRESS',
          ),
        );
        return;
      }

      if (this.#counters.length === 0) {
        reject(
          new WaitGroupStateError(
            "Can't call `wait` when there are no counters",
            'ERR_WAIT_GROUP_EMPTY',
          ),
        );
        return;
      }

      if (timeout !== undefined) {
        if (typeof timeout !== 'number' || Number.isNaN(timeout)) {
          reject(new TypeError('`timeout` must be a number'));
          return;
        }

        if (!Number.isFinite(timeout) || timeout <= 0) {
          reject(new RangeError('`timeout` must be a positive, finite number'));
          return;
        }
      }

      this.#waiting = true;

      let timer: ReturnType<typeof setTimeout> | undefined;

      const settle = (): void => {
        if (timer !== undefined) {
          clearTimeout(timer);
          timer = undefined;
        }

        this.#waiting = false;
      };

      if (timeout !== undefined) {
        timer = setTimeout(() => {
          timer = undefined;
          this.#reset();
          settle();
          reject(new WaitGroupTimeoutError());
        }, timeout);
      }

      void Promise.all(this.#counters.map((counter) => counter.promise)).then(
        () => {
          settle();
          resolve();
        },
        (error: unknown) => {
          this.#reset();
          settle();
          // Rejection reasons are forwarded to the caller verbatim.
          // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
          reject(error);
        },
      );
    });
  }

  #reset(): void {
    this.#counters.length = 0;
  }
}

export default WaitGroup;
