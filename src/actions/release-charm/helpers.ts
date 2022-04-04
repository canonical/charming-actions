import { Release } from '../../types';

function getResourcesInfoByRelease(
  releaseData: Release
): Array<{ resourceName: string; resourceRev: string }> {
  const body = releaseData.body
    ?.split('\n')
    .map((line) => line.trim())
    .filter(
      (line) => line.startsWith('-') || line.startsWith('resource-revision:')
    );
  if (!body) {
    throw new Error(`Cannot find release body in tag ${releaseData.tag_name}`);
  }
  const resourceNames = body
    .filter((line) => line.startsWith('-'))
    .map((line) => line.split(':')[0].split(' ')[2]);
  const resourceRevs = body
    .filter((line) => line.startsWith('resource-revision:'))
    .map((line) => line.split(':')[1].trim());

  if (resourceNames.length === 0 || resourceRevs.length === 0) {
    throw new Error(
      `Cannot find resources info in release with tag ${releaseData.tag_name}`
    );
  }

  const result = resourceNames.reduce((acc, field, index) => {
    acc.push({ resourceName: field, resourceRev: resourceRevs[index] });
    return acc;
  }, [] as Array<{ resourceName: string; resourceRev: string }>);
  return result;
}

export { getResourcesInfoByRelease };
