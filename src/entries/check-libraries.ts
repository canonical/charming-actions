import { CheckLibrariesAction } from '../actions/check-libraries';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await new CheckLibrariesAction().run();
})();
