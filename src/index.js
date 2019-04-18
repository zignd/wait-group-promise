'use strict';

const Promise = require('bluebird');
Promise.config({
  cancellation: true
});

class WaitGroup {
  constructor() {
    this.waiting = false;
    this.counters = [];
  }

  add(counter = 1) {
    if (this.waiting)
      throw new Error('Can\'t call `add` if there\'s an `wait` call waiting resolution');

    for (let i = 0; i < counter; i++) {
      let res = null, rej = null;
      const promise = new Promise((resolve, reject) => {
        res = resolve;
        rej = reject;
      });
      this.counters.push({
        promise,
        resolve: res,
        reject: rej
      });
    }
  }

  done(err) {
    if (!this.waiting)
      throw new Error('Can\'t call `done` before `wait`');

    const counter = this.counters.splice(0, 1)[0];
    if (!counter)
      throw new Error('Can\'t call `done` when there are no counters');

    if (err)
      return counter.reject(err);

    counter.resolve();
  }

  wait(timeout) {
    return new Promise((resolve, reject) => {
      if (this.waiting)
        throw new Error('There\'s already an `wait` call waiting resolution');

      if (this.counters.length === 0)
        throw new Error('Can\'t call `wait` when there are no counters');

      let timeoutId;
      if (timeout) {
        timeoutId = setTimeout(() => {
          for (const counter of this.counters)
            counter.promise.cancel();
          reject(new Error('Timeout reached'));
        }, timeout);
      }

      this.waiting = true;
      Promise.all(this.counters.map((counter) => counter.promise)).then(() => {
        return resolve();
      }).catch((err) => {
        return reject(err);
      }).finally(() => {
        clearTimeout(timeoutId);
        this.waiting = false;
      });
    });
  }
}

module.exports = WaitGroup;