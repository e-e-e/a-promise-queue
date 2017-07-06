# a promise queue

[![Build Status](https://travis-ci.org/e-e-e/a-promise-queue.svg?branch=master)](https://travis-ci.org/e-e-e/a-promise-queue) [![Coverage Status](https://coveralls.io/repos/github/e-e-e/a-promise-queue/badge.svg?branch=master)](https://coveralls.io/github/e-e-e/a-promise-queue?branch=master)

This is just another promise queue. Simple.

+ Native es6
+ No concurency
+ Optional retry attempts for failed promises
+ Option to use your faviour promise flavour (Bluebird, Q)

## Install

You know this:
```
npm install a-promise-queue
```

## Interface

+ `queue = new PromiseQueue([Function callback], [Promise flavour])`
  Callback is fired whenever queue is emptied.
  Optional flavour lets you set the type of promises used, defaults to es6 native promises.
+ `queue.length`
  Returns number of promises waiting to be executed.
+ `var promise = queue.add(Function generator, [Object options])`
  Returns a promise which is resolved or rejected when the promise produced by the generator is eventually resolved.
  Example options:
  ```js
    {
      attempts: number, // if promise fails it will retry this many times.
      priority: number, // execution is ordered by priority default = 0.
    }
  ```
+ `var promise = queue.flush()`
  Runs all promises currently in the queue concurrently.
  Returns a promise which is resolved when all promises are finished.
  Any promises added after `.flush()` will execute after flush is complete.

## Example:

```js
var PromiseQueue = require('a-promise-queue');

var delay = (ms) => () => new Promise(resolve => setTimeout(resolve, ms));

var queue = new PromiseQueue(() => console.log('Queue is empty'));
queue.add(delay(100)).then(() => console.log('first this'));
queue.add(() => Promise.reject('then this fails')).catch((e) => console.log('Errored:', e));
queue.add(delay(10)).then(() => console.log('and this succeeds'));
queue.add(delay(10), { priority: 1 }).then(() => console.log('but not before this one jumps the queue.'));
```
