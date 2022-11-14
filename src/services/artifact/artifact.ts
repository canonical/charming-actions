import * as artifact from '@actions/artifact';
import * as fs from 'fs';
import * as glob from '@actions/glob';

class Artifact {
  async uploadLogs() {
    // We're running some charmcraft commands as sudo as others as a
    // regular user - we want to capture both.
    const basePaths: string[] = [
      '/home/runner/snap/charmcraft/common/cache/charmcraft/log',
      '/root/snap/charmcraft/common/cache/charmcraft/log/',
    ];
    const msg: string[] = [];

    basePaths.forEach(async (basePath) => {
      if (!fs.existsSync(basePath)) {
        msg.push(
          `No charmcraft logs found at ${basePath}, skipping artifact upload.`
        );
      } else {
        const globber = await glob.create(`${basePath}/*.log`);
        const files = await globber.glob();
        const artifacts = artifact.create();
        const artifactName = `charmcraft-logs-${basePath.split('/')[1]}`;

        const result = await artifacts.uploadArtifact(
          artifactName,
          files,
          basePath
        );

        msg.push(
          `Artifact ${artifactName} upload result: ${JSON.stringify(result)}`
        );
      }
    });

    return msg.join('\r\n');
  }
}

export { Artifact };
