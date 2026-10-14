/*
 * AltStore GSA -80045 workaround, experimental, 2026-10-14.
 * Used by both http-request and http-response entries in the companion module.
 * Uses only plain JavaScript; compatible with Surge's JSC engine.
 * No network calls. No credential logging. Only expiring, hashed correlation
 * metadata is stored. Apple still verifies SRP proofs and the actual 2FA code.
 */
(async function () {
  "use strict";
  const STORE = "altstore_gsa80045_v1";
  const ANDROID = "<Pixel 5> <Android;11;RQ3A.211001.001> <com.apple.AuthKit/1 (com.apple.akd/1.0)>";
  const LOGIN = /^https:\/\/gsa\.apple\.com\/grandslam\/GsService2\/?(?:\?.*)?$/;
  const TRUSTED = /^https:\/\/gsa\.apple\.com\/auth\/verify\/trusteddevice\/?(?:\?.*)?$/;
  const VALIDATE = /^https:\/\/gsa\.apple\.com\/grandslam\/GsService2\/validate\/?(?:\?.*)?$/;
  const CLIENT = "X-MMe-Client-Info";
  const now = Date.now();
  let result = {};

  function note(code) { console.log("[GSA80045] " + code); }
  function get(headers, name) {
    const lower = name.toLowerCase();
    if (Array.isArray(headers)) {
      const entry = headers.find(x => x.field.toLowerCase() === lower);
      return entry ? String(entry.value) : "";
    }
    const key = Object.keys(headers || {}).find(k => k.toLowerCase() === lower);
    return key ? String(headers[key]) : "";
  }
  function change(headers, remove, added) {
    const names = remove.map(x => x.toLowerCase());
    if (Array.isArray(headers)) {
      const copy = headers.filter(x => !names.includes(x.field.toLowerCase()))
        .map(x => ({ field: x.field, value: x.value }));
      Object.keys(added || {}).forEach(field => copy.push({ field, value: added[field] }));
      return copy;
    }
    const copy = {};
    Object.keys(headers || {}).forEach(k => { if (!names.includes(k.toLowerCase())) copy[k] = headers[k]; });
    Object.assign(copy, added || {});
    return copy;
  }
  function eligible(headers) {
    const info = get(headers, CLIENT);
    // Leave native iPhone/iPad AuthKit traffic and unrecognized clients alone.
    return /<(?:macOS|Mac OS X|Android);/i.test(info) && /com\.apple\.AuthKit\/1/i.test(info);
  }
  async function digest(text) {
    // WebView may run in a context without crypto.subtle; keep hashing local
    // and independent of secure-context APIs or remotely downloaded libraries.
    const encoded = encodeURIComponent(text);
    const bytes = [];
    for (let i = 0; i < encoded.length; i++) {
      if (encoded[i] === "%") { bytes.push(parseInt(encoded.slice(i + 1, i + 3), 16)); i += 2; }
      else bytes.push(encoded.charCodeAt(i));
    }
    const bitLength = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 4294967296), low = bitLength >>> 0;
    for (const word of [high, low]) for (let shift = 24; shift >= 0; shift -= 8) bytes.push((word >>> shift) & 255);
    const k = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    const h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];
    const rotr = (x, n) => (x >>> n) | (x << (32 - n));
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const w = [];
      for (let j = 0; j < 16; j++) {
        const n = offset + j * 4;
        w[j] = (bytes[n] << 24) | (bytes[n + 1] << 16) | (bytes[n + 2] << 8) | bytes[n + 3];
      }
      for (let j = 16; j < 64; j++) {
        const x = w[j - 15], y = w[j - 2];
        w[j] = (w[j - 16] + (rotr(x,7) ^ rotr(x,18) ^ (x >>> 3)) + w[j - 7] + (rotr(y,17) ^ rotr(y,19) ^ (y >>> 10))) | 0;
      }
      let [a,b,c,d,e,f,g,z] = h;
      for (let j = 0; j < 64; j++) {
        const t1 = (z + (rotr(e,6) ^ rotr(e,11) ^ rotr(e,25)) + ((e & f) ^ (~e & g)) + k[j] + w[j]) | 0;
        const t2 = ((rotr(a,2) ^ rotr(a,13) ^ rotr(a,22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        z=g; g=f; f=e; e=(d+t1)|0; d=c; c=b; b=a; a=(t1+t2)|0;
      }
      [a,b,c,d,e,f,g,z].forEach((x,j) => { h[j] = (h[j] + x) | 0; });
    }
    return h.map(x => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }
  async function identity(device, machine) {
    if (!device || !machine) return null;
    return digest(String(device).trim().toUpperCase() + "\n" + String(machine).trim());
  }
  function load() {
    let state;
    try { state = JSON.parse($persistentStore.read(STORE) || "{}"); } catch (_) { state = {}; }
    for (const table of ["requests", "pending", "owners"]) {
      if (!state[table] || typeof state[table] !== "object" || Array.isArray(state[table])) state[table] = {};
      Object.keys(state[table]).forEach(k => {
        if (!state[table][k] || state[table][k].expires <= now) delete state[table][k];
      });
    }
    return state;
  }
  function save(state) {
    // Bounded metadata, even when a request never receives a response.
    for (const table of ["requests", "pending", "owners"]) {
      const keys = Object.keys(state[table]).sort((a, b) => state[table][b].expires - state[table][a].expires);
      keys.slice(64).forEach(k => delete state[table][k]);
    }
    return $persistentStore.write(JSON.stringify(state), STORE);
  }

  // Parse the XML plist structure, retaining original byte/string positions.
  // Modification inserts only an au key; encrypted data is never reserialized.
  function plist(xml) {
    if (typeof xml !== "string" || xml.length > 262144 || /^bplist/.test(xml)) throw new Error("unsupported-plist");
    let pos = 0, nodes = 0;
    function skip() {
      while (true) {
        const ws = /^\s*/.exec(xml.slice(pos))[0]; pos += ws.length;
        if (xml.startsWith("<!--", pos)) {
          const end = xml.indexOf("-->", pos + 4); if (end < 0) throw new Error("xml"); pos = end + 3;
        } else if (xml.startsWith("<?", pos)) {
          const end = xml.indexOf("?>", pos + 2); if (end < 0) throw new Error("xml"); pos = end + 2;
        } else if (xml.startsWith("<!DOCTYPE", pos)) {
          const end = xml.indexOf(">", pos + 9);
          // Do not interpret custom/internal entity declarations.
          if (end < 0 || xml.slice(pos, end).includes("[")) throw new Error("xml"); pos = end + 1;
        } else break;
      }
    }
    function decode(s) {
      return s.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|lt|gt|quot|apos);/gi, (_, e) => {
        const named = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
        if (named[e]) return named[e];
        const n = e[1].toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
        return String.fromCodePoint(n);
      });
    }
    function value(depth) {
      if (++nodes > 4096 || depth > 32) throw new Error("xml-limit");
      skip();
      const start = pos;
      const tag = /^<([A-Za-z]+)(?:\s+[^<>]*?)?\s*(\/?)>/.exec(xml.slice(pos));
      if (!tag) throw new Error("xml");
      const kind = tag[1]; pos += tag[0].length;
      const node = { kind, start, openEnd: pos, value: "", end: pos, closeStart: pos };
      if (tag[2]) { if (kind === "dict") node.members = Object.create(null); return node; }
      if (kind === "dict" || kind === "array" || kind === "plist") {
        const children = [];
        skip();
        while (!xml.startsWith("</" + kind + ">", pos)) { children.push(value(depth + 1)); skip(); }
        node.closeStart = pos; pos += kind.length + 3; node.end = pos;
        node.children = children;
        if (kind === "dict") {
          if (children.length % 2) throw new Error("xml");
          node.members = Object.create(null);
          for (let i = 0; i < children.length; i += 2) {
            const key = children[i];
            if (key.kind !== "key" || Object.prototype.hasOwnProperty.call(node.members, key.value)) throw new Error("xml");
            node.members[key.value] = children[i + 1];
          }
        }
        return node;
      }
      if (!["key", "string", "integer", "real", "data", "date", "true", "false"].includes(kind)) throw new Error("xml");
      const end = xml.indexOf("</" + kind + ">", pos);
      if (end < 0 || xml.slice(pos, end).includes("<")) throw new Error("xml");
      node.value = decode(xml.slice(pos, end)); node.closeStart = end;
      pos = end + kind.length + 3; node.end = pos;
      return node;
    }
    const root = value(0); skip();
    if (pos !== xml.length) throw new Error("xml");
    if (root.kind === "plist") {
      if (root.children.length !== 1) throw new Error("xml");
      return root.children[0];
    }
    return root;
  }
  function member(node, key) { return node && node.members ? node.members[key] : undefined; }
  function text(node) { return node && ["string", "integer", "key"].includes(node.kind) ? node.value : ""; }
  function field(node, key) { return text(member(node, key)); }

  try {
    const url = $request.url;
    const method = ($request.method || "GET").toUpperCase();
    if ($script.type === "http-request") {
      if (LOGIN.test(url) && method === "POST" && eligible($request.headers)) {
        // Header-only fallback remains useful if a body cannot be parsed.
        result = { headers: change($request.headers, [CLIENT], { [CLIENT]: ANDROID }) };
        note("android-login-header");
        try {
          const request = member(plist($request.body), "Request");
          const cpd = member(request, "cpd");
          const op = field(request, "o");
          const account = field(request, "u");
          const id = await identity(field(cpd, "X-Mme-Device-Id"), field(cpd, "X-Apple-I-MD-M"));
          if (id && account && $request.id && ["init", "complete"].includes(op)) {
            const owner = await digest(account.trim().toLowerCase());
            const requestID = await digest(String($request.id));
            const state = load();
            const active = state.owners[id];
            const ambiguous = !!(active && (active.ambiguous || active.account !== owner));
            state.owners[id] = { account: owner, ambiguous, expires: now + 180000 };
            if (op === "init" || ambiguous) delete state.pending[id];
            state.requests[requestID] = { identity: id, account: owner, op, expires: now + 180000 };
            if (!save(state)) note("state-write-failed");
            if (ambiguous) note("parallel-accounts-pass-through-2fa");
          }
        } catch (_) { note("request-metadata-unavailable"); }
      } else if (VALIDATE.test(url) && eligible($request.headers)) {
        result = { headers: change($request.headers, [CLIENT], { [CLIENT]: ANDROID }) };
        note("android-code-validation-header");
      } else if (TRUSTED.test(url) && method === "GET" && eligible($request.headers)) {
        const id = await identity(get($request.headers, "X-Mme-Device-Id"), get($request.headers, "X-Apple-I-MD-M"));
        const state = load();
        const pending = id && state.pending[id];
        const owner = id && state.owners[id];
        if (pending && owner && !owner.ambiguous && pending.account === owner.account && get($request.headers, "X-Apple-Identity-Token")) {
          delete state.pending[id];
          if (save(state)) {
            result = { response: { status: 200,
              headers: { "Content-Type": "text/x-xml-plist; charset=utf-8", "Cache-Control": "no-store" },
              body: '<?xml version="1.0" encoding="UTF-8"?><plist version="1.0"><dict><key>ec</key><integer>0</integer></dict></plist>' } };
            note("skip-already-pushed-code-once");
          }
        }
      }
      // lookup, provisioning, SMS endpoints and unrelated requests pass through.
    } else if ($script.type === "http-response" && LOGIN.test(url) && method === "POST" && $request.id) {
      const requestID = await digest(String($request.id));
      const state = load();
      const meta = state.requests[requestID];
      delete state.requests[requestID];
      if (meta) {
        const owner = state.owners[meta.identity];
        if (meta.op === "complete" && owner && !owner.ambiguous && owner.account === meta.account && $response.status === 200) {
          try {
            const response = member(plist($response.body), "Response");
            const status = member(response, "Status");
            const proof = member(response, "M2"), encrypted = member(response, "spd");
            const ec = field(status, "ec"), hsc = field(status, "hsc");
            if (status && status.kind === "dict" && status.closeStart > status.openEnd &&
                /^0$/.test(ec.trim()) && /^409$/.test(hsc.trim()) && !member(status, "au") &&
                proof && proof.kind === "data" && proof.value.trim() && encrypted && encrypted.kind === "data" && encrypted.value.trim()) {
              state.pending[meta.identity] = { account: meta.account, expires: now + 60000 };
              if (save(state)) {
                const insert = '<key>au</key><string>trustedDeviceSecondaryAuth</string>';
                result = { body: $response.body.slice(0, status.closeStart) + insert + $response.body.slice(status.closeStart),
                  headers: change($response.headers, ["Content-Length", "Content-Encoding", "Transfer-Encoding"], {}) };
                note("patched-missing-trusted-device-auth-type");
              } else note("state-write-failed");
            }
          } catch (_) { note("response-plist-pass-through"); }
        }
      }
      if (!result.body) save(state);
    }
  } catch (_) {
    // Never log exceptions that might include a request, identity, or token.
    note("script-error-pass-through");
    result = {};
  }
  $done(result);
})();
