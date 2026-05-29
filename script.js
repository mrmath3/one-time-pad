// ── CT No 1 English Chart ────────────────────────────────────────────────────

// Maps a character (uppercase) to its numeric code string in LETTER mode.
const LETTER_TO_CODE = {
  A: '1', E: '2', I: '3', N: '4', O: '5', T: '6',
  B: '70', C: '71', D: '72', F: '73', G: '74', H: '75',
  J: '76', K: '77', L: '78', M: '79', P: '80', Q: '81',
  R: '82', S: '83', U: '84', V: '85', W: '86', X: '87',
  Y: '88', Z: '89',
  ' ': '99',
  '.': '91',
  ':': '92',
  "'": '93',
  '(': '94',
  ')': '94',
  '+': '95',
  '-': '96',
  '=': '97',
};

// Reverse map: two-digit codes → character (Letter mode)
const CODE_TO_LETTER = {};
for (const [ch, code] of Object.entries(LETTER_TO_CODE)) {
  if (!CODE_TO_LETTER[code]) CODE_TO_LETTER[code] = ch; // first-write wins
}
// Parentheses: 94 → '(' by default
CODE_TO_LETTER['94'] = '(';
// Number mode digits 0-9 → themselves
const CODE_TO_NUMBER = {};
for (let d = 0; d <= 9; d++) CODE_TO_NUMBER[String(d)] = String(d);

const FIG_CODE = '90';
const SPC_CODE = '99';

// Characters that are valid as plaintext input (after uppercasing)
const VALID_CHARS = new Set([
  ...Object.keys(LETTER_TO_CODE),
  '0','1','2','3','4','5','6','7','8','9',
]);

// ── Encoding ─────────────────────────────────────────────────────────────────

/**
 * Convert plaintext string to numeric code string.
 * Returns { numeric: string, cleaned: string, ignored: string[] }
 */
function encodeToNumeric(text) {
  const upper = text.toUpperCase();
  let numeric = '';
  let cleaned = '';
  const ignored = new Set();
  let inNumberMode = false;

  let i = 0;
  while (i < upper.length) {
    const ch = upper[i];

    if (!VALID_CHARS.has(ch)) {
      ignored.add(ch);
      i++;
      continue;
    }

    const isDigit = ch >= '0' && ch <= '9';

    if (isDigit) {
      if (!inNumberMode) {
        // Start a number run: insert FIG to switch to number mode
        numeric += FIG_CODE;
        inNumberMode = true;
      }
      numeric += ch; // number mode: digit codes are themselves
      cleaned += ch;
      i++;
    } else {
      if (inNumberMode) {
        // End number run: insert FIG to switch back to letter mode
        numeric += FIG_CODE;
        inNumberMode = false;
      }
      const code = LETTER_TO_CODE[ch];
      if (code !== undefined) {
        numeric += code;
        cleaned += ch;
      }
      i++;
    }
  }

  // Close any open number mode
  if (inNumberMode) {
    numeric += FIG_CODE;
  }

  return { numeric, cleaned, ignored: [...ignored] };
}

// ── Pad generation ────────────────────────────────────────────────────────────

/**
 * Generate `length` cryptographically-secure random decimal digits.
 * Uses crypto.getRandomValues() and avoids modulo bias by rejecting values ≥ 250.
 */
function generateSecureDigits(length) {
  const digits = [];
  // Over-allocate to reduce how often we loop
  const bufSize = Math.max(length * 2, 256);
  const buf = new Uint8Array(bufSize);

  while (digits.length < length) {
    crypto.getRandomValues(buf);
    for (let i = 0; i < buf.length && digits.length < length; i++) {
      if (buf[i] < 250) {          // reject 250–255 to avoid modulo bias
        digits.push(buf[i] % 10);
      }
    }
  }
  return digits.join('');
}

// ── Encryption ────────────────────────────────────────────────────────────────

/**
 * Encrypt a numeric plaintext string with a pad string.
 * padStr must contain at least numeric.length + 5 digits.
 * Returns encoded string (5-digit identifier + encrypted digits).
 */
function encrypt(numeric, padStr) {
  const padDigits = padStr.replace(/\D/g, '');
  const required = numeric.length + 5;
  if (padDigits.length < required) {
    throw new Error(
      `Pad too short. Need ${required} digits but got ${padDigits.length}.`
    );
  }

  // First 5 pad digits = identifier, copied verbatim
  const identifier = padDigits.slice(0, 5);
  let encrypted = '';

  for (let i = 0; i < numeric.length; i++) {
    const p = parseInt(numeric[i], 10);
    const k = parseInt(padDigits[5 + i], 10);
    encrypted += ((p - k + 10) % 10).toString();
  }

  return identifier + encrypted;
}

// ── Decryption ────────────────────────────────────────────────────────────────

/**
 * Decrypt an encoded message string with a pad string.
 * Returns { numeric, warnMismatch } or throws on bad input.
 */
function decrypt(encodedStr, padStr) {
  const encoded = encodedStr.replace(/\D/g, '');
  const padDigits = padStr.replace(/\D/g, '');

  if (encoded.length < 6) {
    throw new Error('Encoded message must have at least 6 digits (5 identifier + 1 data).');
  }
  if (padDigits.length < 5) {
    throw new Error('Pad must have at least 5 digits (identifier).');
  }

  const msgId = encoded.slice(0, 5);
  const padId = padDigits.slice(0, 5);
  const warnMismatch = msgId !== padId;

  const dataLen = encoded.length - 5;
  if (padDigits.length < 5 + dataLen) {
    throw new Error(
      `Pad too short. Need ${5 + dataLen} digits but got ${padDigits.length}.`
    );
  }

  let numeric = '';
  for (let i = 0; i < dataLen; i++) {
    const e = parseInt(encoded[5 + i], 10);
    const k = parseInt(padDigits[5 + i], 10);
    numeric += ((e + k) % 10).toString();
  }

  return { numeric, warnMismatch, msgId, padId };
}

// ── Numeric → Text decoder ────────────────────────────────────────────────────

/**
 * Convert a numeric plaintext string back to readable text.
 * Returns { text, errors[] }
 *
 * Parser rules:
 *   LETTER mode:
 *     - digits 1-6 → single-digit code
 *     - digit 7, 8, 9 → two-digit code
 *     - digit 0 → two-digit code (90 = FIG; 0x shouldn't appear raw, treat as unknown)
 *   NUMBER mode:
 *     - single digit 0-9 → that numeral
 *     - code 90 → toggle back to LETTER mode
 */
function numericToText(numeric) {
  let text = '';
  const errors = [];
  let i = 0;
  let inNumberMode = false;

  while (i < numeric.length) {
    const d = numeric[i];

    if (inNumberMode) {
      // In number mode: check for FIG (90) to exit, else single digit
      if (d === '9' && numeric[i + 1] === '0') {
        inNumberMode = false;
        i += 2;
      } else {
        text += d;
        i++;
      }
    } else {
      // Letter mode
      const firstDigit = parseInt(d, 10);

      // Single-digit codes: 1-6 map to A E I N O T
      if (firstDigit >= 1 && firstDigit <= 6) {
        const ch = CODE_TO_LETTER[d];
        if (ch) { text += ch; } else { errors.push(`Unknown code: ${d}`); }
        i++;
      } else if (firstDigit === 0 || firstDigit >= 7) {
        // Two-digit code
        if (i + 1 >= numeric.length) {
          errors.push(`Incomplete two-digit code starting with ${d} at position ${i}`);
          i++;
          continue;
        }
        const code = d + numeric[i + 1];

        if (code === '90') {
          // FIG: toggle to number mode
          inNumberMode = true;
          i += 2;
        } else {
          const ch = CODE_TO_LETTER[code];
          if (ch !== undefined) {
            text += ch;
          } else {
            errors.push(`Unknown two-digit code: ${code}`);
          }
          i += 2;
        }
      } else {
        errors.push(`Unexpected digit: ${d}`);
        i++;
      }
    }
  }

  return { text, errors };
}

// ── Group digits ─────────────────────────────────────────────────────────────

function groupDigits(str, groupSize = 5) {
  const digits = str.replace(/\D/g, '');
  return digits.match(/.{1,5}/g)?.join(' ') ?? digits;
}

// ── UI helpers ────────────────────────────────────────────────────────────────

function el(id) { return document.getElementById(id); }
function setText(id, value) { el(id).textContent = value; }
function showError(id, msg) { el(id).textContent = msg; }
function clearError(id) { el(id).textContent = ''; }

function flashCopyBtn(btnId) {
  const btn = el(btnId);
  btn.textContent = 'Copied!';
  setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
}

// ── Encode UI ─────────────────────────────────────────────────────────────────

let currentNumeric = '';   // shared so generate-pad knows the length

function updateEncodePreview() {
  clearError('enc-error');
  el('enc-ignored-notice').textContent = '';

  const rawText = el('enc-plaintext').value;
  if (!rawText.trim()) {
    setText('enc-cleaned', '—');
    setText('enc-numeric', '—');
    el('enc-numeric-len').textContent = '';
    currentNumeric = '';
    return;
  }

  const { numeric, cleaned, ignored } = encodeToNumeric(rawText);
  currentNumeric = numeric;

  setText('enc-cleaned', cleaned || '—');
  setText('enc-numeric', numeric || '—');
  el('enc-numeric-len').textContent = numeric
    ? `${numeric.length} digit${numeric.length !== 1 ? 's' : ''}`
    : '';

  if (ignored.length > 0) {
    el('enc-ignored-notice').textContent =
      `Ignored characters: ${ignored.map(c => JSON.stringify(c)).join(', ')}`;
  }

  // Trigger encryption if pad is already filled
  tryEncrypt();
}

function tryEncrypt() {
  const padRaw = el('enc-pad').value;
  const padDigits = padRaw.replace(/\D/g, '');
  clearError('enc-error');

  el('enc-result-group').style.display = 'none';
  el('enc-grouped-group').style.display = 'none';

  if (!currentNumeric) return;

  const required = currentNumeric.length + 5;

  // Show pad status
  if (padDigits.length === 0) {
    el('enc-pad-status').textContent = `Need at least ${required} pad digits.`;
    return;
  }
  if (padDigits.length < required) {
    el('enc-pad-status').textContent =
      `Pad too short: ${padDigits.length} of ${required} required digits entered.`;
    showError('enc-error', `Pad must have at least ${required} digits (5 identifier + ${currentNumeric.length} for the message). Currently ${padDigits.length}.`);
    return;
  }

  el('enc-pad-status').textContent = `${padDigits.length} digits — OK`;

  try {
    const encoded = encrypt(currentNumeric, padDigits);
    setText('enc-raw', encoded);
    setText('enc-grouped', groupDigits(encoded));
    el('enc-result-group').style.display = '';
    el('enc-grouped-group').style.display = '';
  } catch (e) {
    showError('enc-error', e.message);
  }
}

function handleGeneratePad() {
  if (!currentNumeric) {
    showError('enc-error', 'Enter a plaintext message first so the pad length can be calculated.');
    return;
  }
  const extra = Math.max(0, parseInt(el('enc-pad-extra').value, 10) || 0);
  const length = currentNumeric.length + 5 + extra;
  el('enc-pad').value = generateSecureDigits(length);
  tryEncrypt();
}

function handleCopyRaw() {
  const text = el('enc-raw').textContent;
  if (!text || text === '—') return;
  navigator.clipboard.writeText(text).then(() => {
    flashCopyBtn('enc-copy-raw');
  }).catch(() => {});
}

function handleCopyGrouped() {
  const text = el('enc-grouped').textContent;
  if (!text || text === '—') return;
  navigator.clipboard.writeText(text).then(() => {
    flashCopyBtn('enc-copy-grouped-btn');
  }).catch(() => {});
}

// ── Decode UI ─────────────────────────────────────────────────────────────────

function tryDecode() {
  clearError('dec-error');
  el('dec-warn').textContent = '';
  setText('dec-numeric', '—');
  setText('dec-readable', '—');

  const encodedRaw = el('dec-encoded').value;
  const padRaw = el('dec-pad').value;

  if (!encodedRaw.trim() || !padRaw.trim()) return;

  try {
    const { numeric, warnMismatch, msgId, padId } = decrypt(encodedRaw, padRaw);

    if (warnMismatch) {
      el('dec-warn').textContent =
        `Warning: Pad identifier mismatch. Message ID is ${msgId}, pad ID is ${padId}. You may be using the wrong pad.`;
    }

    setText('dec-numeric', numeric);

    const { text, errors } = numericToText(numeric);
    setText('dec-readable', text || '(empty)');

    if (errors.length > 0) {
      showError('dec-error', 'Decode issues: ' + errors.join('; '));
    }
  } catch (e) {
    showError('dec-error', e.message);
  }
}

// ── Wire up events ────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  el('enc-plaintext').addEventListener('input', updateEncodePreview);
  el('enc-pad').addEventListener('input', tryEncrypt);
  el('enc-pad-extra').addEventListener('input', () => {});
  el('enc-generate-pad').addEventListener('click', handleGeneratePad);
  el('enc-copy-raw').addEventListener('click', handleCopyRaw);
  el('enc-copy-grouped-btn').addEventListener('click', handleCopyGrouped);

  el('dec-encoded').addEventListener('input', tryDecode);
  el('dec-pad').addEventListener('input', tryDecode);
});

// ── Self-test ─────────────────────────────────────────────────────────────────
// Run via browser console: runTests()

function runTests() {
  let passed = 0;
  let failed = 0;

  function assert(label, actual, expected) {
    if (actual === expected) {
      console.log(`  ✓ ${label}`);
      passed++;
    } else {
      console.error(`  ✗ ${label}\n    expected: ${expected}\n    actual:   ${actual}`);
      failed++;
    }
  }

  console.group('One-Time Pad — self-tests');

  // Test 1: encode known message
  const { numeric: n1 } = encodeToNumeric('MISTER SINDEL IS GOOD AT MATH.');
  assert(
    'encodeToNumeric("MISTER SINDEL IS GOOD AT MATH.")',
    n1,
    '79383628299833472278993839974557299169979167591'
  );

  // Test 2: groupDigits
  assert('groupDigits basics', groupDigits('1234567890'), '12345 67890');
  assert('groupDigits with spaces', groupDigits('12 345 6'), '12345 6');

  // Test 3: encrypt with known pad
  // Pad identifier: 35601, then worksheet pad digits
  // Full pad = 35601 + worksheet key digits
  // Encoded message = 3560157858691196037134892976058501825606915307011311
  const knownNumeric = '79383628299833472278993839974557299169979167591';
  // We need to reverse-engineer the pad from the encoded message.
  // encoded[i] = (plaintext[i] - pad[i] + 10) % 10
  // pad[i] = (plaintext[i] - encoded[i] + 10) % 10
  const knownEncoded = '3560157858691196037134892976058501825606915307011311';
  const knownIdentifier = '35601';
  const encData = knownEncoded.slice(5);
  const plainData = knownNumeric;
  let padKey = knownIdentifier;
  for (let i = 0; i < plainData.length; i++) {
    const p = parseInt(plainData[i], 10);
    const e = parseInt(encData[i], 10);
    padKey += ((p - e + 10) % 10).toString();
  }

  const reEncoded = encrypt(knownNumeric, padKey);
  assert('encrypt with known pad', reEncoded, knownEncoded);

  // Test 4: decrypt known encoded back to numeric
  const { numeric: decNumeric } = decrypt(knownEncoded, padKey);
  assert('decrypt known message (numeric)', decNumeric, knownNumeric);

  // Test 5: numeric → text
  const { text: decoded } = numericToText(knownNumeric);
  assert('numericToText known message', decoded, 'MISTER SINDEL IS GOOD AT MATH.');

  // Test 6: individual letter codes
  const { numeric: aCode } = encodeToNumeric('A');
  assert('A encodes to 1', aCode, '1');
  const { numeric: eCode } = encodeToNumeric('E');
  assert('E encodes to 2', eCode, '2');
  const { numeric: mCode } = encodeToNumeric('M');
  assert('M encodes to 79', mCode, '79');
  const { numeric: zCode } = encodeToNumeric('Z');
  assert('Z encodes to 89', zCode, '89');

  // Test 7: space
  const { numeric: spcCode } = encodeToNumeric(' ');
  assert('space encodes to 99', spcCode, '99');

  // Test 8: period
  const { numeric: dotCode } = encodeToNumeric('.');
  assert('. encodes to 91', dotCode, '91');

  // Test 9: digits in plaintext get wrapped with FIG (90)
  const { numeric: digCode } = encodeToNumeric('A5B');
  assert('digits wrapped with FIG: A5B', digCode, '1905' + '90' + '70');

  // Test 10: number mode decode
  const { text: numText } = numericToText('90' + '5' + '90');
  assert('number mode: 90 5 90 → "5"', numText, '5');

  // Test 11: modulo wrap-around in encrypt
  // plaintext digit 1, pad digit 5: (1 - 5 + 10) % 10 = 6
  const enc11 = encrypt('1', '000001');
  // identifier 00000, encrypted digit = (1-1+10)%10 = 0
  assert('encrypt modulo: plaintext=1, pad=00000 1 → last digit 0', enc11, '000000');

  // Test 12: decrypt round-trip fuzz test
  const msg = 'HELLO WORLD.';
  const { numeric: fn } = encodeToNumeric(msg);
  const pad = generateSecureDigits(fn.length + 5);
  const enc = encrypt(fn, pad);
  const { numeric: dn } = decrypt(enc, pad);
  const { text: dt } = numericToText(dn);
  assert('round-trip: HELLO WORLD.', dt, msg);

  console.log(`\n${passed} passed, ${failed} failed`);
  console.groupEnd();
  return { passed, failed };
}

// Expose for console use
window.runTests = runTests;
