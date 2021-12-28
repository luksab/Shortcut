// if (process.getuid()) {
//     console.log("please execute as root");
//     process.exit();
// }
import { openStreamDeck, StreamDeck } from "elgato-stream-deck";
import * as path from "path";
import { exec } from "child_process";
import sharp from "sharp";
import * as fs from "fs";
import * as http from "http";

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
  obsWS.send("GetSceneList").then(function (data: { scenes: any[] }) {
    scenes = data.scenes;
    // data.scenes.forEach(function (scene) {
    //     console.log(scene);
    // });
  });
  obsWS.send("GetTransitionList").then(function (data: { transitions: any[] }) {
    transitions = data.transitions;
    // data.transitions.forEach(function (transition) {
    //     console.log(transition);
    // });
  });

  obsWS
    .send("GetStudioModeEnabled")
    .then(function (data: { studioModeEnabled: boolean }) {
      studioMode = data.studioModeEnabled;
      // data.transitions.forEach(function (transition) {
      //     console.log(transition);
      // });
    });
});

obsWS.on(
  "StudioModeStateChanged",
  (event: { studioModeEnabled: boolean }) =>
    (studioMode = event.studioModeEnabled)
);

class Stream {
  deck: StreamDeck;
  current_path: string;
  config: { [x: string]: any };
  constructor() {
    this.deck = openStreamDeck();
    console.log(require("os").homedir());
    this.current_path = path.resolve(
      require("os").homedir(),
      ".config/shortcut/config"
    );
    this.config = JSON.parse(
      fs.readFileSync(this.current_path + "/" + "config.json", "utf8")
    );
    this.applyConfig(this.current_path);

    this.deck.on("down", (keyIndex) => {
      console.log("key %d down", keyIndex);
      this.handleDown(keyIndex, this.config);
    });
    this.deck.on("up", function (keyIndex) {
      console.log("key %d up", keyIndex);
    });
  }

  applyConfig(config_path: string) {
    console.log(config_path);
    this.deck.clearAllKeys();
    this.config = JSON.parse(
      fs.readFileSync(config_path + "/" + "config.json", "utf8")
    );
    for (var key in this.config) {
      if (Object.hasOwnProperty.call(this.config, key)) {
        var key_config = this.config[key];
        console.log(key_config);

        if (Object.hasOwnProperty.call(key_config, "image")) {
          this.setImage(parseInt(key), key_config["image"], config_path);
        } else if (Object.hasOwnProperty.call(key_config, "text")) {
          this.setText(parseInt(key), key_config["text"], key_config["text-size"] || 30);
        } else if (Object.hasOwnProperty.call(key_config, "color")) {
          this.setColor(
            parseInt(key),
            key_config["color"][0],
            key_config["color"][1],
            key_config["color"][2]
          );
        }
      }
    }
  }

  setImage(index: number, image: string, basedir: string) {
    sharp(path.resolve(basedir, image))
      .flatten() // Eliminate alpha channel, if any.
      .resize(this.deck.ICON_SIZE, this.deck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
      .raw() // Give us uncompressed RGB.
      .toBuffer()
      .then((buffer) => {
        this.deck.fillImage(index, buffer);
      })
      ["catch"]((err) => {
        console.error(err);
      });
  }

  setText(index: number, text: string, size: number) {
      console.log("size:", size)
    sharp(
      Buffer.from(
        `<svg>
            <rect x="0" y="0" width="64" height="64" />
            <text x="5" y="${25 + size/2}" font-size="${size}" font-weight="bold" font-family="mono" fill="#fff">` +
          text +
          `</text>
        </svg>`
      )
    )
      .flatten() // Eliminate alpha channel, if any.
      .resize(this.deck.ICON_SIZE, this.deck.ICON_SIZE) // Scale up/down to the right size, cropping if necessary.
      .raw() // Give us uncompressed RGB.
      .toBuffer()
      .then((buffer) => {
        this.deck.fillImage(index, buffer);
      })
      ["catch"]((err) => {
        console.error(err);
      });
  }

  handleDown(key: number, config: { [x: string]: any }) {
    if (Object.hasOwnProperty.call(config, key)) {
      var key_config = config[String(key)];
      if (Object.hasOwnProperty.call(key_config, "folder")) {
        console.log(this.current_path);
        this.current_path = path.resolve(
          this.current_path,
          key_config["folder"]
        );
        console.log(this.current_path);
        this.applyConfig(this.current_path);
      } else if (Object.hasOwnProperty.call(key_config, "command")) {
        let command = key_config["command"];
        console.log("executing", command);
        exec(command, (error, stdout, stderr) => {
          if (error) {
            console.error(`exec error: ${error}`);
            return;
          }
          console.log(`stdout: ${stdout}`);
          console.error(`stderr: ${stderr}`);
        });
      } else if (Object.hasOwnProperty.call(key_config, "key")) {
        let key = key_config["key"];
        console.log("typing", key);
        exec("export DISPLAY=':0.0';xdotool key \"" + key + '"');
      } else if (Object.hasOwnProperty.call(key_config, "scene")) {
        let scene = key_config["scene"];
        if (studioMode)
          obsWS.send("SetPreviewScene", {
            "scene-name": scene,
          });
        else
          obsWS.send("SetCurrentScene", {
            "scene-name": scene,
          });
      } else if (Object.hasOwnProperty.call(key_config, "request")) {
        let request = key_config["request"];
        obsWS.send(request);
      } else if (Object.hasOwnProperty.call(key_config, "toggleHide")) {
        let toggleHide = key_config["toggleHide"];
        toggleHide["sourceEnabled"] = !toggleHide["sourceEnabled"];
        obsWS.send("SetSceneItemRender", {
          "scene-name": toggleHide["scene"],
          source: toggleHide["source"],
          render: toggleHide["sourceEnabled"],
        });
      } else if (Object.hasOwnProperty.call(key_config, "filter")) {
        let filter = key_config["filter"];
        filter["filterEnabled"] = !filter["filterEnabled"];
        obsWS.send("SetSourceFilterVisibility", {
          sourceName: filter["source"],
          filterName: filter["filter"],
          filterEnabled: filter["filterEnabled"],
        });
      } else if (Object.hasOwnProperty.call(key_config, "transition")) {
        obsWS.send("TransitionToProgram");
      } else if (Object.hasOwnProperty.call(key_config, "setColor")) {
        let color = key_config["setColor"];
        http
          .request(
            Object.assign(options, {
              path: `/rgb/${color[0]}/${color[1]}/${color[2]}`,
            })
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

let deck = new Stream();

console.log("done");

process.stdin.pipe(require("split")()).on("data", processLine);

function processLine(line: string) {
  console.log("exit!");
  deck.deck.clearAllKeys();
  process.exit();
}

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
