import { UploadCharmAction } from '../actions/upload-charm/upload-charm';

(async () => {
  await new UploadCharmAction().run();
})();
