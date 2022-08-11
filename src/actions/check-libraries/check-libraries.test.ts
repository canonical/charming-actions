import { CheckLibrariesAction } from './check-libraries';

describe('the check libraries action', () => {
  describe('the comment body', () => {
    it('should be formatted as expected', () => {
      process.env['INPUT_GITHUB-TOKEN'] = 'some-token';
      const action = new CheckLibrariesAction();
      const body = (action as any).getCommentBody(
        {
          out: 'example stdout',
          err: 'example stderr',
        },
        './some/path/'
      );
      expect(body).toEqual(`
Libraries at path './some/path/' are not up to date with their remote 
counterparts. If this was not intentional, run \`charmcraft fetch-lib\` 
and commit the updated libs to your PR branch.\n
<details>
  <summary>stdout</summary>\n
  \`\`\`
  example stdout
  \`\`\`\n
</details>\n\n
<details>
  <summary>stderr</summary>\n
  \`\`\`
  example stderr
  \`\`\`\n
</details>`);
    });
  });
});
