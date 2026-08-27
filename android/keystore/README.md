# The signing key lives here

Android identifies an app by **who signed it**, not by its name. Every build of
Oakcraft Stock has to be signed with the same key, otherwise a phone refuses to
install the new APK over the old one — the only way out then is to uninstall,
which erases whatever that phone had not yet synced to your Google Sheet.

So: make the key once, and keep it safe forever.

```bash
bash tools/make-keystore.sh
```

That writes `oakcraft.jks` into this folder and prints the four values to paste
into **Settings → Secrets and variables → Actions** on GitHub:

| Secret | What to paste |
|---|---|
| `KEYSTORE_BASE64` | the long base64 blob the script prints |
| `KEYSTORE_PASSWORD` | the password you chose |
| `KEY_ALIAS` | `oakcraft` |
| `KEY_PASSWORD` | the same password |

Once those four secrets exist, **Build Android APK** signs every APK with your
key and publishes it to the *latest* release.

`ci.jks` (what the workflow writes at build time) is git-ignored. `oakcraft.jks`
is **not** ignored — if you commit it, anyone who can read the repository can
sign an app that pretends to be yours, so only do that on a private repository,
and prefer the secrets above.

Keep an offline copy of the `.jks` file and the password somewhere that is not
this computer. Losing it cannot be undone.
