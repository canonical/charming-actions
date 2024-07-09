import { exec } from '@actions/exec';

class Snap {
  async install(snap: string, channel?: string, revision?: string) {
    await exec('sudo', [
      'snap',
      'install',
      snap,
      '--classic',
      ...(channel ? ['--channel', channel] : []),
      ...(revision ? ['--revision', revision] : []),
    ]);
  }
}

export { Snap };
