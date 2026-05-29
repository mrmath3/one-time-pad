# One-Time Pad Encoder / Decoder

**[🔗 Launch the app →](https://mrmath3.github.io/one-time-pad/)**

A static, client-side classroom tool for encoding and decoding messages using the **CT No 1 English** one-time pad chart.

## What it does

- **Encodes** plaintext messages to a numeric cipher using the CT No 1 English chart
- **Decodes** encrypted numeric messages back to readable text
- **Generates** cryptographically-strong random pads using the browser's Web Crypto API
- Handles letter/number mode switching (FIG = 90) automatically
- Works entirely in the browser — no server, no data leaves your device

## How to use

### Encoding

1. Type your plaintext message in the **Encode** section. It is automatically converted to uppercase; unsupported characters are ignored.
2. View the **Numeric plaintext string** — this is your message represented as a sequence of digits.
3. Either type a one-time pad in the pad field, or click **Generate Random Pad**.
4. The **Encoded message** appears automatically once a valid pad is entered.
5. Copy the raw or grouped (every 5 digits) output using the **Copy** button.

### Decoding

1. Paste the encoded digit string into the **Decode** section.
2. Enter the matching one-time pad.
3. The **Decoded message** appears automatically.
4. A warning is shown if the pad identifier (first 5 digits) does not match.

### Chart

The **Chart** section shows the full CT No 1 English mapping:
- Letters A, E, I, N, O, T → single-digit codes 1–6
- Remaining letters → two-digit codes 70–89
- Special characters → codes 90–99 (90 = FIG mode toggle, 99 = space)

## How the cipher works

**Encoding:** `encoded_digit = (plaintext_digit − pad_digit + 10) mod 10`

**Decoding:** `plaintext_digit = (encoded_digit + pad_digit) mod 10`

The first 5 digits of both the pad and the encoded message are the **pad identifier** — they are copied directly and are not used in arithmetic.

## Opening locally

Simply open `index.html` in any modern browser. No web server is required.

```
open index.html        # macOS
start index.html       # Windows
xdg-open index.html    # Linux
```

Or use VS Code Live Server, Python's built-in server, etc.:

```
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deploying to GitHub Pages

This repo is already deployed at **https://mrmath3.github.io/one-time-pad/**.

To deploy your own fork:
1. Fork this repository.
2. In **Settings → Pages**, set the source to `main` branch, `/ (root)`.
3. Your app will be live at `https://YOUR_USERNAME.github.io/one-time-pad/`.

## Running the self-tests

Open `index.html` in a browser, open the browser's developer console, and run:

```js
runTests()
```

This verifies that:
- `"MISTER SINDEL IS GOOD AT MATH."` encodes to the expected numeric string
- Encryption with a known pad produces the expected encoded message
- Decoding that message returns the original plaintext
- Individual letter/number/special character conversions are correct

## Classroom security note

This app uses `crypto.getRandomValues()`, which is the browser's cryptographically strong pseudo-random number generator. For a classroom demonstration of the one-time pad cipher, these pads are appropriate.

**A true one-time pad requires:**
- Truly random pads from a physical entropy source (dice, noise source, etc.)
- Strict key secrecy — the pad must never be seen by anyone except the two communicating parties
- One-time use only — reusing a pad catastrophically breaks security
- Out-of-band exchange — the pad must be exchanged before any messages are sent, over a secure channel
- Immediate destruction of the pad after use

Browser-generated pads are **not** suitable for real cryptographic security.
