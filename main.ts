// Tiny stack VM (ISA v1) — a faithful re-implementation of make.fun's reference VM.
// One program answers every case in $MAKEFUN_INPUT_DIR and writes stdout.bin + exit.txt.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';

const INPUT_DIR = process.env.MAKEFUN_INPUT_DIR ?? '/input';
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Per-opcode descriptor, one char each: high nibble = immediate length,
// bits 3..2 = values popped, bits 1..0 = values pushed. Same table as the reference.
const DESC = "(9i,.237xxxxxxxx1111111-111-111x111xxxxxxxxxxxxxHLLH(xxxxxxxxxxx-0xxxxxxxxxxxxxx,,),";
const OUT_CAP = 65536;
const STEP_LIMIT = 1000000;

const out = new Uint8Array(OUT_CAP);

// Signed 16-bit little-endian immediate at position `at` in the program.
function imm16(program, at) {
  return ((program[at] | (program[at + 1] << 8)) << 16) >> 16;
}

function execute(program, input) {
  const stack = new Int32Array(256);
  const calls = new Int32Array(64);
  const memory = new Int32Array(256);
  let sp = 0, csp = 0, outLen = 0, inPos = 0, pc = 0, steps = 0;
  for (;;) {
    if (steps === STEP_LIMIT) return [outLen, 10];
    if (pc < 0 || pc >= program.length) return [outLen, 9];
    const opcode = program[pc];
    const desc = DESC.charCodeAt(opcode) - 40;
    if (opcode > 83 || desc > 79) return [outLen, 5];
    const immLen = desc >> 4;
    if (pc + immLen >= program.length) return [outLen, 9];
    steps++;
    const pops = (desc >> 2) & 3, pushes = desc & 3;
    if (sp < pops) return [outLen, 2];
    if (sp - pops + pushes > 256) return [outLen, 3];
    pc += 1 + immLen;
    switch (opcode) {
      case 0: return [outLen, 0];
      case 1: stack[sp++] = (program[pc - 1] << 24) >> 24; break;
      case 2: stack[sp++] = program.readInt32LE(pc - 4); break;
      case 3: sp--; break;
      case 4: stack[sp] = stack[sp - 1]; sp++; break;
      case 5: { const a = stack[sp - 1]; stack[sp - 1] = stack[sp - 2]; stack[sp - 2] = a; break; }
      case 6: stack[sp] = stack[sp - 2]; sp++; break;
      case 7: { const a = stack[sp - 3]; stack[sp - 3] = stack[sp - 2]; stack[sp - 2] = stack[sp - 1]; stack[sp - 1] = a; break; }
      case 23: stack[sp - 1] = -stack[sp - 1] | 0; break;
      case 27: stack[sp - 1] = ~stack[sp - 1]; break;
      case 48: case 49: case 50: {
        const off = imm16(program, pc - 2);
        let take = true;
        if (opcode !== 48) { const cond = stack[--sp]; take = opcode === 49 ? cond === 0 : cond !== 0; }
        if (take) pc += off;
        break;
      }
      case 51:
        if (csp === 64) return [outLen, 7];
        calls[csp++] = pc; pc = program[pc - 2] | (program[pc - 1] << 8); break;
      case 52:
        if (!csp) return [outLen, 8];
        pc = calls[--csp]; break;
      case 64: {
        const addr = stack[sp - 1];
        if (addr < 0 || addr > 255) return [outLen, 6];
        stack[sp - 1] = memory[addr]; break;
      }
      case 65: {
        const addr = stack[sp - 1], value = stack[sp - 2];
        if (addr < 0 || addr > 255) return [outLen, 6];
        sp -= 2; memory[addr] = value; break;
      }
      case 80: {
        const text = Buffer.from(String(stack[sp - 1]));
        if (outLen + text.length > OUT_CAP) return [outLen, 11];
        sp--; out.set(text, outLen); outLen += text.length; break;
      }
      case 81:
        if (outLen + 1 > OUT_CAP) return [outLen, 11];
        out[outLen++] = stack[--sp] & 255; break;
      case 82: stack[sp++] = inPos < input.length ? input[inPos++] : -1; break;
      case 83: return [outLen, stack[--sp] & 255];
      default: {
        const rhs = stack[sp - 1], lhs = stack[sp - 2];
        let result;
        if (opcode === 16) result = (lhs + rhs) | 0;
        else if (opcode === 17) result = (lhs - rhs) | 0;
        else if (opcode === 18) result = Math.imul(lhs, rhs);
        else if (opcode === 19) { if (!rhs) return [outLen, 4]; result = lhs === -2147483648 && rhs === -1 ? lhs : (lhs / rhs) | 0; }
        else if (opcode === 20) { if (!rhs) return [outLen, 4]; result = rhs === -1 ? 0 : (lhs % rhs) | 0; }
        else if (opcode === 21) { if (!rhs) return [outLen, 4]; result = ((lhs >>> 0) / (rhs >>> 0)) | 0; }
        else if (opcode === 22) { if (!rhs) return [outLen, 4]; result = ((lhs >>> 0) % (rhs >>> 0)) | 0; }
        else if (opcode === 24) result = lhs & rhs;
        else if (opcode === 25) result = lhs | rhs;
        else if (opcode === 26) result = lhs ^ rhs;
        else if (opcode === 28) result = lhs << (rhs & 31);
        else if (opcode === 29) result = lhs >> (rhs & 31);
        else if (opcode === 30) result = (lhs >>> (rhs & 31)) | 0;
        else if (opcode === 32) result = lhs === rhs ? 1 : 0;
        else if (opcode === 33) result = lhs < rhs ? 1 : 0;
        else result = (lhs >>> 0) < (rhs >>> 0) ? 1 : 0;
        sp -= 2; stack[sp++] = result;
      }
    }
  }
}

for (const name of readdirSync(INPUT_DIR).sort()) {
  const [len, code] = execute(readFileSync(INPUT_DIR + '/' + name + '/program.bin'), readFileSync(INPUT_DIR + '/' + name + '/input.bin'));
  mkdirSync(OUTPUT_DIR + '/' + name, { recursive: true });
  writeFileSync(OUTPUT_DIR + '/' + name + '/stdout.bin', out.subarray(0, len));
  writeFileSync(OUTPUT_DIR + '/' + name + '/exit.txt', code + '\n');
}
