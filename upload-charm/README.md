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

## Charm Resources
### OCI Image

When uploading a charm with OCI image resources, a new revision of the OCI image will be published
and attached to the release. It is possible to disable this behavior using either `upload-image: false`
or by providing `resource-overrides` pointing at a specific existing revision.
### Files

When uploading a charm with file resources, the most recent resource will be attached to the release.
If you want to use a new resource, you'll have to cut a new resource revision **prior** to running the action.

## API

### Inputs

| Key                  | Description                                                                                                      | Required |
|----------------------|------------------------------------------------------------------------------------------------------------------| -------- |
| `charm-path`         | Path to the charm we want to publish. Defaults to the current working directory.                                 |          |
| `built-charm-path`   | Path to a pre-built charm we want to publish.                                                                    |          |
| `channel`            | Channel on charmhub to publish the charm in. Defaults to `latest/edge`.                                          |          |
| `credentials`        | Credentials [exported](https://juju.is/docs/sdk/remote-env-auth) using `charmcraft login --export`.              | ✔️        |
| `destructive-mode`   | Whether or not to pack using destructive mode. Defaults to `true`.                                               |          |
| `github-token`       | Github Token needed for automatic tagging when publishing                                                        | ✔️        |
| `tag-prefix`         | Tag prefix, useful when bundling multiple charms in the same repo using a matrix.                                |          |
| `upload-image`       | Toggles whether image resources are uploaded to CharmHub or not. Defaults to `true`.                             |          |
| `pull-image`         | Toggles whether image resources are pulled. Defaults to `true`.                                                  |          |
| `charmcraft-channel` | Snap channel to use when installing charmcraft. Defaults to `latest/edge`.                                       |          |
| `resource-overrides` | Charm resource revision overrides. Separate entries using commas, ie. `"promql-transform:2,prometheus-image:12"` |          |
### Outputs

None
