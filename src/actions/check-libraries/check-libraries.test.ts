import { CheckLibrariesAction } from './check-libraries';

describe('the check libraries action', () => {
  describe('the comment body', () => {
    it('should be formatted as expected', () => {
      process.env['INPUT_GITHUB-TOKEN'] = 'some-token';
      process.env['INPUT_COMMENT-ON-PR'] = 'true';
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
  describe('the labelling logic', () => {
    beforeEach(() => {
      process.env['GITHUB_REPOSITORY'] = 'test/repo';
      process.env['INPUT_LABEL-SUCCESS'] = 'success';
      process.env['INPUT_LABEL-FAIL'] = 'fail';
    });

    it('should set the right label', async () => {
      const action = new CheckLibrariesAction() as any;

      action.github.rest.issues.addLabels = jest.fn();
      action.github.rest.issues.removeLabel = jest.fn();
      action.github.rest.issues.getLabel = jest.fn(() => ({ status: 200 }));
      action.github.rest.issues.createLabel = jest.fn();
      action.github.rest.issues.updateLabel = jest.fn();
      action.github.rest.issues.listLabelsOnIssue = jest.fn(() => ({
        data: [{ name: 'fail' }],
      }));

      await action.replaceLabel(
        process.env['INPUT_LABEL-SUCCESS'],
        process.env['INPUT_LABEL-FAIL']
      );

      expect(action.github.rest.issues.listLabelsOnIssue).toHaveBeenCalledWith(
        expect.objectContaining({
          repo: 'repo',
          owner: 'test',
        })
      );

      expect(action.github.rest.issues.addLabels).toHaveBeenCalledWith(
        expect.objectContaining({
          labels: ['success'],
        })
      );

      expect(action.github.rest.issues.removeLabel).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'fail',
        })
      );
    });

    it('should not do anything if labels already are correct', async () => {
      const action = new CheckLibrariesAction() as any;

      action.github.rest.issues.addLabels = jest.fn();
      action.github.rest.issues.removeLabel = jest.fn();
      action.github.rest.issues.getLabel = jest.fn(() => ({ status: 200 }));
      action.github.rest.issues.createLabel = jest.fn();
      action.github.rest.issues.updateLabel = jest.fn();
      action.github.rest.issues.listLabelsOnIssue = jest.fn(async () => ({
        data: [{ name: 'fail' }],
      }));

      await action.replaceLabel(
        process.env['INPUT_LABEL-FAIL'],
        process.env['INPUT_LABEL-SUCCESS']
      );

      expect(action.github.rest.issues.addLabels).not.toHaveBeenCalled();
      expect(action.github.rest.issues.removeLabel).not.toHaveBeenCalled();
    });
  });
});
