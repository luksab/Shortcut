import ws, { WebSocket } from "ws";

export class OBSws {
    address: string;
    logging: boolean;
    callbacks: any;
    sends: any;
    currentScene: string;
    sceneList: never[];
    ws: import("ws");
    resolve: any;
    constructor(address: string, logging = false) {
        this.address = address;
        this.logging = logging;

        this.callbacks = {};
        this.sends = {};
        this.currentScene = "";
        this.sceneList = [];
        this.ws = new WebSocket(this.address);
        this.connect();
    }
    connect() {
        this.ws = new WebSocket(this.address);
        this.ws.onopen = () => {
            if (this.resolve) this.resolve();
            this.send("GetAuthRequired").then((msg) => {
                if (msg.authRequired) {
                    throw new Error("Not implemented");
                } else if (this.callbacks["ConnectionOpened"])
                    for (const callback of this.callbacks["ConnectionOpened"]) {
                        callback();
                    }
            });
        };

        this.ws.onclose = (e: { reason: any }) => {
            if (!e.reason) {
                console.log(
                    "Socket is closed. Reconnect will be attempted in 5 seconds.",
                    e.reason,
                );
                setTimeout(() => {
                    this.connect();
                }, 5000);
            }
        };

        this.ws.onerror = (err: { message: any }) => {
            console.error(
                "Socket encountered error: ",
                err.message,
                "Closing socket",
            );
            this.ws.close();
        };
        this.ws.onmessage = (message: ws.MessageEvent) => {
            const msg = JSON.parse(message.data.toString());
            // console.log(msg)
            if (this.callbacks[msg["update-type"]])
                for (const callback of this.callbacks[msg["update-type"]]) {
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
        });
    }
    on(type: string | number, callback: any) {
        if (this.callbacks[type] == null) this.callbacks[type] = [];
        this.callbacks[type].push(callback);
    }
    send(type: string, options: any = {}): Promise<any> {
        if (this.ws.readyState === WebSocket.OPEN)
            return new Promise((resolve, reject) => {
                try {
                    const mid = Math.random().toString(36).substring(7);
                    if (this.logging)
                        console.log(
                            "sending",
                            Object.assign(
                                { "request-type": type, "message-id": mid },
                                options,
                            ),
                        );
                    this.ws.send(
                        JSON.stringify(
                            Object.assign(
                                { "request-type": type, "message-id": mid },
                                options,
                            ),
                        ),
                    );
                    this.sends[mid] = resolve;
                } catch (e) {
                    reject(e);
                }
            });
        else
            return new Promise((resolve, _reject) => {
                this.connect().then(() => {
                    const mid = Math.random().toString(36).substring(7);
                    if (this.logging)
                        console.log(
                            "sending",
                            Object.assign(
                                { "request-type": type, "message-id": mid },
                                options,
                            ),
                        );
                    this.ws.send(
                        JSON.stringify(
                            Object.assign(
                                { "request-type": type, "message-id": mid },
                                options,
                            ),
                        ),
                    );
                    this.sends[mid] = resolve;
                });
            });
    }
}
