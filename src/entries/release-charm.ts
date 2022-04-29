import { ReleaseCharmAction } from '../actions/release-charm/release-charm';

(async () => {
  await new ReleaseCharmAction().run();
})();
