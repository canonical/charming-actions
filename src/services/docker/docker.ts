import { getExecOutput } from '@actions/exec';

/**
 * Returns a the image name given a container image URI, removing any leading repository info
 *
 * For uri's that contain slashes, the text before the first slash is inspected and discarded
 * if contains any '.' or ':' characters, as these indicate it defines a registry and is not
 * part of the image name.  This procedure is documented in a note here:
 * https://www.docker.com/blog/how-to-use-your-own-registry-2/
 *
 * @param uri Container image URI, which may or may not include a leading repository.  For example, `some.repo:port/imageName:imageTag` or `someUser/imageName:imageTag`
 */
export function getImageName(uri: string): string {
  const uriParts = uri.split('/');
  if (uriParts.length === 1) {
    return uri;
  }
  if (uriParts[0].indexOf('.') > 0 || uriParts[0].indexOf(':') > 0) {
    // First segment of the URI is a registry.  Remove it
    return uriParts.slice(1).join('/');
  }
  return uri;
}

export async function getImageDigest(uri: string): Promise<string> {
  const imageName = getImageName(uri);

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
      `Found too many digests for pulled resource_image '${uri}'.  Expected single output, got multiline output '${result.stdout}'.`
    );
  }
  const resourceDigest = resourceDigests[0];

  if (resourceDigest.length < 1) {
    throw new Error(`No digest found for pulled resource_image '${uri}'`);
  }

  return resourceDigest;
}
