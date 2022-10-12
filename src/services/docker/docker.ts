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
export function getImageName(uri: string) {
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
