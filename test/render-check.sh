#!/bin/sh
# Real-browser render gate. Loads every route in headless Chrome, asserts an
# expected string rendered, and fails on undefined / NaN / [object Object] /
# unrendered template leftovers anywhere in the DOM.
#
#   sh test/render-check.sh
#
# (No `timeout` wrapper — it is not installed on macOS by default.)
set -u
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
[ -x "$CHROME" ] || { echo "Chrome not found at $CHROME"; exit 1; }
DIR="$(cd "$(dirname "$0")/.." && pwd)"
FAIL=0
# Run this suite alone: a second headless Chrome started against the same
# profile while it is working will hang the run mid-suite. (A private
# --user-data-dir is worse — it hangs on first-run profile creation.)

check() {
  route="$1"; expect="$2"
  # --dump-dom includes <script> bodies; strip them so the junk scan sees only
  # rendered markup (the renderers' own template literals live in those scripts).
  dom=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=6000 \
    --dump-dom "file://$DIR/app.html$route" 2>/dev/null \
    | perl -0pe 's{<script\b.*?</script>}{}gs')
  if ! printf '%s' "$dom" | grep -q "$expect"; then
    echo "FAIL  $route  → expected to find: $expect"; FAIL=1; return
  fi
  bad=$(printf '%s' "$dom" | grep -oE 'undefined|NaN|\[object Object\]|\$\{' | sort -u | tr '\n' ' ')
  if [ -n "$bad" ]; then
    echo "FAIL  $route  → rendered junk: $bad"; FAIL=1; return
  fi
  echo "ok    $route"
}

check "#dashboard"                    "Horse slip"
check "#trainer/horses"               "My horses"
check "#trainer/books"                "See condition books"
check "#trainer/books/ELP"            "condition book"
check "#trainer/books/DED"            "Quarter Horse"
check "#trainer/windows"              "Entry windows"
check "#trainer/submissions"          "Awaiting the track"
check "#trainer/messages"             "racing office"
check "#trainer/messages/SAR"         "Saratoga"
check "#horse/modo"                   "Connections of last start"
check "#horse/midnight-still"         "Unraced"
check "#horse/sabine-pass"            "Vet"
check "#race/elp-d2-r4"               "Spots allocated"
check "#race/sar-d1-r1"              "NEW YORK"
check "#track/dashboard"              "racing office"
check "#track/book"                   "condition book"
check "#track/book/elp-d2"            "Race 1"
check "#track/queue"                  "Entry requests"
check "#track/horses"                 "Horses &amp; history"
check "#track/overnight"              "OVERNIGHT"
check "#track/overnight/elp-d2"       "ALSO ELIGIBLE\|RACE 1"
check "#track/messages"               "Messages"
check "#track/race/elp-d1-r3"         "Eligible and not yet in"
check "#system/log"                   "Activity log"
check "#system/submissions"           "Submission records"

# The landing page too.
dom=$("$CHROME" --headless=new --disable-gpu --virtual-time-budget=4000 \
  --dump-dom "file://$DIR/index.html" 2>/dev/null)
if printf '%s' "$dom" | grep -q "What changed"; then echo "ok    index.html"; else
  echo "FAIL  index.html"; FAIL=1; fi

[ "$FAIL" -eq 0 ] && echo "\nrender-check: all routes rendered clean" || echo "\nrender-check: FAILURES above"
exit $FAIL
