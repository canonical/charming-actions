# canonical/charming-actions/check-libraries

This action will detect if there are any differences between the charm libraries part of the commit
and the ones available on charmhub. By default, this action will post a comment in any PR that fails the check,
but it can also be configured to fail the entire build.

## Usage

```yaml
      - name: Check libraries
        uses: canonical/charming-actions/check-libraries@1.0.0
        with:
          credentials: "${{ secrets.CHARMHUB_TOKEN }}"
          github-token: "${{ secrets.GITHUB_TOKEN }}"
```

## API

### Inputs

| Key                  | Description                                                                                               | Required |
| -------------------- | --------------------------------------------------------------------------------------------------------- | -------- | 
| `charm-path`         | Path to the charm we want to fetch libs for. Defaults to the current working directory.                   |          |
| `credentials`        | Charmhub token used to fetch remote libraries through charmcraft.                                         | ✔️       |
| `github-token`       | GitHub token used to post a comment when `comment-on-pr` is enabled.                                      | ✔️       |
| `comment-on-pr`      | Whether to post a warning as a comment if drift is detected as part of checking a PR. Defaults to `true`. |          |
| `fail-build`         | Whether to fail the entire build if drift is detected. Defaults to `false`.                               |          |
| `charmcraft-channel` | Snap channel to use when installing charmcraft. Defaults to `latest/edge`.                                |          |


### Outputs

None