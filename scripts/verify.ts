import { YinDetector } from '../src/lib/yin';
import { centsBetween, midiToFreq } from '../src/lib/music';
import { scoreRound, type Sample } from '../src/lib/scoring';
import { generateRound } from '../src/lib/curriculum';
import type { Note } from '../src/types';

let failed = 0;
function check(name: string, ok: boolean, detail: string) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${detail}`);
  if (!ok) failed++;
}

const SR = 24000;
const N = 2048;

function sine(freq: number, amp = 0.5): Float32Array {
  const buf = new Float32Array(N);
  for (let i = 0; i < N; i++) buf[i] = amp * Math.sin((2 * Math.PI * freq * i) / SR);
  return buf;
}

const yin = new YinDetector({ sampleRate: SR, threshold: 0.12, minFreq: 80, maxFreq: 1000 });

for (const [name, freq, midi] of [
  ['A4 440Hz', 440, 69],
  ['C4 261.6Hz', 261.63, 60],
  ['C3 130.8Hz', 130.81, 48],
  ['E4 329.6Hz', 329.63, 64],
] as [string, number, number][]) {
  const r = yin.detect(sine(freq));
  const err = r ? Math.abs(r.freq - freq) : Infinity;
  const cents = r ? centsBetween(r.freq, midi) : NaN;
  check(
    `YIN ${name}`,
    !!r && err < 2.5 && Math.abs(cents) < 8,
    r ? `freq=${r.freq.toFixed(2)} err=${err.toFixed(2)}Hz cents=${cents.toFixed(1)} clarity=${r.clarity.toFixed(2)}` : 'null',
  );
}

const flat = yin.detect(sine(415.3));
const flatCents = flat ? centsBetween(flat.freq, 69) : NaN;
check('YIN 偏低 100 音分', Math.abs(flatCents + 100) < 10, `cents=${flatCents.toFixed(1)}`);

const quiet = yin.detect(sine(440, 0.0005));
check(
  '弱信号仍能出数（音量过滤交给上层 RMS 门限）',
  quiet !== null && Math.abs(quiet.freq - 440) < 2,
  `freq=${quiet?.freq.toFixed(2) ?? 'null'}`,
);

const notes = [
  { midi: 60, start: 0, dur: 1 },
  { midi: 64, start: 1.3, dur: 1.6 },
];
const bpm = 88;
const spb = 60 / bpm;

function samples(offsetCents: number): Sample[] {
  const out: Sample[] = [];
  for (const n of notes) {
    const from = n.start * spb;
    const to = (n.start + n.dur) * spb;
    for (let t = from; t < to; t += 0.06) {
      const f = midiToFreq(n.midi) * Math.pow(2, offsetCents / 1200);
      out.push({ t, freq: f, rms: 0.2 });
    }
  }
  return out;
}

const perfect = scoreRound('interval', 'test', notes, samples(0), bpm, 40);
check('完美演唱得分接近满分', perfect.score >= 95, `score=${perfect.score} cents=${perfect.meanAbsCents}`);

const off30 = scoreRound('interval', 'test', notes, samples(30), bpm, 40);
check('偏高 30 音分仍算命中', off30.score >= 70 && off30.hitRate > 0.9, `score=${off30.score} hit=${off30.hitRate.toFixed(2)}`);

const off90 = scoreRound('interval', 'test', notes, samples(90), bpm, 40);
check('偏高 90 音分判定不达标', off90.score < 70 && off90.hitRate === 0, `score=${off90.score} hit=${off90.hitRate.toFixed(2)}`);

const silent = scoreRound('interval', 'test', notes, [], bpm, 40);
check('没唱出来得 0 分', silent.score === 0, `score=${silent.score}`);

const early: Sample[] = [];
for (let t = 0; t < notes[0].dur * spb; t += 0.06) early.push({ t, freq: midiToFreq(60), rms: 0.2 });
for (let t = notes[0].dur * spb - 0.12; t < 2.4; t += 0.06) early.push({ t, freq: midiToFreq(64), rms: 0.2 });
const earlyRes = scoreRound('interval', 'test', notes, early, bpm, 40);
check(
  '提前起音不串扰前一音',
  earlyRes.noteResults[0].meanAbsCents < 20 && earlyRes.noteResults[1].meanAbsCents < 20,
  `note0=${earlyRes.noteResults[0].meanAbsCents.toFixed(1)} note1=${earlyRes.noteResults[1].meanAbsCents.toFixed(1)}`,
);

const shaky: Sample[] = [];
for (let t = 0; t < notes[0].dur * spb; t += 0.06) {
  const c = (t % 0.24 < 0.12 ? 55 : -55);
  shaky.push({ t, freq: midiToFreq(60) * Math.pow(2, c / 1200), rms: 0.2 });
}
const shakyRes = scoreRound('longtone', 'test', [notes[0]], shaky, bpm, 40);
check('抖动大的长音扣分', shakyRes.score < 60, `score=${shakyRes.score} std=${shakyRes.noteResults[0].std.toFixed(1)}`);

const range = { low: 50, high: 70 };
for (const stage of ['longtone', 'interval', 'phrase', 'challenge', 'discriminate'] as const) {
  let ok = true;
  let detail = '';
  for (let i = 0; i < 40; i++) {
    const r = generateRound(stage, 1 + (i % 10), range);
    if (!r.notes.length || r.notes.some((n) => !Number.isFinite(n.midi) || n.midi < 30 || n.midi > 95)) {
      ok = false;
      detail = JSON.stringify(r.notes);
      break;
    }
  }
  check(`关卡生成 ${stage}`, ok, ok ? '40 次随机全部合法' : detail);
}

const longToneMidis = new Set<number>();
for (let i = 0; i < 40; i++) longToneMidis.add(generateRound('longtone', 3, range).notes[0].midi);
check('下一关会换新的音（随机性仍在）', longToneMidis.size >= 5, `${longToneMidis.size} 种不同音高`);

const allNatural = [...longToneMidis].every((m) => [0, 2, 4, 5, 7, 9, 11].includes(((m % 12) + 12) % 12));
check('长音只用白键自然音', allNatural, `样本 ${[...longToneMidis].slice(0, 6).join(',')}`);

const intervalNotes: Note[] = [
  { midi: 60, start: 0, dur: 1 },
  { midi: 64, start: 1.3, dur: 1.6 },
];
const SIM_BPM = 88;

function simulateSinging(opts: {
  delaySec: number;
  attackCents: number;
  attackSec: number;
  jitter: number;
}) {
  const spb = 60 / SIM_BPM;
  const samples: Sample[] = [];
  for (let t = opts.delaySec; t <= 2.9 * spb; t += 0.06) {
    const local = t - opts.delaySec;
    const n = intervalNotes.find(
      (nn) => local >= nn.start * spb && local <= (nn.start + nn.dur) * spb,
    );
    if (!n) continue;
    const since = local - n.start * spb;
    let cents = 0;
    if (since < opts.attackSec) cents = opts.attackCents * (1 - since / opts.attackSec);
    cents += Math.sin(since * 17) * opts.jitter;
    samples.push({ t, freq: midiToFreq(n.midi) * Math.pow(2, cents / 1200), rms: 0.2 });
  }
  return scoreRound('interval', 'sim', intervalNotes, samples, SIM_BPM, 40);
}

const lateStart = simulateSinging({ delaySec: 0.32, attackCents: -180, attackSec: 0.15, jitter: 4 });
const n0 = lateStart.noteResults[0];
const n1 = lateStart.noteResults[1];
console.log(
  `    诊断：晚开口 0.32s + 起音偏低 180¢ → 第 1 音 命中${(n0.hitRate * 100).toFixed(0)}% 偏差${n0.meanAbsCents.toFixed(0)}¢ 起音${n0.onsetCents.toFixed(0)}¢ ｜ 第 2 音 命中${(n1.hitRate * 100).toFixed(0)}% 偏差${n1.meanAbsCents.toFixed(0)}¢ 起音${n1.onsetCents.toFixed(0)}¢`,
);
check(
  '晚开口不会毁掉第一个音',
  n0.hitRate > 0.85 && n0.meanAbsCents < 25,
  `hit=${(n0.hitRate * 100).toFixed(0)}% cents=${n0.meanAbsCents.toFixed(0)}`,
);
check(
  '第一个音与第二个音判定接近',
  Math.abs(n0.meanAbsCents - n1.meanAbsCents) < 15 && Math.abs(n0.hitRate - n1.hitRate) < 0.15,
  `偏差差 ${Math.abs(n0.meanAbsCents - n1.meanAbsCents).toFixed(0)}¢ 命中差 ${(Math.abs(n0.hitRate - n1.hitRate) * 100).toFixed(0)}%`,
);

const noisySamples: Sample[] = [];
for (const n of notes) {
  let k = 0;
  for (let t = n.start * spb; t < (n.start + n.dur) * spb; t += 0.06) {
    const wrong = k % 6 === 0;
    noisySamples.push({ t, freq: midiToFreq(n.midi) * (wrong ? 2.1 : 1), rms: 0.2 });
    k++;
  }
}
const noisyRes = scoreRound('interval', 'test', notes, noisySamples, bpm, 40);
check(
  '零星误检（杂音/八度跳变）不会毁掉评分',
  noisyRes.noteResults.every((r) => r.meanAbsCents < 30 && r.hitRate > 0.7),
  noisyRes.noteResults.map((r) => `${r.meanAbsCents.toFixed(0)}¢/${(r.hitRate * 100).toFixed(0)}%`).join(' '),
);

const badAttack = simulateSinging({ delaySec: 0.2, attackCents: -350, attackSec: 0.3, jitter: 4 });
check(
  '起音严重跑调仍要扣分（宽限不能掩盖真问题）',
  badAttack.noteResults[0].meanAbsCents > 30 || badAttack.noteResults[0].hitRate < 0.8,
  `cents=${badAttack.noteResults[0].meanAbsCents.toFixed(0)} hit=${(badAttack.noteResults[0].hitRate * 100).toFixed(0)}%`,
);

const phrase = generateRound('phrase', 5, range);
const outOfRange = phrase.notes.filter((n) => n.midi < range.low - 3 || n.midi > range.high + 3);
check('旋律移调后落在音域内', outOfRange.length === 0, `${phrase.phraseName} notes=${phrase.notes.map((n) => n.midi).join(',')}`);

console.log(failed === 0 ? '\nALL PASS' : `\n${failed} FAILED`);
if (failed > 0) throw new Error(`${failed} checks failed`);
