import { ReleaseLibrariesAction } from '../actions/release-libraries/release-libraries';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await new ReleaseLibrariesAction().run();
})();
