# canonical/charming-actions/release-charm

This action is used to release an already uploaded charm to a different channel in charmhub.

## Usage

```yaml
      - name: Release charm
        uses: canonical/charming-actions/release-charm@1.0.0
        with:
          credentials: "${{ secrets.CHARMHUB_TOKEN }}"
          github-token: "${{ secrets.GITHUB_TOKEN }}"
          channel: "${{ steps.channel.outputs.name }}"
```

## API

### Inputs

| Key                  | Description                                                                                         | Required |
| -------------------- | --------------------------------------------------------------------------------------------------- | -------- | 
| `credentials`        | Credentials [exported](https://juju.is/docs/sdk/remote-env-auth) using `charmcraft login --export`. | ✔️       |
| `github-token`       | Github Token needed for automatic tagging when publishing                                           | ✔️       |
| `destination-channel`            | Channel to which the charm will be released.                              | ✔️       |
| `origin-channel`            | Origin Channel from where the charm that needs to be promoted will be pulled.                              |          |
| `revision`            | Revision number of charm that will be released. If this option is set `origin-channel` will be ignored.           |          |
| `tag-prefix`         | Tag prefix, useful when bundling multiple charms in the same repo using a matrix.                   |          |         
| `charmcraft-channel` | Snap channel to use when installing charmcraft. Defaults to `latest/edge`.                          |          |

### Outputs

None
