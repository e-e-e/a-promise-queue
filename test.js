const BlueBirdPromise = require('bluebird')
const tape = require('tape')
const PromiseQueue = require('./index.js')

const fail = t => e => { t.fail(e) }

tape('async functions are executed sequentially', (t) => {
  let counter = 0

  const count = () => { counter += 1 }
  const expectOrder = i => () => { t.same(counter, i) }

  const queue = new PromiseQueue(() => t.end())
  queue.add(() => BlueBirdPromise.delay(100).then(count))
  queue.add(expectOrder(1))
  queue.add(() => BlueBirdPromise.delay(10).then(count))
  queue.add(expectOrder(2))
})

tape('executes callback provided with value when generator is finally executed', (t) => {
  let counter = 0

  const count = () => {
    counter += 1
    return counter
  }
  const expectReturnedValue = i => v => t.same(v, i)

  const queue = new PromiseQueue(() => t.end())
  queue.add(() => BlueBirdPromise.delay(10).then(count)).then(expectReturnedValue(1)).catch(fail(t))
  queue.add(() => BlueBirdPromise.delay(10).then(count)).then(expectReturnedValue(2)).catch(fail(t))
})

tape('prioritises based on priority options', (t) => {
  let counter = 0

  const count = () => { counter += 1 }
  const expectOrder = i => () => t.same(counter, i)

  const queue = new PromiseQueue(() => t.end())
  queue.add(() => BlueBirdPromise.delay(10).then(count), { priority: 0 }).then(expectOrder(1)).catch(fail(t))
  queue.add(() => BlueBirdPromise.delay(10).then(count), { priority: 0 }).then(expectOrder(5)).catch(fail(t))
  queue.add(() => BlueBirdPromise.delay(10).then(count), { priority: 2 }).then(expectOrder(3)).catch(fail(t))
  queue.add(() => BlueBirdPromise.delay(10).then(count), { priority: 0 }).then(expectOrder(6)).catch(fail(t))
  queue.add(() => BlueBirdPromise.delay(10).then(count), { priority: 2 }).then(expectOrder(4)).catch(fail(t))
  queue.add(() => BlueBirdPromise.delay(10).then(count), { priority: 5 }).then(expectOrder(2)).catch(fail(t))
})

tape('does not stop on error', (t) => {
  let counter = 0
  let caught = 0

  const count = () => { counter += 1 }
  const expectOrder = i => () => t.same(counter, i)
  const countCatches = e => { caught += 1 }

  const queue = new PromiseQueue()
  queue.add(() => Promise.reject(new Error('test'))).catch(countCatches)
  queue.add(() => BlueBirdPromise.delay(10).then(count)).catch(fail(t))
  queue.add(() => Promise.reject(new Error('test'))).catch(countCatches)
  queue.add(() => Promise.reject(new Error('test'))).catch(countCatches)
  queue.add(expectOrder(1)).catch(fail(t))
  queue.add(() => {
    t.same(caught, 3)
    t.end()
  })
})

tape('retries for the specified attempts', (t) => {
  let counter = 0
  const failing = () => {
    counter++
    return (counter < 3) ? Promise.reject(new Error('test')) : Promise.resolve()
  }
  const queue = new PromiseQueue()
  queue.add(() => BlueBirdPromise.delay(20)).catch(fail(t))
  queue.add(failing, { attempts: 3 }).catch(fail(t))
  queue.add(() => {
    t.same(counter, 3)
    t.end()
  }).catch(fail(t))
})

tape('retrys for a number of attempts before continuing even if there is an error', (t) => {
  let counter = 0
  const failing = () => {
    counter++
    return (counter < 8) ? Promise.reject(new Error('test')) : Promise.resolve()
  }
  const queue = new PromiseQueue()
  queue.add(failing, { attempts: 10 }).catch(fail(t))
  queue.add(() => {
    t.same(counter, 8)
    t.end()
  }).catch(fail(t))
})

tape('.flush() causes all promises in queue to be run at once and promises added after run after flush is finished', (t) => {
  const queue = new PromiseQueue()
  let counter = 0
  let flushed = false
  const count = () => { counter += 1 }
  queue.add(() => BlueBirdPromise.delay(20).then(count))
  queue.add(() => BlueBirdPromise.delay(20).then(count))
  queue.add(() => BlueBirdPromise.delay(20).then(count))
  queue.add(() => BlueBirdPromise.delay(20).then(count))
  queue.flush().then(() => {
    flushed = true
    t.same(counter, 4)
  })
  queue.add(() => BlueBirdPromise.delay(20).then(count))
    .then(() => {
      t.same(counter, 5)
      t.ok(flushed)
      t.end()
    })
})

tape('is reusable', (t) => {
  let doneCounter = 0
  let counter = 0

  const finished = () => {
    doneCounter++
    if (doneCounter === 2) t.end()
  }
  const count = () => { counter += 1 }
  const expectOrder = i => () => t.same(counter, i)

  const queue = new PromiseQueue(finished)
  queue.add(() => BlueBirdPromise.delay(20).then(count)).catch(fail(t))
  queue.add(expectOrder(1)).catch(fail(t))

  BlueBirdPromise.delay(40).then(() => {
    queue.add(() => BlueBirdPromise.delay(10).then(count)).catch(fail(t))
    queue.add(expectOrder(2)).catch(fail(t))
  })
})

tape('can be configured with concurrency', (t) => {
  let i
  const finished = () => {
    t.end()
  }

  const queue = new PromiseQueue({ concurrency: 5 }, finished)
  for (i = 0; i < 5; i++) {
    queue.add(() => BlueBirdPromise.delay(20))
  }
  t.same(queue.length, 0)
  for (i = 0; i < 5; i++) {
    queue.add(() => BlueBirdPromise.delay(20))
  }
  t.same(queue.length, 5)
})

tape('can be configured with custom promises', (t) => {
  const queue = new PromiseQueue({ promise: BlueBirdPromise })
  t.same(queue.Promise, BlueBirdPromise)
  t.end()
})

tape('uses native promises by default', (t) => {
  const queue = new PromiseQueue()
  t.same(queue.Promise, Promise)
  t.end()
})

tape('promise queue can be returned as if it is a promise', (t) => {
  let count = 0
  const queue = new PromiseQueue()
  for (let i = 0; i < 5; i++) {
    queue.add(() => BlueBirdPromise.delay(5).then(() => count++))
  }
  queue.then(() => {
    t.same(count, 5)
    t.same(queue.length, 0)
    t.end()
  })
})

tape('promise queue is reuseable as a promise', (t) => {
  let count = 0
  const queue = new PromiseQueue()
  for (let i = 0; i < 5; i++) {
    queue.add(() => BlueBirdPromise.delay(5).then(() => count++))
  }
  queue.then(() => {
    t.same(count, 5)
    t.same(queue.length, 0)
    for (let i = 0; i < 5; i++) {
      queue.add(() => BlueBirdPromise.delay(5).then(() => count++))
    }
    return queue
  })
  .then(() => {
    t.same(count, 10)
    t.same(queue.length, 0)
    t.end()
  })
})

tape('if promise queue has callback it cannot be used as promise', (t) => {
  const finished = () => {}
  const queue = new PromiseQueue(finished)
  t.throws(() => queue.then(), /Cannot use PromiseQueue as a Promise if callback has been is set/)
  t.throws(() => queue.catch(), /Cannot use PromiseQueue as a Promise if callback has been is set/)
  t.end()
})

tape('throws error if queue.add() is not passed a function', (t) => {
  const finished = () => {}
  const queue = new PromiseQueue(finished)
  t.throws(() => queue.add(), /PromiseQueue.add\(\) expects a function as an argument/)
  t.end()
})

tape('queue.add() handles non promise returning functions', (t) => {
  const finished = () => { t.end() }
  const queue = new PromiseQueue(finished)
  queue.add(() => 1).then(res => t.same(res, 1))
})

tape('queue.add() handles non promise returning functions that throw', (t) => {
  const queue = new PromiseQueue()
  queue.add(() => { throw new Error('failed') })
    .then(
      () => t.fail('should have actually thrown error'),
      (e) => {
        t.same(e.message, 'failed')
        t.end()
      }
    )
})
