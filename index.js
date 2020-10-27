if (process.getuid()) {
    console.log("please execute as root");
    process.exit();
}

const { exec } = require('child_process');
exec("xinput", (error, stdout, stderr) => {
    stdout.split("\n").forEach(line => {
        line = line.split("=");
        if (line[0] === "    ↳   USB Keyboard                          \tid") {
            exec("xinput set-prop " + line[1].split("\t")[0] + " \"Device Enabled\" 0");
        }
    })
})


const OBSws = require("./obsWs");

let obsWS = new OBSws("ws://localhost:4444");
let scenes = [];
let transitions = [];
let studioMode = true;
obsWS.on('ConnectionOpened', function () {
    obsWS.send('GetSceneList').then(function (data) {
        scenes = data.scenes;
        // data.scenes.forEach(function (scene) {
        //     console.log(scene);
        // });
    })
    obsWS.send('GetTransitionList').then(function (data) {
        transitions = data.transitions;
        data.transitions.forEach(function (transition) {
            console.log(transition);
        });
    })
});

const { spawn } = require('child_process');
const child = spawn('actkbd', ['-s', '-d', '/dev/input/by-id/usb-_USB_Keyboard-event-kbd']);

const config = require("./config.json");
const configProps = ["username", "keys-scenes", "Requests", "ToggleMute", "keys", "commads"];
for (const prop of configProps) {
    if (!config[prop]) {
        return console.log("invalid json:", prop, "missing");
    }
}


let lastKeys = [];
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => {
    const str = chunk.split("\n")[chunk.split("\n").length - 2];
    let keys = str.slice(6).split("+").map((key) => key | 0);
    const key = keys.filter(key => !lastKeys.includes(key) || keys.length == 1)[0];
    lastKeys = [key];
    console.log("Key pressed:", key);

    if (key in config["keys"]) {
        exec("su " + config["username"] + " -c \"export DISPLAY=':0.0';/usr/bin/xdotool key \"" + config["keys"][key] + "\"\"");
    }

    if (key in config["commads"]) {
        exec(config["commads"][key]);
    }


    if (key in config["keys-scenes"]) {
        if (studioMode)
            obsWS.send('SetPreviewScene', {
                'scene-name': config["keys-scenes"][key]
            });
        else
            obsWS.send('SetCurrentScene', {
                'scene-name': config["keys-scenes"][key]
            });
    }

    if (key in config["Requests"]) {
        obsWS.send(config["Requests"][key]);
    }

    if (key in config["ToggleMute"]) {
        obsWS.send('ToggleMute', {
            'scene-name': config["ToggleMute"][key]
        });
    }

    if (key === 57) {// space
        obsWS.send('TransitionToProgram');
    }

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

    if (key >= 16 && key <= 26) {// qwertzuiop
        if (transitions[key - 16])
            obsWS.send('SetCurrentTransition', {
                'transition-name': transitions[key - 16].name
            });
    }
});

child.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
});