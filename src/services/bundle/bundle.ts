import * as core from '@actions/core';
import * as exec from '@actions/exec';

class Bundle {
  async publish(path: string, channel: string) {
    core.exportVariable('CHARMCRAFT_AUTH', core.getInput('credentials'));
    await exec.exec('juju-bundle', [
      'publish',
      '--destructive-mode',
      '--serial',
      '--release',
      channel,
      '--bundle',
      path,
    ]);
  }
}

export { Bundle };
