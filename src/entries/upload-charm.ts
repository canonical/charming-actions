import { UploadCharmAction } from '../actions/upload-charm/upload-charm';

// eslint-disable-next-line @typescript-eslint/no-floating-promises
(async () => {
  await new UploadCharmAction().run();
})();
