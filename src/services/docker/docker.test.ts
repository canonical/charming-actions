import { getImageName } from './docker';

describe('the container image service', () => {
  [
    {
      uri: 'username/imagename:tag',
      expectedName: 'username/imagename:tag',
    },
    {
      uri: 'repo.url/username/imagename:tag',
      expectedName: 'username/imagename:tag',
    },
    {
      uri: 'localhost:port/username/imagename:tag',
      expectedName: 'username/imagename:tag',
    },
    {
      uri: 'imagename:tag',
      expectedName: 'imagename:tag',
    },
  ].forEach(({ uri, expectedName }) => {
    it(`should return the correct image name`, () => {
      expect(getImageName(uri)).toEqual(expectedName);
    });
  });
});
