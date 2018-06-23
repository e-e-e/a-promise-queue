class PromiseQueue {
  constructor (options, callback) {
    const cb = (typeof options === 'function') ? options : callback
    const opts = (options && typeof options === 'object') ? options : {}
    this.flushing = false
    this.Promise = opts.promise || Promise
    this.concurrency = (!opts.concurrency || typeof opts.concurrency !== 'number') ? 1 : opts.concurrency
    this.promises = []
    this.queue = []
    this.callback = cb
    if (!cb) {
      this._makePromise()
    }
  }

  _makePromise () {
    this._finalPromise = new Promise((resolve, reject) => {
      this.resolve = resolve
      this.reject = reject
    })
  }

  then (onResolve, onReject) {
    if (this.callback) throw new Error('Cannot use PromiseQueue as a Promise if callback has been is set')
    return this._finalPromise.then(onResolve, onReject)
  }

  catch (onReject) {
    if (this.callback) throw new Error('Cannot use PromiseQueue as a Promise if callback has been is set')
    return this._finalPromise.catch(onReject)
  }

  add (fn, opts) {
    if (typeof fn !== 'function') throw new Error('PromiseQueue.add() expects a function as an argument.')
    return new this.Promise((resolve, reject) => {
      const attempts = (opts && opts.attempts && opts.attempts > 0) ? opts.attempts : 1
      if (this.promises.length < this.concurrency) {
        const id = (this.promises.length) ? this.promises[this.promises.length - 1].id + 1 : 1
        this.promises.push({
          id,
          promise: this._wrap(fn, id, resolve, reject, attempts)
        })
      } else {
        // shift order based on priority
        const next = {
          fn,
          attempts,
          priority: (opts && opts.priority) ? opts.priority : 0,
          resolve,
          reject
        }
        if (!opts || !opts.priority) {
          this.queue.push(next)
        } else {
          let found = false
          for (let i = this.length - 1; i >= 0; i--) {
            if (this.queue[i].priority && this.queue[i].priority >= opts.priority) {
              this.queue.splice(i + 1, 0, next)
              found = true
              break
            }
          }
          if (!found) {
            this.queue.unshift(next)
          }
        }
      }
    })
  }

  flush () {
    const currentPromises = this.promises.map(p => p.promise)
    const concurrent = [...currentPromises, ...this.queue.map(queued => this._promised(queued.fn).then(queued.resolve, queued.reject))]
    this.flushing = true
    this.queue = []

    const flushed = () => {
      this.flushing = false
      if (this.length > 0) {
        // start processing new additions
        const nextFn = this.queue.shift()
        const id = (this.promises.length) ? this.promises[this.promises.length - 1].id + 1 : 1
        const promise = this._wrap(nextFn.fn, id, nextFn.resolve, nextFn.reject, nextFn.attempts)
        this.promises.push({ id, promise })
      }
    }

    return this.Promise.all(concurrent)
      .then(flushed, flushed)
  }

  get length () {
    return this.queue.length
  }

  _promised (fn) {
    try {
      return this.Promise.resolve(fn())
    } catch (e) {
      return this.Promise.reject(e)
    }
  }

  _next (id) {
    if (this.flushing) return
    if (this.length > 0) {
      const nextFn = this.queue.shift()
      return this._wrap(nextFn.fn, id, nextFn.resolve, nextFn.reject, nextFn.attempts)
    }
    const promiseId = this.promises.findIndex(p => {
      return p.id === id
    })
    this.promises.splice(promiseId, 1)
    if (this.promises.length === 0) this._done()
    return true
  }

  _wrap (fn, id, resolve, reject, attempts) {
    let retryCount = 0
    const retry = (err) => {
      if (retryCount >= attempts) {
        throw err || new Error('Unknown Error')
      }
      retryCount += 1
      return this._promised(fn).catch(retry)
    }
    return retry()
      .then((r) => { resolve(r) }, (e) => { reject(e) })
      .then(() => this._next(id))
  }

  _done (err) {
    if (typeof this.callback === 'function') this.callback(err)
    else if (this._finalPromise) {
      this.resolve()
      this._makePromise()
    }
  }
}

module.exports = PromiseQueue
