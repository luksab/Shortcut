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
        this.ws.onopen = () => {
            if (this.resolve)
                this.resolve();
            this.send("GetAuthRequired").then(msg => {
                if (msg.authRequired) {
                    var hash;
                    if (localStorage.getItem("hash") == null) {
                        hash = b64_sha256(window.prompt("password", "a") + msg.salt);
                        localStorage.setItem("hash", hash);
                    } else {
                        hash = localStorage.getItem("hash");
                    }
                    var auth = b64_sha256(hash + msg.challenge)

                    return this.send('Authenticate', { auth: auth }).then(msg => {
                        if (msg.status !== "ok")
                            return this.connect();
                        this.send("SetHeartbeat", { "enable": false });
                        this.send("GetSceneList").then(msg => {
                            this.currentScene = msg["current-scene"];
                            this.sceneList = msg["scenes"]
                        });
                        if (this.callbacks["ConnectionOpened"])
                            for (var callback of this.callbacks["ConnectionOpened"]) {
                                callback();
                            }
                    });
                } else {
                    if (this.callbacks["ConnectionOpened"])
                        for (var callback of this.callbacks["ConnectionOpened"]) {
                            callback();
                        }
                }
            })
        }

        this.ws.onclose = e => {
            if (!e.reason) {
                console.log('Socket is closed. Reconnect will be attempted in 5 seconds.', e.reason);
                setTimeout(() => {
                    this.connect();
                }, 5000);
            }
        };

        this.ws.onerror = err => {
            console.error('Socket encountered error: ', err.message, 'Closing socket');
            this.ws.close();
        };

        this.ws.onmessage = message => {
            var msg = JSON.parse(message.data);
            //console.log(msg)
            if (this.callbacks[msg["update-type"]])
                for (var callback of this.callbacks[msg["update-type"]]) {
                    callback(msg);
                }
            if (this.sends[msg["message-id"]]) {
                this.sends[msg["message-id"]](msg);
                delete this.sends[msg["message-id"]];
            }
        };

        return new Promise((resolve, reject) => {
            try {
                this.resolve = resolve;
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
        if (this.ws.readyState === WebSocket.OPEN)
            return new Promise((resolve, reject) => {
                try {
                    var mid = Math.random().toString(36).substring(7);
                    if (this.logging)
                        console.log("sending", Object.assign({ "request-type": type, "message-id": mid }, options));
                    this.ws.send(JSON.stringify(Object.assign({ "request-type": type, "message-id": mid }, options)));
                    this.sends[mid] = resolve;
                } catch (e) {
                    reject(e);
                }
            })
        else
            return new Promise((resolve, reject) => {
                this.connect().then(() => {
                    var mid = Math.random().toString(36).substring(7);
                    if (this.logging)
                        console.log("sending", Object.assign({ "request-type": type, "message-id": mid }, options));
                    this.ws.send(JSON.stringify(Object.assign({ "request-type": type, "message-id": mid }, options)));
                    this.sends[mid] = resolve;
                });
            })
    }
}

module.exports = OBSws;