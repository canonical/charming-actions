const exec = require("@actions/exec");

class Snap {
  async install(snap, channel) {
    await exec.exec("sudo", [
      "snap",
      "install",
      snap,
      "--classic",
      ...(channel ? ["--channel", channel] : []),
    ]);
  }
}

module.exports = Snap;
