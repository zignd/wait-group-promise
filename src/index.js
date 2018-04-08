'use strict';

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

  done() {
    if (this.counters.length === 0)
      throw new Error('Can\'t call `done` when there are no counters');
      
    const counter = this.counters.splice(0, 1)[0];
    if (counter)
      counter.resolve();
  }

  async wait() {
    if (this.waiting)
      throw new Error('There\'s already an `wait` call waiting resolution');
    
    this.waiting = true;
    await Promise.all(this.counters.map((counter) => counter.promise));
    this.waiting = false;
  }
}

module.exports = WaitGroup;