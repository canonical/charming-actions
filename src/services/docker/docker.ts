import { getExecOutput } from '@actions/exec';

export async function getImageDigest(uri: string): Promise<string> {
  // String docker.io/ from any image name, as they get removed in the `docker images` list
  const imageName = uri.replace(/^docker.io\//, '');

  const result = await getExecOutput('docker', [
    'image',
    'ls',
    '-q',
    imageName,
  ]);
  const resourceDigests = result.stdout.trim().split('\n');
  if (resourceDigests.length < 1) {
    throw new Error(`No digest found for pulled resource_image '${uri}'`);
  } else if (resourceDigests.length > 1) {
    throw new Error(
      `Found too many digests for pulled resource_image '${uri}'.  Expected single output, got multiline output '${result.stdout}'.`,
    );
  }
  const resourceDigest = resourceDigests[0];

  if (resourceDigest.length < 1) {
    throw new Error(`No digest found for pulled resource_image '${uri}'`);
  }

  return resourceDigest;
}
