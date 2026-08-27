# Setting up Oakcraft Stock

Three steps. The **app works completely on its own after step 2** — step 1 and
step 3 are what make several phones and laptops show the same data.

| Step | What it gives you | Needed? |
|---|---|---|
| 1 — Website on GitHub Pages | the app in any browser, and over-the-air updates for the phones | optional |
| 2 — Build the APK | the installable Android app | **yes, for phones** |
| 3 — Connect a Google Sheet | one shared set of data across every device | **yes, for more than one device** |

---

## Step 1 — Put the website on GitHub Pages

The Android app already carries every screen inside it, so this step is not what
makes the app work. It gives you two things: the app in a browser on any laptop,
and a place the phones can quietly pick up new screens from without anybody
reinstalling anything.

1. Push this folder to GitHub (this repository is already
   `github.com/Weboakcraft/New_Stock_Software`).

   ```bash
   git add .
   git commit -m "Oakcraft Stock"
   git push
   ```

2. In the repository open **Settings → Pages**.
   Under *Build and deployment* set **Source = GitHub Actions**.

3. Open the **Actions** tab and wait for **Deploy website to GitHub Pages** to
   finish (about a minute).

Your website is then live at:

```
https://weboakcraft.github.io/New_Stock_Software/
```

> **On a private repository**, GitHub Pages needs a paid plan (Pro, Team or
> Enterprise). On the free plan the repository has to be public for Pages to
> publish. The **APK build works either way** — it is only the website, and
> therefore only the automatic updates, that Pages is needed for.

> **On a phone** you can also open that link in Chrome and choose
> **⋮ → Add to Home screen**. The APK in step 2 is better, but this works today.

---

## Step 2 — Build the APK

GitHub builds it for you. You do **not** need Android Studio or a fast computer.

### First, make the signing key (once, ever)

Android decides whether one APK may replace another by looking at the key it was
signed with. Build every APK with the same key and updates install silently over
the old one. Change the key and Android refuses, and the only way out is to
uninstall — which wipes whatever that phone had not yet synced.

```bash
bash tools/make-keystore.sh
```

It prints four values. Add them in **Settings → Secrets and variables → Actions
→ New repository secret**:

`KEYSTORE_BASE64`, `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD`.

Then keep the `.jks` file and its password somewhere safe and offline.

> Skipping this is allowed — the workflow will still build a **TESTING** APK you
> can install and try. It just cannot be updated over later, because the next
> build will be signed with a different throwaway key.

### Then build

1. Repository → **Actions** tab → **Build Android APK** → **Run workflow**.
2. Leave both boxes empty. The address the app checks for updates fills itself in
   from your Pages URL, and the version becomes `1.0.<run number>`.
3. Wait 4–8 minutes (the first run is slower; later runs reuse the cache).
4. Download it from either place:
   * the **Artifacts** box at the bottom of that workflow run, or
   * **Releases → Oakcraft Stock — latest APK**, which is refreshed on every push.
5. Copy `oakcraft-stock.apk` to the phone and open it. Android asks to allow
   installing from this source — allow it once.

### What the APK actually does

* **Every screen is inside the APK.** It opens instantly, with no internet, from
  the very first launch — nothing is downloaded to get started.
* The screens are served to the app over `https://appassets.androidplatform.net`,
  a private address that only exists inside the app. Because it is a proper
  `https` address, the browser database that holds your stock, the clipboard and
  the camera all work normally — and the address never changes, so **your data
  survives every app update**.
* **Printing** opens Android's own print dialog: any Wi-Fi, Bluetooth or USB
  printer your phone knows about, plus *Save as PDF*.
* **Share** on a bill makes a real A4 PDF and hands it to WhatsApp, email or
  anything else on the phone.
* **Downloads** (backups, Excel exports) land in the phone's Downloads folder.
* **The camera scans barcodes.** Any product box with a 📷 button opens the
  scanner; the code is fed in exactly as a USB or Bluetooth scanner would type
  it, so every screen that already handled a hardware scanner handles this too.
* **App lock** — switch it on in *Sync & Backup → Android app* and the app asks
  for a fingerprint, face or the phone's screen lock before it opens.
* **Updates arrive by themselves.** Push a change, the Pages workflow republishes
  the website, and each phone picks up only the files that actually changed —
  checked against a SHA-256 for each one — the next time it is opened online. If
  the download is interrupted, nothing changes and the app keeps running the
  version it has. You only rebuild the APK when something inside `android/`
  changes, or when you want a new version number.

You can see all of this on the phone under **Sync & Backup → Android app**:
which version is running, whether it came from the APK or from a download, where
it looks for updates, and a **Check for update** button.

---

## Step 3 — Connect your Google Sheet

Until you do this, each device keeps its own data. After this, your phone, your
laptop and your staff's devices all show the same thing.

1. Open **https://sheets.new** and rename the new spreadsheet to **Oakcraft Stock Data**.

2. In that sheet: **Extensions → Apps Script**.

3. Delete the sample code. Open `gas/Code.gs` from this repository, copy all of
   it, paste it in, and press the **save** icon.
   *(Shortcut: in the app open **Sync & Backup** and press "Copy the Apps Script
   code" — it puts the same code on your clipboard.)*

4. Near the top of the script change

   ```js
   var TOKEN = 'SET-YOUR-OWN-SECRET-HERE';
   ```

   to a secret word of your own. Save again.

5. **Deploy → New deployment → ⚙ → Web app**

   | Field | Value |
   |---|---|
   | Description | Oakcraft Stock API |
   | Execute as | **Me** |
   | Who has access | **Anyone** |

   Press **Deploy**, then **Authorize access**. Google will warn that the app is
   unverified — that is because the script is yours. Choose
   **Advanced → Go to … (unsafe) → Allow**.

6. Copy the **Web app URL**. It ends in `/exec`.

7. Open Oakcraft Stock → **Sync & Backup**, paste the URL and your secret word,
   press **Connect & test**.

   You should see *"Connected — sheet structure ready"*, and your spreadsheet
   will fill with tabs: `products`, `parties`, `docs`, `docitems`, `moves`,
   `payments`, `categories`, `stores`, `members`, `labels`, `settings`.

8. On every other phone or laptop, open the same website or app, go to
   **Sync & Backup**, paste the **same URL and same secret word**. That device
   now shows everything.

> **Whenever you edit `Code.gs` later**, re-deploy with **Deploy → Manage
> deployments → ✏️ → Version: New version → Deploy**. That keeps the same
> `/exec` URL, so nobody has to re-enter anything.

---

## Everyday things

**Backups.** Sync & Backup → *Download backup* gives you one `.json` with
everything, saved into the phone's Downloads folder. Keep one before any big
change. *Restore from backup* puts it back, either merged or as a full replacement.

**Bill design.** Bill / Invoice Setting has nine themes, your own colour, logo
and signature upload, bank details, UPI QR on the bill, thermal printing at 2″, 3″
or 4″, and extra product columns. The preview on the right updates as you type.
Sharing a bill always makes an A4 PDF, even when the printer setting is thermal.

**Staff.** Member management → Add member, and pick *Sale & Purchase Operator*
for someone who should only add sales and stock-out entries.

**Barcodes.** Add Product → *Auto Barcode*, or type your own, or tap 📷 to scan
one off the box. Barcode Generator prints them on standard A4 label sheets or on
a label roll.

---

## Building the APK on your own computer

Only worth it if you want to change the Android part itself. You need JDK 17 and
the Android SDK (Android Studio installs both).

```bash
cd android
./gradlew assembleDebug                       # a test build, no key needed
./gradlew assembleRelease \
    -PoakKeystore=/full/path/to/oakcraft.jks \
    -PoakKeystorePassword=... -PoakKeyAlias=oakcraft -PoakKeyPassword=... \
    -PoakUpdateUrl=https://weboakcraft.github.io/New_Stock_Software \
    -PoakVersionName=1.0.5 -PoakVersionCode=5
```

The APK lands in `android/app/build/outputs/apk/`. The web files are copied out
of the repository root into the APK automatically by the `bundleWebApp` task, so
there is only ever one copy of the source — edit `index.html` or `assets/` and
rebuild.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| *"The Web App is not public"* | Re-deploy the Apps Script with **Who has access = Anyone**. |
| *"Wrong secret word (TOKEN)"* | The word in `Code.gs` and the one in Sync & Backup must match exactly. |
| *"Cannot reach the Google Script"* | Check the URL ends in `/exec`, and that the phone has internet. Your entries are safe — they stay queued and upload by themselves. |
| Android will not install the APK over the old one | The two were signed with different keys. Set up the four secrets in step 2, or uninstall first (sync to the Google Sheet before you do). |
| The APK workflow says *No signing key found* | That is the warning, not a failure — it built a TESTING APK. Run `bash tools/make-keystore.sh` and add the secrets. |
| The app never picks up an update | *Sync & Backup → Android app* shows the address it checks and the result of the last check. It only checks when the phone is online, a couple of seconds after opening, and when you pull down to refresh. |
| An update made something worse | *Sync & Backup → Android app → Use built-in files* goes back to the screens that shipped inside the APK. Your data is untouched. |
| Website shows an old version | Hard-refresh the browser tab, or open it once in a private window. |
| Pages workflow fails | Settings → Pages → Source must be **GitHub Actions**. On a free plan the repository has to be public. |
| Camera button does nothing | Android asks for camera permission the first time. If it was refused, turn it back on in the phone's Settings → Apps → Oakcraft Stock → Permissions. |
| App lock switch will not turn on | The phone needs a screen lock (PIN, pattern, password or fingerprint) set up first. |

---

## No-GitHub option

`node tools/build-standalone.js` writes `dist/oakcraft-stock-standalone.html` —
the entire app in a single file. Double-click it on any computer and it runs;
useful as an emergency copy on a USB stick. It cannot reach the Google Sheet from
a `file://` address, so treat it as a spare, not the main copy.
