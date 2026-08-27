#!/usr/bin/env bash
# Creates the signing key the APK is signed with, once.
#
# Every future build has to use this same key, otherwise Android refuses to
# install the new APK over the old one. Keep the .jks file and its password
# somewhere safe — if you lose them you cannot update an installed app, only
# uninstall and reinstall (which erases the data on that phone).
#
#   bash tools/make-keystore.sh                 # asks for a password
#   bash tools/make-keystore.sh mypassword      # or pass one in
set -euo pipefail

OUT="${OUT:-android/keystore/oakcraft.jks}"
ALIAS="${ALIAS:-oakcraft}"
PASS="${1:-}"

if [ -f "$OUT" ]; then
  echo "A key already exists at $OUT — refusing to overwrite it."
  echo "Delete it by hand first if you really mean to make a new one."
  exit 1
fi

if [ -z "$PASS" ]; then
  read -r -s -p "Choose a password for the signing key: " PASS; echo
  read -r -s -p "Type it again: " PASS2; echo
  [ "$PASS" = "$PASS2" ] || { echo "They did not match."; exit 1; }
fi
[ "${#PASS}" -ge 6 ] || { echo "Use at least 6 characters."; exit 1; }

mkdir -p "$(dirname "$OUT")"
keytool -genkeypair -v \
  -keystore "$OUT" -alias "$ALIAS" \
  -keyalg RSA -keysize 4096 -validity 10000 \
  -storepass "$PASS" -keypass "$PASS" \
  -dname "CN=OAKCRAFT, OU=Oakcraft Stock, O=M/s OAKCRAFT, L=Delhi, C=IN"

echo
echo "Key written to $OUT"
echo
echo "To let GitHub build signed APKs, add these four repository secrets"
echo "(Settings -> Secrets and variables -> Actions -> New repository secret):"
echo
echo "  KEYSTORE_BASE64     $(base64 -w0 "$OUT" 2>/dev/null | head -c 40)...  (the full value is below)"
echo "  KEYSTORE_PASSWORD   the password you just chose"
echo "  KEY_ALIAS           $ALIAS"
echo "  KEY_PASSWORD        the same password"
echo
echo "Full KEYSTORE_BASE64 value:"
base64 -w0 "$OUT" 2>/dev/null || base64 "$OUT" | tr -d '\n'
echo
