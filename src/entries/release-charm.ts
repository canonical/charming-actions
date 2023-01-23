import { ReleaseCharmAction } from '../actions/release-charm/release-charm';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await new ReleaseCharmAction().run();
})();
