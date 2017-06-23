const Promise = require('bluebird');
const tape = require('tape');
const PromiseQueue = require('./index.js');

const fail = t => e => { t.fail(e) };

tape('async functions are executed sequentially', (t) => {
  let counter = 0;

  const count = () => { counter += 1; };
  const expectOrder = i => () => { t.same(counter,i); };

  const queue = new PromiseQueue(() => t.end());
  queue.add(() => Promise.delay(100).then(count));
  queue.add(expectOrder(1));
  queue.add(() => Promise.delay(10).then(count));
  queue.add(expectOrder(2));
});

tape('executes callback provided with value when generator is finally executed', (t) => {
  let counter = 0;

  const count = () => {
    counter += 1;
    return counter;
  };
  const expectReturnedValue = i => v => t.same(v, i);

  const queue = new PromiseQueue(() => t.end());
  queue.add(() => Promise.delay(10).then(count)).then(expectReturnedValue(1)).catch(fail(t));;
  queue.add(() => Promise.delay(10).then(count)).then(expectReturnedValue(2)).catch(fail(t));;
});

tape('prioritises based on priority options', (t) => {
  let counter = 0;

  const count = () => { counter += 1; };
  const expectOrder = i => () => t.same(counter, i);

  const queue = new PromiseQueue(() => t.end());
  queue.add(() => Promise.delay(10).then(count), { priority: 0 }).then(expectOrder(1)).catch(fail(t));
  queue.add(() => Promise.delay(10).then(count), { priority: 0 }).then(expectOrder(5)).catch(fail(t));
  queue.add(() => Promise.delay(10).then(count), { priority: 2 }).then(expectOrder(3)).catch(fail(t));
  queue.add(() => Promise.delay(10).then(count), { priority: 0 }).then(expectOrder(6)).catch(fail(t));
  queue.add(() => Promise.delay(10).then(count), { priority: 2 }).then(expectOrder(4)).catch(fail(t));
  queue.add(() => Promise.delay(10).then(count), { priority: 5 }).then(expectOrder(2)).catch(fail(t));
});

tape('does not stop on error', (t) => {
  let counter = 0;
  let caught = 0;

  const count = () => { counter += 1; };
  const expectOrder = i => () => t.same(counter, i);
  const countCatches = e => { caught += 1; };

  const queue = new PromiseQueue();
  queue.add(() => Promise.reject()).catch(countCatches);
  queue.add(() => Promise.delay(10).then(count)).catch(fail(t));
  queue.add(() => Promise.reject()).catch(countCatches);
  queue.add(() => Promise.reject()).catch(countCatches);
  queue.add(expectOrder(1)).catch(fail(t));;
  queue.add(() => {
    t.same(caught, 3)
    t.end()
  });
});

tape('retries for the specified attempts', (t) => {
  let counter = 0;
  const failing = () => {
    counter++;
    return (counter < 3) ? Promise.reject() : Promise.resolve();
  };
  const queue = new PromiseQueue();
  queue.add(() => Promise.delay(20)).catch(fail(t));
  queue.add(failing, { attempts: 3 }).catch(fail(t));
  queue.add(() => {
    t.same(counter, 3);
    t.end();
  }).catch(fail(t));
});

tape('retrys for a number of attempts before continuing even if there is an error', (t) => {
  let counter = 0;
  const failing = () => {
    counter++;
    return (counter < 8) ? Promise.reject() : Promise.resolve();
  };
  const queue = new PromiseQueue();
  queue.add(failing, { attempts: 10 }).catch(fail(t));
  queue.add(() => {
    t.same(counter, 8);
    t.end();
  }).catch(fail(t));
});

tape('is reusable', (t) => {
  let doneCounter = 0;
  let counter = 0;

  const finished = () => {
    doneCounter++;
    if (doneCounter === 2) t.end();
  };
  const count = () => { counter += 1; };
  const expectOrder = i => () => t.same(counter, i);

  const queue = new PromiseQueue(finished);
  queue.add(() => Promise.delay(20).then(count)).catch(fail(t));;
  queue.add(expectOrder(1)).catch(fail(t));;

  Promise.delay(40).then(() => {
    queue.add(() => Promise.delay(10).then(count)).catch(fail(t));;
    queue.add(expectOrder(2)).catch(fail(t));;
  });
});
