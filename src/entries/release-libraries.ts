import { ReleaseLibrariesAction } from '../actions/release-libraries/release-libraries';

(async () => {
  await new ReleaseLibrariesAction().run();
})();
