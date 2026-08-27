# Setting up Oakcraft Stock

Three steps, in this order. Total time about 15 minutes, and you only do it once.

---

## Step 1 — Put the website on GitHub Pages

1. Go to **github.com/new** and create a repository.
   Name it **`oakcraft-stock`** and keep it **Private** if you prefer — Pages and the APK build both work on private repos with a free account.

2. Upload this whole folder. Either drag every file into GitHub's "uploading an existing file" page, or from a terminal:

   ```bash
   cd oakcraft-stock
   git init
   git add .
   git commit -m "Oakcraft Stock"
   git branch -M main
   git remote add origin https://github.com/<your-username>/oakcraft-stock.git
   git push -u origin main
   ```

3. In the repository open **Settings → Pages**.
   Under *Build and deployment* set **Source = GitHub Actions**.
   (If you would rather not use Actions, choose *Deploy from a branch* → `main` → `/ (root)`; the site is at the repository root so that works too.)

4. Open the **Actions** tab and wait for **Deploy website to GitHub Pages** to finish (about a minute).

Your website is now live at:

```
https://<your-username>.github.io/oakcraft-stock/
```

Open it on your laptop. It works immediately — data is saved on that device until you do step 3.

> **On a phone**, open that link in Chrome and choose **⋮ → Add to Home screen**. You get an app icon without installing anything. The APK in step 2 is nicer, but this works right now.

---

## Step 2 — Build the APK

The APK is built for you by GitHub. You do **not** need Android Studio.

1. In the repository open the **Actions** tab.
2. Pick **Build Android APK** in the left list → **Run workflow** → **Run workflow**.
   Leave the address box empty; it fills in your GitHub Pages URL by itself.
3. Wait 3–5 minutes.
4. Download the APK from either place:
   * the **Artifacts** section at the bottom of that workflow run, or
   * **Releases → Oakcraft Stock — latest APK** (this one gets a fresh build on every push).

5. Copy `oakcraft-stock.apk` to the phone and open it. Android will ask to allow installing from this source — allow it once.

**What the APK does:** it opens your GitHub Pages address full-screen, with no browser bars. On the first open it caches the whole app on the phone, so after that it starts instantly and keeps working with **no internet**. Downloads (backups, Excel exports), printing to a Bluetooth or Wi-Fi printer, camera permission and file uploads all work. Pull down to refresh.

**Updating the app later:** just push your change to GitHub. The website updates, and the APK picks it up on its next open — nobody has to reinstall anything. You only rebuild the APK if you change something inside `android/`.

**Signing.** The APK is signed with the key in `android/keystore/oakcraft.jks` so that updates install over each other cleanly. If you want your own private key instead, create one and add four repository secrets — `KEYSTORE_BASE64` (the `.jks` file run through `base64 -w0`), `KEYSTORE_PASSWORD`, `KEY_ALIAS`, `KEY_PASSWORD` — and the workflow will use it automatically.

---

## Step 3 — Connect your Google Sheet

Until you do this, each device keeps its own data. After this, your phone, your laptop and your staff's devices all show the same thing.

1. Open **https://sheets.new** and rename the new spreadsheet to **Oakcraft Stock Data**.

2. In that sheet: **Extensions → Apps Script**.

3. Delete the sample code. Open `gas/Code.gs` from this repository, copy all of it, paste it in, and press the **save** icon.
   *(Shortcut: in the app open **Sync & Backup** and press "Copy the Apps Script code" — it puts the same code on your clipboard.)*

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

   Press **Deploy**, then **Authorize access**. Google will warn that the app is unverified — that is because the script is yours. Choose **Advanced → Go to … (unsafe) → Allow**.

6. Copy the **Web app URL**. It ends in `/exec`.

7. Open Oakcraft Stock → **Sync & Backup**, paste the URL and your secret word, press **Connect & test**.

   You should see *"Connected — sheet structure ready"*, and your spreadsheet will fill with tabs: `products`, `parties`, `docs`, `docitems`, `moves`, `payments`, `categories`, `stores`, `members`, `labels`, `settings`.

8. On every other phone or laptop, open the same website, go to **Sync & Backup**, paste the **same URL and same secret word**. That device now shows everything.

> **Whenever you edit `Code.gs` later**, re-deploy with **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. That keeps the same `/exec` URL, so nobody has to re-enter anything.

---

## Everyday things

**Backups.** Sync & Backup → *Download backup* gives you one `.json` with everything. Keep one before any big change. *Restore from backup* puts it back, either merged or as a full replacement.

**Bill design.** Bill / Invoice Setting has nine themes, your own colour, logo and signature upload, bank details, UPI QR on the bill, thermal printing at 2″, 3″ or 4″, and extra product columns (brand, size, colour, serial no, batch no, mfg/exp date, or your own). The preview on the right updates as you type.

**Staff.** Member management → Add member, and pick *Sale & Purchase Operator* for someone who should only add sales and stock-out entries.

**Barcodes.** Add Product → *Auto Barcode*, or type your own. Barcode Generator prints them on standard A4 label sheets or on a label roll. The bill builder's product box also accepts a scanner — scan and the item is added.

---

## If something goes wrong

| What you see | What to do |
|---|---|
| *"The Web App is not public"* | Re-deploy the script with **Who has access = Anyone**. |
| *"Wrong secret word (TOKEN)"* | The word in `Code.gs` and the one in Sync & Backup must match exactly. |
| *"Cannot reach the Google Script"* | Check the URL ends in `/exec`, and that the phone has internet. Your entries are safe — they stay queued and upload by themselves. |
| Website shows an old version | Sync & Backup → *Check for update*. |
| APK opens a blank screen | Its saved address may be wrong: on the error screen tap **Change address** and paste your Pages URL. |
| Pages workflow fails | Settings → Pages → Source must be **GitHub Actions**. |
| APK workflow fails | Open the failed run and check the *Build the release APK* step; almost always it is a missing `android/keystore/oakcraft.jks`. |

---

## No-GitHub option

`dist/oakcraft-stock-standalone.html` is the entire app in a single file. Double-click it on any computer and it runs — useful as an emergency copy on a USB stick. It cannot reach the Google Sheet from a `file://` address, so treat it as a spare, not the main copy.
