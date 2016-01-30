'use strict';

var HttpConnectProxy = require('../lib/server');
var proxy = new HttpConnectProxy();

proxy.listen(9999, function () {
    console.log('PROXY Server Listening');
});

proxy.on('connect', function (port, host, socket) {
    var time = new Date().toISOString().substr(0, 19).replace('T', '');
    console.log('[%s] From %s to %s:%s', time, socket.remoteAddress, host, port);
});

// curl -i -x http://127.0.0.1:9999 https://google.com
