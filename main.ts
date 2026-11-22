// Tiny stack VM (ISA v1): a faithful port of make.fun's reference vm.mjs.
import { mkdirSync as k, readdirSync as r, readFileSync as f, writeFileSync as w } from 'node:fs';
const I = process.env.MAKEFUN_INPUT_DIR ?? '/input', O = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const T = "(9i,.237xxxxxxxx1111111-111-111x111xxxxxxxxxxxxxHLLH(xxxxxxxxxxx-0xxxxxxxxxxxxxx,,),";
const o = new Uint8Array(65536);
function run(p, q) {
  const D = new Int32Array(256), C = new Int32Array(64), M = new Int32Array(256);
  let s = 0, c = 0, l = 0, i = 0, pc = 0, n = 0;
  for (;;) {
    if (n === 1e6) return [l, 10];
    if (pc < 0 || pc >= p.length) return [l, 9];
    const b = p[pc], t = T.charCodeAt(b) - 40;
    if (b > 83 || t > 79) return [l, 5];
    const m = t >> 4;
    if (pc + m >= p.length) return [l, 9];
    n++;
    const u = (t >> 2) & 3, v = t & 3;
    if (s < u) return [l, 2];
    if (s - u + v > 256) return [l, 3];
    pc += 1 + m;
    switch (b) {
      case 0: return [l, 0];
      case 1: D[s++] = (p[pc - 1] << 24) >> 24; break;
      case 2: D[s++] = p.readInt32LE(pc - 4); break;
      case 3: s--; break;
      case 4: D[s] = D[s - 1]; s++; break;
      case 5: { const a = D[s - 1]; D[s - 1] = D[s - 2]; D[s - 2] = a; break; }
      case 6: D[s] = D[s - 2]; s++; break;
      case 7: { const a = D[s - 3]; D[s - 3] = D[s - 2]; D[s - 2] = D[s - 1]; D[s - 1] = a; break; }
      case 23: D[s - 1] = -D[s - 1] | 0; break;
      case 27: D[s - 1] = ~D[s - 1]; break;
      case 48: case 49: case 50: {
        const g = ((p[pc - 2] | (p[pc - 1] << 8)) << 16) >> 16;
        let y = 1;
        if (b !== 48) { const z = D[--s]; y = b === 49 ? z === 0 : z !== 0; }
        if (y) pc += g;
        break;
      }
      case 51:
        if (c === 64) return [l, 7];
        C[c++] = pc; pc = p[pc - 2] | (p[pc - 1] << 8); break;
      case 52:
        if (!c) return [l, 8];
        pc = C[--c]; break;
      case 64: {
        const a = D[s - 1];
        if (a < 0 || a > 255) return [l, 6];
        D[s - 1] = M[a]; break;
      }
      case 65: {
        const a = D[s - 1], z = D[s - 2];
        if (a < 0 || a > 255) return [l, 6];
        s -= 2; M[a] = z; break;
      }
      case 80: {
        const g = Buffer.from(String(D[s - 1]));
        if (l + g.length > 65536) return [l, 11];
        s--; o.set(g, l); l += g.length; break;
      }
      case 81:
        if (l + 1 > 65536) return [l, 11];
        o[l++] = D[--s] & 255; break;
      case 82: D[s++] = i < q.length ? q[i++] : -1; break;
      case 83: return [l, D[--s] & 255];
      default: {
        const y = D[s - 1], a = D[s - 2];
        let e;
        if (b === 16) e = (a + y) | 0;
        else if (b === 17) e = (a - y) | 0;
        else if (b === 18) e = Math.imul(a, y);
        else if (b === 19) { if (!y) return [l, 4]; e = a === -2147483648 && y === -1 ? a : (a / y) | 0; }
        else if (b === 20) { if (!y) return [l, 4]; e = y === -1 ? 0 : (a % y) | 0; }
        else if (b === 21) { if (!y) return [l, 4]; e = ((a >>> 0) / (y >>> 0)) | 0; }
        else if (b === 22) { if (!y) return [l, 4]; e = ((a >>> 0) % (y >>> 0)) | 0; }
        else if (b === 24) e = a & y;
        else if (b === 25) e = a | y;
        else if (b === 26) e = a ^ y;
        else if (b === 28) e = a << (y & 31);
        else if (b === 29) e = a >> (y & 31);
        else if (b === 30) e = (a >>> (y & 31)) | 0;
        else if (b === 32) e = a === y ? 1 : 0;
        else if (b === 33) e = a < y ? 1 : 0;
        else e = (a >>> 0) < (y >>> 0) ? 1 : 0;
        s -= 2; D[s++] = e;
      }
    }
  }
}
for (const d of r(I).sort()) {
  const [l, x] = run(f(I + '/' + d + '/program.bin'), f(I + '/' + d + '/input.bin'));
  k(O + '/' + d, { recursive: true });
  w(O + '/' + d + '/stdout.bin', o.subarray(0, l));
  w(O + '/' + d + '/exit.txt', x + '\n');
}
