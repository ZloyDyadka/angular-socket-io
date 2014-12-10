/*
 * angular-socket-io-manager v1.0
 */

(function() {

    'use strict';

    /* array with sockets instance */
    var ioSockets = {};

    angular.module('socket-io', []).
        provider('socketManager', function() {

            // when forwarding events, prefix the event name

            var prefix      = 'socket:';

            // expose to provider
            this.$get = ['$rootScope', '$timeout', '$q', function($rootScope, $timeout, $q) {

                var asyncAngularify = function(socket, callback) {
                    return callback ? function() {
                        var args = arguments;
                        $timeout(function() {
                            callback.apply(socket, args);
                        }, 0);
                    } : angular.noop;
                };

                return {
                    /*
                    * @function open
                    * @param {string} instance name
                    * @param {boolean} if required connect
                    * @param {object} connection options
                    */
                    'open' : function(name, requiredConnection, options) {
                        var defer = $q.defer();

                        function socketConnect(params) {
                            var socket,
                                defer = $q.defer();

                            try {
                                if (params !== null) {
                                    socket = io.connect(params.host + ':' + params.port, params);
                                } else {
                                    socket = io.connect();
                                }
                            } catch (e) {
                                defer.reject(e);
                            }

                            if (requiredConnection) {
                                socket.once('connect', function() {
                                    defer.resolve(socket);
                                });

                                socket.once('connect_error', function() {
                                    defer.reject('Connection error');
                                });
                            } else {
                                defer.resolve(socket);
                            }

                            return defer.promise;
                        }

                        if (name.length > 0) {
                            var wrappedSocket = {},
                                prefix        = options.prefix || prefix,
                                defaultScope  = options.scope || $rootScope,
                                connParams    = options.connParams || null,
                                socket;

                            socketConnect(connParams).then(function(sock) {
                                var socket = sock;

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

                                ioSockets[name] = wrappedSocket;

                                defer.resolve(wrappedSocket);
                            }).catch(function(e) {
                                defer.reject(e);
                            });
                        } else {
                            defer.reject('Not specified socket instance name!');
                        }

                        return defer.promise;
                    },

                    /*
                     * @function get
                     * @param {string} instance name
                     */
                    'get' : function(name) {
                        if (ioSockets[name]) {
                            return ioSockets[name];
                        } else {
                            throw Error('Socket instance not found!');
                        }
                    }
                }
            }];
        });
}
)();

