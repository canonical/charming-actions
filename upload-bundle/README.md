# canonical/charming-actions/upload-bundle

This action is used to upload a bundle to charmhub.io.

## Usage

```yaml
      - name: Upload bundle to edge
        uses: canonical/charming-actions/upload-charm@1.0.0
        with:
          credentials: "${{ secrets.CHARMCRAFT_AUTH }}"
          github-token: "${{ secrets.GITHUB_TOKEN }}"
```

## API

### Inputs

| Key                  | Description                                                                                         | Required |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------- | 
| `bundle-path`        | Path to the bundle we want to publish. Defaults to the current working directory.                   |          |
| `channel`            | Channel on charmhub to publish the bundle in. Defaults to `latest/edge`.                            |          |
| `credentials`        | Credentials [exported](https://juju.is/docs/sdk/remote-env-auth) using `charmcraft login --export`. | ✔️       |
| `github-token`       | GitHub token used to post a comment when `comment-on-pr` is enabled.                                | ✔️       |


### Outputs

None