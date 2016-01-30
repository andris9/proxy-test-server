'use strict';

var net = require('net');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

function HttpConnectProxy() {
    EventEmitter.call(this);
    this.server = net.createServer(this._onConnect.bind(this));
    this.server.on('error', this._onError.bind(this));
}
util.inherits(HttpConnectProxy, EventEmitter);

HttpConnectProxy.prototype.listen = function () {
    var args = Array.prototype.slice.call(arguments);
    this.server.listen.apply(this.server, args);
};

HttpConnectProxy.prototype._onError = function (err) {
    console.log(err.stack);
};

HttpConnectProxy.prototype._onConnect = function (socket) {
    var done = false;
    var headers = '';

    var onSocketError = function (err) {
        console.log(err.stack);
    };

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
                socket.removeListener('readable', onSocketReadable);
                match = headers.split('\r\n').shift().match(/^CONNECT\s+([^\s]+)\s+HTTP\/[\d\.]+$/i);

                if (!match) {
                    console.log('Only CONNECT is allowed');
                    return socket.end();
                } else {
                    host = match[1].replace(/[\[\]]/g, '').replace(/^IPv\d\:/i, '');
                    host = host.split(':');
                    port = Number(host.pop()) || 80;
                    host = host.join(':');
                }

                if (!host || !port) {
                    console.log('Invalid connection arguments');
                    return socket.end();
                }

                out = net.createConnection(port, host, function () {
                    console.log('Connected to %s:%s', port, host);

                    socket.pipe(out);
                    out.pipe(socket);

                    socket.removeListener('error', onSocketError);
                    socket.on('error', function (err) {
                        out.end();
                        console.log(err);
                    });
                    socket.write('HTTP/1.1 200 OK\r\n\r\n');
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


var p = new HttpConnectProxy();
p.listen(9999);
