import { exportVariable, getInput } from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';

class Bundle {
  async publish(path: string, channel: string) {
    exportVariable('CHARMCRAFT_AUTH', getInput('credentials'));
    process.chdir(path);

    const result = await getExecOutput('charmcraft', ['pack']);
    if (result.exitCode !== 0) {
      throw new Error(
        `charmcraft pack ran unsuccessfully with exit code ${result.exitCode}.`,
      );
    }
    const lastLine = result.stderr.trim().split('\n').pop();
    if (lastLine) {
      const bundleName = lastLine.split(' ')[1];
      await exec('charmcraft', ['upload', bundleName, '--release', channel]);
    } else {
      throw new Error(
        'Failed to extract the bundle name from the output of charmcraft pack.',
      );
    }
  }
}

export { Bundle };
