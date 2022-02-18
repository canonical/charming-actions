import * as artifact from '@actions/artifact';
import * as fs from 'fs';
import * as glob from '@actions/glob';

class Artifact {
  async uploadLogs() {
    const basePath = '/home/runner/snap/charmcraft/common/cache/charmcraft/log';

    if (!fs.existsSync(basePath)) {
      return 'No charmcraft logs generated, skipping artifact upload.';
    }

    const globber = await glob.create(`${basePath}/*.log`);
    const files = await globber.glob();
    const artifacts = artifact.create();

    const result = await artifacts.uploadArtifact(
      'charmcraft-logs',
      files,
      basePath
    );

    return `Artifact upload result: ${JSON.stringify(result)}`;
  }
}

export { Artifact };
