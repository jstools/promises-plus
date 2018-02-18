/* global process */

(function (root, factory) {
  if( typeof exports === 'object' && typeof module !== 'undefined' ) {
    // CommonJS
    module.exports = factory();
  } else if( typeof define === 'function' && define.amd ) {
      // AMD. Register as an anonymous module.
      define([], factory);
  } else {
      // Browser globals
      root.Parole = factory();
  }
})(this, function () {

  var nextTick = typeof process === 'object' && typeof process.nextTick === 'function' ? process.nextTick :
      (function (global) {
        if( 'MessageChannel' in global ) return (function (mc) {
          var callback;
          mc.port1.onmessage = function () { callback(); };
          return function (_callback) {
            callback = _callback;
            mc.port2.postMessage(0);
          };
        })( new MessageChannel() );
        if( 'MutationObserver' in global ) return (function (node) {
          return function (callback) {
            var observer = new MutationObserver(function () {
              callback();
              observer.disconnect();
            });
            observer.observe( node, {characterData: true} );
            node.data = false;
          };
        })( document.createTextNode('') );
        return global.setImmediate || global.setTimeout;
      })( typeof window === 'object' ? window : this );

  function once (fn) {
    return function () {
      if( fn ) fn.apply(this, arguments);
      fn = null;
    };
  }

  function isObjectLike (x) {
    return ( typeof x === 'object' || typeof x === 'function' );
  }

  function isThenable (x) {
    return isObjectLike(x) && 'then' in x;
  }

  function runThenable (then, xThen, p, x, resolve, reject) {
    try {
      then.call(x, function (value) {
        xThen(p, value, true, resolve, reject);
      }, function (reason) {
        xThen(p, reason, false, resolve, reject);
      });
    } catch(err) {
      xThen(p, err, false, resolve, reject);
    }
  }

  function xThen (p, x, fulfilled, resolve, reject) {
    var then;

    if( x && isObjectLike(x) ) {
      try {
        if( x === p ) throw new TypeError('A promise can not be resolved by itself');
        then = x.then;

        if( fulfilled && typeof then === 'function' ) {
          runThenable(then, once(xThen), p, x, resolve, reject);
        } else {
          (fulfilled ? resolve : reject)(x);
        }
      } catch (reason) {
        reject(reason);
      }
    } else {
      (fulfilled ? resolve : reject)(x);
    }
  }

  function _runQueue (queue) {
    for( var i = 0, n = queue.length ; i < n ; i++ ) {
      queue[i]();
    }
  }

  function Parole (resolver) {
    if( !(this instanceof Parole) ) return new Parole(resolver);

    var p = this,
        reject = function (reason) {
          if( p.fulfilled || p.rejected ) return;
          p.rejected = true;
          p.value = reason;
          nextTick(function () { _runQueue(p.queue); });
        };

    p.queue = [];

    resolver(function (value) {
      xThen(p, value, true, function (result) {
        if( p.fulfilled || p.rejected ) return;
        p.fulfilled = true;
        p.value = result;
        nextTick(function () { _runQueue(p.queue); });
      }, reject);
    }, reject);
  }

  Parole.prototype.then = function (onFulfilled, onRejected) {
    var p = this;
    return new Parole(function (resolve, reject) {

      function complete () {
        var then = p.fulfilled ? onFulfilled : onRejected;
        if( typeof then === 'function' ) {
          try {
            resolve( then(p.value) );
          } catch(reason) {
            reject( reason );
          }
        } else if( p.fulfilled ) resolve(p.value);
        else reject(p.value);
      }

      if( !p.fulfilled && !p.rejected ) {
        p.queue.push(complete);
      } else {
        nextTick(complete);
      }

    });
  };

  Parole.prototype.catch = function (onRejected) {
    return this.then(null, onRejected);
  };

  // Promise methods

  Parole.defer = function () {
    var deferred = {};
    deferred.promise = new Parole(function (resolve, reject) {
      deferred.resolve = resolve;
      deferred.reject = reject;
    });
    return deferred;
  };

  Parole.when = function (x) { return ( x && x.then ) ? x : Parole.resolve(x); };

  Parole.resolve = function (value) {
    return new Parole(function (resolve) {
      resolve(value);
    });
  };

  Parole.reject = function (value) {
    return new Parole(function (resolve, reject) {
      reject(value);
    });
  };

  Parole.all = function (promises) {
    var waiting_promises = promises.length;
    return new Parole(function (resolve, reject) {
      var results = new Array(waiting_promises);
      promises.forEach(function (promise, i) {
        var addresult = function (result) {
          results[i] = result;
          waiting_promises--;
          if( !waiting_promises ) resolve(results);
        };
        if( isThenable(promise) ) promise.then.call(promise, addresult, reject);
        else addresult(promise);
      });
    });
  };

  Parole.race = function (promises) {
    return new Parole(function (resolve, reject) {
      promises.forEach(function (promise) {
        if( isThenable(promise) ) promise.then.call(promise, resolve, reject);
        else resolve(promise);
      });
    });
  };

  return Parole;

});
