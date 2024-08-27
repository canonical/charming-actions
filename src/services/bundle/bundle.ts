import * as core from '@actions/core';
import * as exec from '@actions/exec';

class Bundle {
  async publish(path: string, channel: string) {
    core.exportVariable('CHARMCRAFT_AUTH', core.getInput('credentials'));
    process.chdir(path);

    const result = await exec.getExecOutput('charmcraft', ['pack']);
    if (result.exitCode === 0) {
      const lastLine = result.stderr.trim().split('\n').pop();
      if (lastLine) {
        const bundleName = lastLine.split(' ')[1];
        await exec.exec('charmcraft', [
          'upload',
          bundleName,
          '--release',
          channel,
        ]);
      } else {
        throw new Error(
          'Failed to extract the bundle name from the output of charmcraft pack.',
        );
      }
    } else {
      throw new Error(
        `charmcraft pack ran unsuccessfully with exit code ${result.exitCode}.`,
      );
    }
  }
}

export { Bundle };
