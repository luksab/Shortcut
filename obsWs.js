const WebSocket = require('ws');

class OBSws {
    constructor(address, logging = false) {
        this.address = address;
        this.logging = logging;

        this.callbacks = {};
        this.sends = {};
        this.currentScene = "";
        this.sceneList = [];
        this.connect();
    }
    connect() {
        this.ws = new WebSocket(this.address);
        var that = this;
        this.ws.onopen = function () {
            if (that.resolve)
                that.resolve();
            that.send("GetAuthRequired").then(function (msg) {
                if (msg.authRequired) {
                    var hash;
                    if (localStorage.getItem("hash") == null) {
                        hash = b64_sha256(window.prompt("password", "a") + msg.salt);
                        localStorage.setItem("hash", hash);
                    } else {
                        hash = localStorage.getItem("hash");
                    }
                    var auth = b64_sha256(hash + msg.challenge)

                    return that.send('Authenticate', { auth: auth }).then(function (msg) {
                        if (msg.status !== "ok")
                            return that.connect();
                        that.send("SetHeartbeat", { "enable": false });
                        that.send("GetSceneList").then(function (msg) {
                            that.currentScene = msg["current-scene"];
                            that.sceneList = msg["scenes"]
                        });
                        if (that.callbacks["ConnectionOpened"])
                            for (var callback of that.callbacks["ConnectionOpened"]) {
                                callback();
                            }
                    });
                } else {
                    if (that.callbacks["ConnectionOpened"])
                        for (var callback of that.callbacks["ConnectionOpened"]) {
                            callback();
                        }
                }
            })
        }

        this.ws.onclose = function (e) {
            if (!e.reason) {
                console.log('Socket is closed. Reconnect will be attempted in 5 seconds.', e.reason);
                setTimeout(function () {
                    that.connect();
                }, 5000);
            }
        };

        this.ws.onerror = function (err) {
            console.error('Socket encountered error: ', err.message, 'Closing socket');
            that.ws.close();
        };

        this.ws.onmessage = function (message) {
            var msg = JSON.parse(message.data);
            //console.log(msg)
            if (that.callbacks[msg["update-type"]])
                for (var callback of that.callbacks[msg["update-type"]]) {
                    callback(msg);
                }
            if (that.sends[msg["message-id"]]) {
                that.sends[msg["message-id"]](msg);
                delete that.sends[msg["message-id"]];
            }
        };

        return new Promise(function (resolve, reject) {
            try {
                that.resolve = resolve;
            } catch (e) {
                reject(e);
            }
        })
    }
    on(type, callback) {
        if (this.callbacks[type] == null)
            this.callbacks[type] = [];
        this.callbacks[type].push(callback);
    }
    send(type, options) {
        var that = this;
        if (this.ws.readyState === WebSocket.OPEN)
            return new Promise(function (resolve, reject) {
                try {
                    var mid = Math.random().toString(36).substring(7);
                    if (that.logging)
                        console.log("sending", Object.assign({ "request-type": type, "message-id": mid }, options));
                    that.ws.send(JSON.stringify(Object.assign({ "request-type": type, "message-id": mid }, options)));
                    that.sends[mid] = resolve;
                } catch (e) {
                    reject(e);
                }
            })
        else
            return new Promise(function (resolve, reject) {
                that.connect().then(function () {
                    var mid = Math.random().toString(36).substring(7);
                    if (that.logging)
                        console.log("sending", Object.assign({ "request-type": type, "message-id": mid }, options));
                    that.ws.send(JSON.stringify(Object.assign({ "request-type": type, "message-id": mid }, options)));
                    that.sends[mid] = resolve;
                });
            })
    }
}

module.exports = OBSws;