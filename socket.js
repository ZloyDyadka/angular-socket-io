/*
 * angular-socket-io v0.4.2
 */

(function() {

    'use strict';

    angular.module('socket-io', []).
        provider('socketFactory', function() {

            // when forwarding events, prefix the event name

            var prefix = 'socket:',
                ioSocket;

            // expose to provider
            this.$get = function($rootScope, $timeout) {

                var asyncAngularify = function(socket, callback) {
                    return callback ? function() {
                        var args = arguments;
                        $timeout(function() {
                            callback.apply(socket, args);
                        }, 0);
                    } : angular.noop;
                };

                return function socketFactory(options) {
                    options = options || {};

                    var wrappedSocket = {},
                        socket = options.ioSocket || io.connect(),
                        prefix = options.prefix || prefix,
                        defaultScope = options.scope || $rootScope;

                    wrappedSocket.manager = socket.io;

                    wrappedSocket.on = function(eventName, callback) {
                        socket.on(eventName, callback.__ng = asyncAngularify(socket, callback));
                    };

                    wrappedSocket.once = function(eventName, callback) {
                        socket.once(eventName, callback.__ng = asyncAngularify(socket, callback));
                    };

                    wrappedSocket.emit = function(eventName, data, callback) {
                        var lastIndex = arguments.length - 1;
                        callback = arguments[lastIndex];


                        if (_.isFunction(callback)) {
                            callback = asyncAngularify(socket, callback);
                            arguments[lastIndex] = callback;
                        }

                        return socket.emit.apply(socket, arguments);
                    };

                    wrappedSocket.removeListener = function(ev, fn) {
                        if (fn && fn.__ng) {
                            arguments[1] = fn.__ng;
                        }

                        return socket.removeListener.apply(socket, arguments);
                    };

                    wrappedSocket.removeAllListeners = function() {
                        return socket.removeAllListeners.apply(socket, arguments);
                    };

                    // when socket.on('someEvent', fn (data) { ... }),
                    // call scope.$broadcast('someEvent', data)
                    wrappedSocket.forward = function(events, scope) {
                        if (events instanceof Array === false) {
                            events = [events];
                        }
                        if (!scope) {
                            scope = defaultScope;
                        }
                        events.forEach(function(eventName) {
                            var prefixedEvent = prefix + eventName,
                                forwardBroadcast = asyncAngularify(socket, function(data) {
                                    scope.$broadcast(prefixedEvent, data);
                                });

                            scope.$on('$destroy', function() {
                                socket.removeListener(eventName, forwardBroadcast);
                            });
                            socket.on(eventName, forwardBroadcast);
                        });
                    };

                    return wrappedSocket;
                };
            };
        });
}
)();
