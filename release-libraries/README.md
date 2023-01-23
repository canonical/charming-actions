# Release-libraries

This action is meant to be used on merge. It will:

- fetch the libs owned by the charm from charmhub, compare their version/revision tags with the ones found in libs/charms/charm_name and generate a diff.
- print out a list of libs that are going to be published, and/or an error message if there's something wrong.
- for each bumped lib: run publish-lib and publish it to charmhub.
