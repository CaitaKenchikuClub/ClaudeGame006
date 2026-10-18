import { updateSettings, useSettings, type Settings, type Speed } from '../lib/settings';

interface Props {
  onClose: () => void;
}

const TEXT_SPEEDS: [Settings['textSpeed'], string][] = [
  ['slow', '遅い'],
  ['normal', '普通'],
  ['fast', '速い'],
  ['instant', '一瞬'],
];
const AUTO_SPEEDS: [Speed, string][] = [
  ['slow', '遅い'],
  ['normal', '普通'],
  ['fast', '速い'],
];

/** 設定画面（タイトル画面とゲーム画面の両方から開く） */
export default function SettingsPanel({ onClose }: Props) {
  const s = useSettings();

  return (
    <div className="overlay" onClick={(e) => e.stopPropagation()}>
      <header className="overlay-header">
        <h2>設定</h2>
        <button className="btn-close" onClick={onClose} aria-label="閉じる">
          ×
        </button>
      </header>
      <div className="overlay-body settings">
        <section>
          <h4 className="section-title">文字の表示速度</h4>
          <Choice options={TEXT_SPEEDS} value={s.textSpeed} onChange={(textSpeed) => updateSettings({ textSpeed })} />
        </section>
        <section>
          <h4 className="section-title">オート再生の速度</h4>
          <Choice options={AUTO_SPEEDS} value={s.autoSpeed} onChange={(autoSpeed) => updateSettings({ autoSpeed })} />
        </section>
        <section>
          <h4 className="section-title">音量</h4>
          <Volume label="BGM" value={s.bgmVolume} onChange={(bgmVolume) => updateSettings({ bgmVolume })} />
          <Volume label="効果音" value={s.seVolume} onChange={(seVolume) => updateSettings({ seVolume })} />
          <label className="setting-row">
            <span>ミュート（音を消す）</span>
            <input type="checkbox" checked={s.muted} onChange={(e) => updateSettings({ muted: e.target.checked })} />
          </label>
        </section>
      </div>
    </div>
  );
}

function Choice<T extends string>({
  options,
  value,
  onChange,
}: {
  options: [T, string][];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="choice">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'selected' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function Volume({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="setting-row">
      <span>{label}</span>
      <input type="range" min={0} max={100} step={5} value={value} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="volume-value">{value}</span>
    </label>
  );
}
