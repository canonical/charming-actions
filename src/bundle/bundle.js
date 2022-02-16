const core = require("@actions/core");
const exec = require("@actions/exec");

class Bundle {
  async publish(path, channel) {
    core.exportVariable("CHARMCRAFT_AUTH", core.getInput("credentials"));
    process.chdir(path);
    await exec.exec("juju-bundle", [
      "publish",
      "--destructive-mode",
      "--serial",
      "--release",
      channel,
    ]);
  }
}

module.exports = Bundle;
