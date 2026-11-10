import { afterEach, describe, expect, it, vi } from 'vitest';

import DefaultWaitGroup, {
  WaitGroup,
  WaitGroupError,
  WaitGroupStateError,
  WaitGroupTimeoutError,
} from '../src/index.js';

afterEach(() => {
  vi.useRealTimers();
});

describe('module exports', () => {
  it('exposes the same class as a named and a default export', () => {
    expect(DefaultWaitGroup).toBe(WaitGroup);
  });
});

describe('construction', () => {
  it('starts with no counters and without a pending wait', () => {
    const wg = new WaitGroup();

    expect(wg.count).toBe(0);
    expect(wg.waiting).toBe(false);
  });

  it('identifies itself through Symbol.toStringTag', () => {
    expect(Object.prototype.toString.call(new WaitGroup())).toBe('[object WaitGroup]');
  });
});

describe('add', () => {
  it('registers one unit of work by default', () => {
    const wg = new WaitGroup();

    wg.add();

    expect(wg.count).toBe(1);
  });

  it('registers the requested number of units of work', () => {
    const wg = new WaitGroup();

    wg.add(3);

    expect(wg.count).toBe(3);
  });

  it('accepts zero as a no-op', () => {
    const wg = new WaitGroup();

    wg.add(0);

    expect(wg.count).toBe(0);
  });

  it('rejects non-number counts', () => {
    const wg = new WaitGroup();

    expect(() => wg.add('2' as unknown as number)).toThrowError(
      new TypeError('`count` must be a number'),
    );
  });

  it('rejects non-integer counts', () => {
    const wg = new WaitGroup();

    expect(() => wg.add(1.5)).toThrowError(new RangeError('`count` must be an integer'));
  });

  it('rejects negative counts', () => {
    const wg = new WaitGroup();

    expect(() => wg.add(-1)).toThrowError(
      new RangeError('`count` must be greater than or equal to 0'),
    );
  });

  it('rejects additions while a wait is pending', async () => {
    const wg = new WaitGroup();
    wg.add(1);
    const waiting = wg.wait();

    expect(() => wg.add()).toThrowError(
      new WaitGroupStateError(
        "Can't call `add` if there's an `wait` call waiting resolution",
        'ERR_WAIT_GROUP_ADD_WHILE_WAITING',
      ),
    );

    wg.done();
    await expect(waiting).resolves.toBeUndefined();
  });
});

describe('done', () => {
  it('rejects calls made before wait', () => {
    const wg = new WaitGroup();

    expect(() => wg.done()).toThrowError(
      new WaitGroupStateError("Can't call `done` before `wait`", 'ERR_WAIT_GROUP_DONE_BEFORE_WAIT'),
    );
  });

  it('rejects calls made after every counter has completed', async () => {
    const wg = new WaitGroup();
    wg.add(1);
    const waiting = wg.wait();

    wg.done();

    expect(() => wg.done()).toThrowError(
      new WaitGroupStateError(
        "Can't call `done` when there are no counters",
        'ERR_WAIT_GROUP_DONE_EMPTY',
      ),
    );

    await expect(waiting).resolves.toBeUndefined();
  });

  it('completes counters one at a time', async () => {
    const wg = new WaitGroup();
    wg.add(2);
    const waiting = wg.wait();

    wg.done();
    expect(wg.count).toBe(1);

    wg.done();
    expect(wg.count).toBe(0);
    await expect(waiting).resolves.toBeUndefined();
  });

  it('treats null and undefined as successful completion', async () => {
    const wg = new WaitGroup();
    wg.add(2);
    const waiting = wg.wait();

    wg.done(null);
    wg.done(undefined);

    await expect(waiting).resolves.toBeUndefined();
  });

  it('rejects the pending wait with the provided error', async () => {
    const wg = new WaitGroup();
    wg.add(2);
    const waiting = wg.wait();
    const failure = new Error('Something happened');

    wg.done(failure);

    await expect(waiting).rejects.toBe(failure);
    expect(wg.count).toBe(0);
  });

  it('rejects the pending wait with non-Error reasons', async () => {
    const wg = new WaitGroup();
    wg.add(1);
    const waiting = wg.wait();

    wg.done('Something happened');

    await expect(waiting).rejects.toBe('Something happened');
  });

  it('rejects the pending wait with falsy non-nullish reasons', async () => {
    const wg = new WaitGroup();
    wg.add(1);
    const waiting = wg.wait();

    wg.done(0);

    await expect(waiting).rejects.toBe(0);
  });
});

describe('wait', () => {
  it('resolves once every counter has completed', async () => {
    const wg = new WaitGroup();
    wg.add(2);
    const waiting = wg.wait();

    setTimeout(() => {
      wg.done();
      wg.done();
    }, 10);

    await expect(waiting).resolves.toBeUndefined();
    expect(wg.count).toBe(0);
    expect(wg.waiting).toBe(false);
  });

  it('rejects when no counters are registered', async () => {
    const wg = new WaitGroup();

    await expect(wg.wait()).rejects.toMatchObject({
      name: 'WaitGroupStateError',
      code: 'ERR_WAIT_GROUP_EMPTY',
      message: "Can't call `wait` when there are no counters",
    });
  });

  it('rejects a second concurrent wait', async () => {
    const wg = new WaitGroup();
    wg.add(2);
    const first = wg.wait();

    await expect(wg.wait()).rejects.toMatchObject({
      name: 'WaitGroupStateError',
      code: 'ERR_WAIT_GROUP_WAIT_IN_PROGRESS',
      message: "There's already an `wait` call waiting resolution",
    });

    wg.done();
    wg.done();
    await expect(first).resolves.toBeUndefined();
  });

  it('can be reused after a successful wait', async () => {
    const wg = new WaitGroup();

    wg.add(1);
    const first = wg.wait();
    wg.done();
    await expect(first).resolves.toBeUndefined();

    wg.add(1);
    const second = wg.wait();
    wg.done();
    await expect(second).resolves.toBeUndefined();
  });

  it('can be reused after a failed wait', async () => {
    const wg = new WaitGroup();
    wg.add(2);
    const first = wg.wait();

    wg.done(new Error('Something happened'));
    await expect(first).rejects.toThrow('Something happened');
    expect(wg.count).toBe(0);
    expect(wg.waiting).toBe(false);

    wg.add(1);
    const second = wg.wait();
    wg.done();
    await expect(second).resolves.toBeUndefined();
  });

  it('rejects invalid timeouts', async () => {
    const cases = [
      { label: 'a string', timeout: '100' as unknown as number, error: TypeError },
      { label: 'NaN', timeout: Number.NaN, error: TypeError },
      { label: 'Infinity', timeout: Number.POSITIVE_INFINITY, error: RangeError },
      { label: 'zero', timeout: 0, error: RangeError },
      { label: 'a negative number', timeout: -1, error: RangeError },
    ];

    for (const { label, timeout, error } of cases) {
      const wg = new WaitGroup();
      wg.add(1);

      await expect(wg.wait(timeout), label).rejects.toBeInstanceOf(error);
    }
  });

  it('rejects with a timeout error and resets the group', async () => {
    vi.useFakeTimers();
    const wg = new WaitGroup();
    wg.add(2);
    const waiting = wg.wait(1_000);
    const expectation = expect(waiting).rejects.toMatchObject({
      name: 'WaitGroupTimeoutError',
      code: 'ERR_WAIT_GROUP_TIMEOUT',
      message: 'Timeout reached',
    });

    await vi.advanceTimersByTimeAsync(1_000);
    await expectation;

    expect(wg.count).toBe(0);
    expect(wg.waiting).toBe(false);
    expect(() => wg.done()).toThrowError(
      new WaitGroupStateError("Can't call `done` before `wait`", 'ERR_WAIT_GROUP_DONE_BEFORE_WAIT'),
    );

    wg.add(1);
    const next = wg.wait();
    wg.done();
    await expect(next).resolves.toBeUndefined();
  });

  it('clears the timeout timer once the wait settles', async () => {
    vi.useFakeTimers();
    const wg = new WaitGroup();
    wg.add(1);
    const waiting = wg.wait(1_000);

    wg.done();
    await expect(waiting).resolves.toBeUndefined();

    expect(vi.getTimerCount()).toBe(0);
    expect(wg.waiting).toBe(false);
  });
});

describe('errors', () => {
  it('exposes a stable code and name on state errors', () => {
    const error = new WaitGroupStateError('broken', 'ERR_WAIT_GROUP_ADD_WHILE_WAITING');

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(WaitGroupError);
    expect(error.name).toBe('WaitGroupStateError');
    expect(error.code).toBe('ERR_WAIT_GROUP_ADD_WHILE_WAITING');
    expect(error.message).toBe('broken');
  });

  it('provides a default message for timeout errors', () => {
    const error = new WaitGroupTimeoutError();

    expect(error).toBeInstanceOf(WaitGroupError);
    expect(error.name).toBe('WaitGroupTimeoutError');
    expect(error.code).toBe('ERR_WAIT_GROUP_TIMEOUT');
    expect(error.message).toBe('Timeout reached');
  });

  it('accepts a custom timeout message', () => {
    expect(new WaitGroupTimeoutError('Took too long').message).toBe('Took too long');
  });
});
