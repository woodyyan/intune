import { useEffect, useState } from 'react';
import { IS_IOS, audioState, hasInteracted, playTestTone } from '../lib/audio';

/**
 * iOS/Safari 的 AudioContext 只在用户手势里 resume 才生效。
 * 一旦解锁失败（手势窗口过期、被系统中断、静音键开着），这里给出明确提示和一键重试。
 */
export default function SoundBar() {
  const [bad, setBad] = useState(false);

  useEffect(() => {
    const check = () => {
      const s = audioState();
      setBad(hasInteracted() && s !== 'running' && s !== 'unsupported');
    };
    const t = window.setInterval(check, 1200);
    check();
    return () => window.clearInterval(t);
  }, []);

  if (!bad) return null;

  return (
    <div className="mx-auto max-w-[480px] px-5 pt-3">
      <div
        className="pop rounded-2xl p-3.5 flex items-center gap-3"
        style={{ background: 'var(--ok-soft)', border: '1px solid var(--ok-fill)' }}
      >
        <div className="min-w-0 flex-1">
          <p className="text-[13.5px] font-medium" style={{ color: 'var(--ok)' }}>
            声音还没打开
          </p>
          <p className="text-[12px] mt-0.5" style={{ color: 'var(--ink-2)' }}>
            {IS_IOS
              ? '点右边按钮开启；若仍无声，检查 iPhone 机身左侧的静音键。'
              : '点右边按钮开启声音。'}
          </p>
        </div>
        <button
          className="it-btn flex-none px-3.5 py-2 text-[13px]"
          onClick={() => void playTestTone()}
        >
          开启
        </button>
      </div>
    </div>
  );
}
