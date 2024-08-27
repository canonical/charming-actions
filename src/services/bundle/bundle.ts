import * as core from '@actions/core';
import * as exec from '@actions/exec';

class Bundle {
  async publish(path: string, channel: string) {
    core.exportVariable('CHARMCRAFT_AUTH', core.getInput('credentials'));
    process.chdir(path);

    const result = await exec.getExecOutput('charmcraft', ['pack']);
    core.info(result.stdout);
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
      throw new Error('charmcraft pack ran unsuccessfully');
    }
  }
}

export { Bundle };
