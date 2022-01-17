import { openStreamDeck, StreamDeck } from "elgato-stream-deck";
import * as path from "path";
import { exec } from "child_process";
import sharp from "sharp";
import * as fs from "fs";
import * as http from "http";
import * as os from "os";

import * as source_map from "source-map-support";
source_map.install();

import { OBSws } from "./obsWs";

const options = {
    hostname: "192.168.178.51",
    port: 80,
    path: "/todos",
    method: "GET",
};

const obsWS = new OBSws("ws://localhost:4444", true);
let studioMode = true;
obsWS.on("ConnectionOpened", function () {
    obsWS
        .send("GetStudioModeEnabled")
        .then(function (data: { studioModeEnabled: boolean }) {
            studioMode = data.studioModeEnabled;
            // data.transitions.forEach(function (transition) {
            //     console.log(transition);
            // });
        });
    const deck = new Stream();
});

obsWS.on(
    "StudioModeStateChanged",
    (event: { studioModeEnabled: boolean }) =>
        (studioMode = event.studioModeEnabled),
);

class Stream {
    deck: StreamDeck;
    current_path: string;
    config: { [x: string]: any };
    constructor() {
        this.deck = openStreamDeck();
        console.log(os.homedir());
        this.current_path = path.resolve(
            os.homedir(),
            ".config/shortcut/config",
        );
        this.config = JSON.parse(
            fs.readFileSync(this.current_path + "/" + "config.json", "utf8"),
        );
        this.applyConfig(this.current_path);

        this.deck.on("down", (button) => {
            console.log("button %d down", button);
            this.handleDown(button, this.config);
        });
        this.deck.on("up", function (button) {
            console.log("button %d up", button);
        });
    }

    async applyConfig(config_path: string) {
        obsWS.clearCallbacks();
        console.log(config_path);
        this.deck.clearAllKeys();
        this.config = JSON.parse(
            fs.readFileSync(config_path + "/" + "config.json", "utf8"),
        );
        for (const button in this.config) {
            if (Object.hasOwnProperty.call(this.config, button)) {
                const button_config = this.config[button];
                // console.log(button_config);

                if (Object.hasOwnProperty.call(button_config, "image")) {
                    this.setImage(
                        parseInt(button),
                        button_config["image"],
                        config_path,
                    );
                } else if (
                    Object.hasOwnProperty.call(button_config, "text") &&
                    Object.hasOwnProperty.call(button_config, "color")
                ) {
                    console.log("first");
                    await this.setText(
                        parseInt(button),
                        button_config["text"],
                        button_config["text-size"] || 30,
                        button_config["color"],
                    );
                } else if (Object.hasOwnProperty.call(button_config, "text")) {
                    await this.setText(
                        parseInt(button),
                        button_config["text"],
                        button_config["text-size"] || 30,
                    );
                } else if (Object.hasOwnProperty.call(button_config, "color")) {
                    this.setColor(
                        parseInt(button),
                        button_config["color"][0],
                        button_config["color"][1],
                        button_config["color"][2],
                    );
                }

                if (Object.hasOwnProperty.call(button_config, "color-states")) {
                    const color_states = button_config["color-states"];
                    for (const state_name in color_states) {
                        const state = color_states[state_name];
                        obsWS.send(state_name).then((data) => {
                            for (const property in state) {
                                if (
                                    Object.hasOwnProperty.call(
                                        state,
                                        property,
                                    ) &&
                                    Object.hasOwnProperty.call(data, property)
                                ) {
                                    for (const value in state[property]) {
                                        if (
                                            Object.hasOwnProperty.call(
                                                state[property],
                                                value,
                                            ) &&
                                            value == String(data[property])
                                        ) {
                                            if (
                                                Object.hasOwnProperty.call(
                                                    button_config,
                                                    "text",
                                                )
                                            ) {
                                                this.setText(
                                                    parseInt(button),
                                                    button_config["text"],
                                                    button_config[
                                                        "text-size"
                                                    ] || 30,
                                                    state[property][value],
                                                );
                                            } else {
                                                this.setColor(
                                                    parseInt(button),
                                                    state[property][value][0],
                                                    state[property][value][1],
                                                    state[property][value][2],
                                                );
                                            }
                                        }
                                    }
                                }
                            }
                        });
                    }
                }

                if (
                    Object.hasOwnProperty.call(button_config, "color-events") &&
                    Object.hasOwnProperty.call(button_config, "text")
                ) {
                    const color_events = button_config["color-events"];
                    for (const event in color_events) {
                        const color: [number, number, number] =
                            color_events[event];
                        obsWS.on(event, () => {
                            console.log(`event ${event} came in`);
                            this.setText(
                                parseInt(button),
                                button_config["text"],
                                button_config["text-size"] || 30,
                                [color[0], color[1], color[2]],
                            );
                        });
                    }
                } else if (
                    Object.hasOwnProperty.call(button_config, "color-events")
                ) {
                    const color_events = button_config["color-events"];
                    for (const event in color_events) {
                        const color = color_events[event];
                        obsWS.on(event, () => {
                            this.setColor(
                                parseInt(button),
                                color[0],
                                color[1],
                                color[2],
                            );
                        });
                    }
                }
            }
        }
    }

    async setImage(index: number, image: string, basedir: string) {
        console.log(
            `Setting image ${path.resolve(basedir, image)} to ${index}`,
        );
        const buffer = await sharp(path.resolve(basedir, image))
            .flatten() // Eliminate alpha channel, if any.
            .resize(this.deck.ICON_SIZE, this.deck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
            .raw() // Give us uncompressed RGB.
            .toBuffer();
        this.deck.fillImage(index, buffer);
    }

    async setText(
        index: number,
        text: string,
        size: number,
        color: string | [number, number, number] = "black",
    ) {
        if (typeof color === "object") {
            color = `rgb(${color[0]},${color[1]},${color[2]})`;
        }
        const buffer = await sharp(
            Buffer.from(
                `<svg>
                  <rect x="0" y="0" width="64" height="64" fill="${color}" />
                  <text x="5" y="${25 + size / 2}" font-size="${size}"` +
                    ` font-weight="bold" font-family="mono" fill="#fff">` +
                    text +
                    `</text>
                </svg>`,
            ),
        )
            .flatten() // Eliminate alpha channel, if any.
            .resize(this.deck.ICON_SIZE, this.deck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
            .raw() // Give us uncompressed RGB.
            .toBuffer();
        this.deck.fillImage(index, buffer);
    }

    handleDown(button: number, config: { [x: string]: any }) {
        if (Object.hasOwnProperty.call(config, button)) {
            const button_config = config[String(button)];
            if (Object.hasOwnProperty.call(button_config, "folder")) {
                console.log(this.current_path);
                this.current_path = path.resolve(
                    this.current_path,
                    button_config["folder"],
                );
                console.log(this.current_path);
                this.applyConfig(this.current_path);
            } else if (Object.hasOwnProperty.call(button_config, "command")) {
                const command = button_config["command"];
                console.log("executing", command);
                exec(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                    console.log(`stdout: ${stdout}`);
                    console.error(`stderr: ${stderr}`);
                });
            } else if (Object.hasOwnProperty.call(button_config, "key")) {
                const key = button_config["key"];
                console.log("typing", key);
                exec("export DISPLAY=':0.0';xdotool key \"" + key + '"');
            } else if (Object.hasOwnProperty.call(button_config, "scene")) {
                const scene = button_config["scene"];
                if (studioMode)
                    obsWS.send("SetPreviewScene", {
                        "scene-name": scene,
                    });
                else
                    obsWS.send("SetCurrentScene", {
                        "scene-name": scene,
                    });
            } else if (Object.hasOwnProperty.call(button_config, "request")) {
                const request = button_config["request"];
                obsWS.send(request);
            } else if (
                Object.hasOwnProperty.call(button_config, "toggleHide")
            ) {
                const toggleHide = button_config["toggleHide"];
                toggleHide["sourceEnabled"] = !toggleHide["sourceEnabled"];
                obsWS.send("SetSceneItemRender", {
                    "scene-name": toggleHide["scene"],
                    source: toggleHide["source"],
                    render: toggleHide["sourceEnabled"],
                });
            } else if (Object.hasOwnProperty.call(button_config, "filter")) {
                const filter = button_config["filter"];
                filter["filterEnabled"] = !filter["filterEnabled"];
                obsWS.send("SetSourceFilterVisibility", {
                    sourceName: filter["source"],
                    filterName: filter["filter"],
                    filterEnabled: filter["filterEnabled"],
                });
            } else if (
                Object.hasOwnProperty.call(button_config, "transition")
            ) {
                obsWS.send("TransitionToProgram");
            } else if (Object.hasOwnProperty.call(button_config, "send")) {
                const message = button_config["send"];
                obsWS.send(message.message, message.args);
            } else if (Object.hasOwnProperty.call(button_config, "setColor")) {
                const color = button_config["setColor"];
                http.request(
                    Object.assign(options, {
                        path: `/rgb/${color[0]}/${color[1]}/${color[2]}`,
                    }),
                )
                    .on("error", console.log)
                    .end();
            }
        }
    }

    setColor(index: number, r: number, g: number, b: number) {
        this.deck.fillColor(index, r, g, b);
    }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars

console.log("done");

// process.on("exit", function (code) {
//   deck.deck.clearAllKeys();
// });

// process.on("SIGINT", () => {
//   console.log("sigint");
//   deck.deck.clearAllKeys();
// });
// process.on("SIGUSR1", () => deck.deck.clearAllKeys());
// process.on("SIGUSR2", () => deck.deck.clearAllKeys());

/*
    if (key >= 2 && key <= 11) {// numkeys
        if (studioMode)
            obsWS.send('SetPreviewScene', {
                'scene-name': scenes[key - 2].name
            });
        else
            obsWS.send('SetCurrentScene', {
                'scene-name': scenes[key - 2].name
            });
    }
});
*/
