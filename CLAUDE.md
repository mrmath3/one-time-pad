# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this project is

A static, no-build-step GitHub Pages web app: `index.html` + `styles.css` + `script.js`. No framework, no bundler, no package manager. Open `index.html` directly in a browser to run it.

## Running and testing

```bash
# Quickest local dev server (no install needed)
python3 -m http.server 8000
# then visit http://localhost:8000

# Self-tests: open index.html in a browser, open DevTools console, run:
# runTests()
```

All tests live in `script.js` as `window.runTests`. They run in-browser against the live module — there is no Node/Jest setup.

## Architecture

All logic is in `script.js` as plain functions (no classes, no modules):

- **`encodeToNumeric(text)`** — converts plaintext → digit string, handling FIG wrapping for number runs
- **`numericToText(numeric)`** — converts digit string → plaintext; stateful letter/number mode parser
- **`encrypt(numeric, padStr)`** — subtracts pad digits mod 10; first 5 pad digits are identifier (copied verbatim, not used in arithmetic)
- **`decrypt(encodedStr, padStr)`** — adds pad digits mod 10; validates identifier match
- **`generateSecureDigits(length)`** — uses `crypto.getRandomValues()` with bias rejection (discards bytes ≥ 250)

The encode section is fully reactive: any change to the plaintext or pad textarea immediately recomputes via `updateEncodePreview()` → `tryEncrypt()`. The decode section recomputes on every keystroke via `tryDecode()`.

## Key invariants

- The codec always starts in **Letter mode**. FIG (code `90`) toggles between Letter and Number mode.
- Single-digit letter codes are 1–6 (A E I N O T). All other letter/special codes are two digits (70–99).
- In the two-digit space, `90` = FIG toggle, `99` = space, `91–98` = punctuation/special.
- In Number mode, `90` exits back to Letter mode; all other single digits decode as numerals.
- Digit runs in plaintext are wrapped: `FIG digits FIG` (two FIG codes per run).
- Pad arithmetic uses pad digits starting at index 5 (indices 0–4 are the identifier).

## Cipher math

Encode: `(plaintext_digit − pad_digit + 10) mod 10`
Decode: `(encoded_digit + pad_digit) mod 10`

## Known test vector

```
Plaintext:  MISTER SINDEL IS GOOD AT MATH.
Numeric:    79383628299833472278993839974557299169979167591
Pad prefix: 35601…
Encoded:    3560157858691196037134892976058501825606915307011311
```
