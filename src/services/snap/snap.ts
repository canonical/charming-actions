import { exec } from '@actions/exec';

class Snap {
  async install(snap: string, channel?: string) {
    await exec('sudo', [
      'snap',
      'install',
      snap,
      '--classic',
      ...(channel ? ['--channel', channel] : []),
    ]);
  }
}

export { Snap };
