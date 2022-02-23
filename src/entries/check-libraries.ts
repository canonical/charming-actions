import { CheckLibrariesAction } from '../actions/check-libraries';

(async () => {
  await new CheckLibrariesAction().run();
})();
