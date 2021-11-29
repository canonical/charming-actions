# charmcraft-upload

This action allows you to easily upload a charmed operator to [charmhub.io][charmhub].

[charmhub]: https://charmhub.io/


## Developing

Start by cloning the repository:

```sh
git clone git@github.com:canonical/charmhub-upload-action.git
cd charmhub-upload-action
```

Then, run this command to ensure you don't forget to build `dist/index.js`:

    ln -s ../../hooks/pre-commit .git/hooks/pre-commit

Finally, install node.js and install dependencies:

    sudo snap install node --classic --channel 12/stable
    npm install
    npm run-script build
