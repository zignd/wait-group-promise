'use strict';

const test = require('ava').test;

const WaitGroup = require('../src');

test('Should wait for the counters to resolve', async (t) => {
  const wg = new WaitGroup();
  t.is(wg.counters.length, 0);

  wg.add(2);
  t.is(wg.counters.length, 2);

  const wgWaiting = wg.wait();

  setTimeout(() => {
    wg.done();
    t.is(wg.counters.length, 0);
  }, 50);

  setTimeout(() => {
    wg.done();
    t.is(wg.counters.length, 1);
  }, 30);

  await wgWaiting;
  t.is(wg.counters.length, 0);
  t.is(wg.waiting, false);
});

test('Should throw an error when you try to `add` a counter, but wait have been called and have not been resolved yet', async (t) => {
  const wg = new WaitGroup();
  wg.add(2);
  wg.wait();
  try {
    wg.add(1);
    t.fail('Should have thrown an error');
  } catch (err) {
    t.is(err.message, 'Can\'t call `add` if there\'s an `wait` call waiting resolution');
  }
});

test('Should throw an error when you try to call `wait` more than once without the resolution of the first attempt', async (t) => {
  const wg = new WaitGroup();
  wg.add(2);
  wg.wait();
  try {
    await wg.wait();
    t.fail('Should have thrown an error');
  } catch (err) {
    t.is(err.message, 'There\'s already an `wait` call waiting resolution');
  }
});

test('Should throw an error when you try to call `done` and there are no counters', async (t) => {
  const wg = new WaitGroup();
  try {
    await wg.done();
    t.fail('Should have thrown an error');
  } catch (err) {
    t.is(err.message, 'Can\'t call `done` before `wait`');
  }
});

test('Should throw the error passed to `done` through the `wait` call without having to wait for the resolution of the other counters', async (t) => {
  const wg = new WaitGroup();
  wg.add(2);
  const p = wg.wait();
  try {
    wg.done(new Error('Something happened'));
    await p;
    t.fail('Should have thrown an error');
  } catch (err) {
    t.is(err.message, 'Something happened');
  }
});