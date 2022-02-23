# canonical/charming-actions/upload-charm

This action is used to upload a charm to charmhub.io.

## Usage

```yaml
      - name: Upload charm to charmhub
        uses: canonical/charming-actions/upload-charm@1.0.0
        with:
          credentials: "${{ secrets.CHARMHUB_TOKEN }}"
          github-token: "${{ secrets.GITHUB_TOKEN }}"
          channel: "${{ steps.channel.outputs.name }}"
```

## API

### Inputs

| Key                  | Description                                                                                         | Required |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------- | 
| `charm-path`         | Path to the charm we want to publish. Defaults to the current working directory.                    |          |
| `channel`            | Channel on charmhub to publish the charm in. Defaults to `latest/edge`.                             |          |
| `credentials`        | Credentials [exported](https://juju.is/docs/sdk/remote-env-auth) using `charmcraft login --export`. | ✔️       |
| `github-token`       | Github Token needed for automatic tagging when publishing                                           | ✔️       |
| `tag-prefix`         | Tag prefix, useful when bundling multiple charms in the same repo using a matrix.                   |          |
| `upload-image`       | Toggles whether image resources are uploaded to CharmHub or not. Defaults to `true`.                |          |             
| `charmcraft-channel` | Snap channel to use when installing charmcraft. Defaults to `latest/edge`.                          |          |

### Outputs

None