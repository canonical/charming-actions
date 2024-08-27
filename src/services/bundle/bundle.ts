import * as core from '@actions/core';
import * as exec from '@actions/exec';

class Bundle {
  async publish(path: string, channel: string) {
    core.exportVariable('CHARMCRAFT_AUTH', core.getInput('credentials'));
    process.chdir(path);

    const result = await exec.getExecOutput('charmcraft', ['pack']);
    const bundleName = result.stdout.split(' ')[1].trim();

    await exec.exec('charmcraft', ['upload', bundleName, '--release', channel]);
  }
}

export { Bundle };
