'use strict';

var net = require('net');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

module.exports = HttpConnectProxy;

function HttpConnectProxy() {
    EventEmitter.call(this);
    this.server = net.createServer(this._onConnect.bind(this));
    this.server.on('error', this._onError.bind(this));
}
util.inherits(HttpConnectProxy, EventEmitter);

// forward net emthods
['listen', 'close'].forEach(function (method) {
    HttpConnectProxy.prototype[method] = function () {
        var args = Array.prototype.slice.call(arguments);
        this.server[method].apply(this.server, args);
    };
});

HttpConnectProxy.prototype._onError = function (err) {
    this.emit('error', err);
};

HttpConnectProxy.prototype._onConnect = function (socket) {
    var done = false;
    var headers = '';
    var that = this;

    var waitTimeout = setTimeout(function () {
        socket.write('HTTP/1.1 500 Proxy Timeout\r\n\r\n');
        done = true;
    }, 10000);

    var onSocketError = function (err) {
        console.log(err.stack);
        clearTimeout(waitTimeout);
    };

    socket.on('close', function () {
        done = true;
        clearTimeout(waitTimeout);
    });

    var onSocketReadable = function () {
        var chunk;
        var str;
        var match;
        var remainder;
        var host;
        var port;
        var out;

        while (!done && (chunk = socket.read()) !== null) {
            str = chunk.toString('binary');
            headers += str;
            if ((match = headers.match(/\r\n\r\n/))) {
                remainder = headers.substr(match.index + match[0].length);
                headers = headers.substr(0, match.index);

                if (remainder) {
                    socket.unshift(new Buffer(remainder, 'binary'));
                }

                done = true;
                clearTimeout(waitTimeout);
                socket.removeListener('readable', onSocketReadable);
                match = headers.split('\r\n').shift().match(/^CONNECT\s+([^\s]+)\s+HTTP\/[\d\.]+$/i);

                if (!match) {
                    socket.write('HTTP/1.1 500 Invalid Method\r\n\r\n');
                    return socket.end();
                } else {
                    host = match[1].replace(/[\[\]]/g, '').replace(/^IPv\d\:/i, '');
                    host = host.split(':');
                    port = Number(host.pop()) || 80;
                    host = host.join(':');
                }

                if (!host || !port) {
                    socket.write('HTTP/1.1 500 Invalid Target\r\n\r\n');
                    return socket.end();
                }

                out = net.createConnection(port, host, function () {
                    socket.pipe(out);
                    out.pipe(socket);

                    socket.removeListener('error', onSocketError);
                    socket.on('error', function ( /*err*/ ) {
                        out.end();
                    });
                    socket.write('HTTP/1.1 200 OK\r\n\r\n');

                    that.emit('connect', port, host, socket);
                });

                out.on('error', function (err) {
                    socket.emit('error', err);
                });

                break;
            }

        }
    };

    socket.on('readable', onSocketReadable);
    socket.on('error', onSocketError);
};
