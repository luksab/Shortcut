"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const elgato_stream_deck_1 = require("elgato-stream-deck");
const path = __importStar(require("path"));
const child_process_1 = require("child_process");
const sharp_1 = __importDefault(require("sharp"));
const fs = __importStar(require("fs"));
const http = __importStar(require("http"));
require("source-map-support").install();
var OBSws = require("./obsWs");
var options = {
    hostname: "192.168.178.51",
    port: 80,
    path: "/todos",
    method: "GET",
};
var obsWS = new OBSws("ws://localhost:4444", true);
var scenes = [];
var transitions = [];
var studioMode = true;
obsWS.on("ConnectionOpened", function () {
    obsWS.send("GetSceneList").then(function (data) {
        scenes = data.scenes;
    });
    obsWS.send("GetTransitionList").then(function (data) {
        transitions = data.transitions;
    });
    obsWS
        .send("GetStudioModeEnabled")
        .then(function (data) {
        studioMode = data.studioModeEnabled;
    });
});
obsWS.on("StudioModeStateChanged", (event) => (studioMode = event.studioModeEnabled));
class Stream {
    constructor() {
        this.deck = (0, elgato_stream_deck_1.openStreamDeck)();
        console.log(require("os").homedir());
        this.current_path = path.resolve(require("os").homedir(), ".config/shortcut/config");
        this.config = JSON.parse(fs.readFileSync(this.current_path + "/" + "config.json", "utf8"));
        this.applyConfig(this.current_path);
        this.deck.on("down", (keyIndex) => {
            console.log("key %d down", keyIndex);
            this.handleDown(keyIndex, this.config);
        });
        this.deck.on("up", function (keyIndex) {
            console.log("key %d up", keyIndex);
        });
    }
    applyConfig(config_path) {
        console.log(config_path);
        this.deck.clearAllKeys();
        this.config = JSON.parse(fs.readFileSync(config_path + "/" + "config.json", "utf8"));
        for (var key in this.config) {
            if (Object.hasOwnProperty.call(this.config, key)) {
                var key_config = this.config[key];
                console.log(key_config);
                if (Object.hasOwnProperty.call(key_config, "image")) {
                    this.setImage(parseInt(key), key_config["image"], config_path);
                }
                else if (Object.hasOwnProperty.call(key_config, "text")) {
                    this.setText(parseInt(key), key_config["text"], key_config["text-size"] || 30);
                }
                else if (Object.hasOwnProperty.call(key_config, "color")) {
                    this.setColor(parseInt(key), key_config["color"][0], key_config["color"][1], key_config["color"][2]);
                }
            }
        }
    }
    setImage(index, image, basedir) {
        (0, sharp_1.default)(path.resolve(basedir, image))
            .flatten()
            .resize(this.deck.ICON_SIZE, this.deck.ICON_SIZE)
            .raw()
            .toBuffer()
            .then((buffer) => {
            this.deck.fillImage(index, buffer);
        })["catch"]((err) => {
            console.error(err);
        });
    }
    setText(index, text, size) {
        console.log("size:", size);
        (0, sharp_1.default)(Buffer.from(`<svg>
            <rect x="0" y="0" width="64" height="64" />
            <text x="5" y="${25 + size / 2}" font-size="${size}" font-weight="bold" font-family="mono" fill="#fff">` +
            text +
            `</text>
        </svg>`))
            .flatten()
            .resize(this.deck.ICON_SIZE, this.deck.ICON_SIZE)
            .raw()
            .toBuffer()
            .then((buffer) => {
            this.deck.fillImage(index, buffer);
        })["catch"]((err) => {
            console.error(err);
        });
    }
    handleDown(key, config) {
        if (Object.hasOwnProperty.call(config, key)) {
            var key_config = config[String(key)];
            if (Object.hasOwnProperty.call(key_config, "folder")) {
                console.log(this.current_path);
                this.current_path = path.resolve(this.current_path, key_config["folder"]);
                console.log(this.current_path);
                this.applyConfig(this.current_path);
            }
            else if (Object.hasOwnProperty.call(key_config, "command")) {
                let command = key_config["command"];
                console.log("executing", command);
                (0, child_process_1.exec)(command, (error, stdout, stderr) => {
                    if (error) {
                        console.error(`exec error: ${error}`);
                        return;
                    }
                    console.log(`stdout: ${stdout}`);
                    console.error(`stderr: ${stderr}`);
                });
            }
            else if (Object.hasOwnProperty.call(key_config, "key")) {
                let key = key_config["key"];
                console.log("typing", key);
                (0, child_process_1.exec)("export DISPLAY=':0.0';xdotool key \"" + key + '"');
            }
            else if (Object.hasOwnProperty.call(key_config, "scene")) {
                let scene = key_config["scene"];
                if (studioMode)
                    obsWS.send("SetPreviewScene", {
                        "scene-name": scene,
                    });
                else
                    obsWS.send("SetCurrentScene", {
                        "scene-name": scene,
                    });
            }
            else if (Object.hasOwnProperty.call(key_config, "request")) {
                let request = key_config["request"];
                obsWS.send(request);
            }
            else if (Object.hasOwnProperty.call(key_config, "toggleHide")) {
                let toggleHide = key_config["toggleHide"];
                toggleHide["sourceEnabled"] = !toggleHide["sourceEnabled"];
                obsWS.send("SetSceneItemRender", {
                    "scene-name": toggleHide["scene"],
                    source: toggleHide["source"],
                    render: toggleHide["sourceEnabled"],
                });
            }
            else if (Object.hasOwnProperty.call(key_config, "filter")) {
                let filter = key_config["filter"];
                filter["filterEnabled"] = !filter["filterEnabled"];
                obsWS.send("SetSourceFilterVisibility", {
                    sourceName: filter["source"],
                    filterName: filter["filter"],
                    filterEnabled: filter["filterEnabled"],
                });
            }
            else if (Object.hasOwnProperty.call(key_config, "transition")) {
                obsWS.send("TransitionToProgram");
            }
            else if (Object.hasOwnProperty.call(key_config, "setColor")) {
                let color = key_config["setColor"];
                http
                    .request(Object.assign(options, {
                    path: `/rgb/${color[0]}/${color[1]}/${color[2]}`,
                }))
                    .on("error", console.log)
                    .end();
            }
        }
    }
    setColor(index, r, g, b) {
        this.deck.fillColor(index, r, g, b);
    }
}
let deck = new Stream();
console.log("done");
process.stdin.pipe(require("split")()).on("data", processLine);
function processLine(line) {
    console.log("exit!");
    deck.deck.clearAllKeys();
    process.exit();
}
//# sourceMappingURL=index.js.map