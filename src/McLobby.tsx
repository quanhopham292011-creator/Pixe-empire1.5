import React, { useState } from 'react';
import './mcui.css';
import McCharacter from './McCharacter';
import { GeneralSkillId } from './types';

type Opt = { id: string; label: string; desc?: string };
type Screen = 'menu' | 'play' | 'new';

export interface McLobbyProps {
  title?: string;
  modes: Opt[];
  difficulties: Opt[];
  saves: { id: string; name: string; info?: string }[];
  onContinue: (saveId: string) => void;
  onCreate: (cfg: { name: string; mode: string; difficulty: string }) => void;
  onSettings: () => void;
  onSkills: () => void;
  onProfile: () => void;
  onFriends?: () => void;      // bỏ trống = nút bị mờ
  onLeaderboard?: () => void;  // bỏ trống = ẩn
  playerName?: string;
  selectedGeneral?: GeneralSkillId;
  onGenerals?: () => void;
}

export default function McLobby(p: McLobbyProps) {
  const [screen, setScreen] = useState<Screen>('menu');
  const [tab, setTab] = useState<'saves' | 'friends'>('saves');
  const [name, setName] = useState('');
  const [mode, setMode] = useState(p.modes[0]?.id ?? '');
  const [diff, setDiff] = useState(p.difficulties[1]?.id ?? p.difficulties[0]?.id ?? '');
  const curMode = p.modes.find(m => m.id === mode);
  const curDiff = p.difficulties.find(d => d.id === diff);

  if (screen === 'menu') {
    return (
      <div className="mc-root">
        <div className="mc-center">
          <div className="mc-logo">{p.title ?? 'PIXEL EMPIRE'}</div>
          <div className="mc-sub">Chỉ huy của đế chế!</div>
          <div className="mc-col">
            <button className="mc-btn green" onClick={() => setScreen('play')}>Chơi</button>
            <button className="mc-btn" onClick={p.onSettings}>Cài đặt</button>
            <button className="mc-btn purple" disabled={!p.onFriends} onClick={p.onFriends}>
              Phòng bạn bè{!p.onFriends ? ' (Sắp có)' : ''}
            </button>
            <button className="mc-btn mc-banner" onClick={p.onSkills}>Cây Kỹ Năng</button>
          </div>
        </div>
        <div className="mc-corner" style={{ left: 10 }}>
          <button className="mc-btn" onClick={p.onProfile}>Hồ sơ</button>
        </div>
        {p.onLeaderboard && (
          <div className="mc-corner" style={{ right: 10 }}>
            <button className="mc-btn" onClick={p.onLeaderboard}>Xếp hạng</button>
          </div>
        )}
        <McCharacter name={p.playerName} selectedGeneral={p.selectedGeneral} onClick={p.onGenerals} />
      </div>
    );
  }

  if (screen === 'play') {
    return (
      <div className="mc-root">
        <div className="mc-top">
          <button className="mc-btn mc-back" onClick={() => setScreen('menu')}>←</button>
          <h1>CHƠI</h1>
          <span style={{ width: 48 }} />
        </div>
        <div className="mc-tabs">
          <button className={'mc-btn dark' + (tab === 'saves' ? ' sel' : '')} onClick={() => setTab('saves')}>
            Ván đã lưu ({p.saves.length})
          </button>
          <button className={'mc-btn dark' + (tab === 'friends' ? ' sel' : '')} onClick={() => setTab('friends')}>
            Phòng bạn bè
          </button>
        </div>
        <div className="mc-row" style={{ marginTop: 10 }}>
          <button className="mc-btn green" onClick={() => setScreen('new')}>Tạo ván mới</button>
        </div>
        <div className="mc-panel">
          {tab === 'saves' ? (
            p.saves.length === 0 ? (
              <div className="mc-empty">
                <div>Chưa có ván nào... bắt đầu thôi!</div>
                <div className="pix" />
                <div>Tạo ván mới để bắt đầu chinh phục.</div>
              </div>
            ) : (
              <div className="mc-list">
                {p.saves.map(s => (
                  <button key={s.id} className="mc-btn dark" style={{ textAlign: 'left' }} onClick={() => p.onContinue(s.id)}>
                    {s.name}
                    {s.info && <div className="mc-desc">{s.info}</div>}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="mc-empty">
              <div>Chơi cùng bạn bè</div>
              <button className="mc-btn purple" style={{ width: 'auto' }} disabled={!p.onFriends} onClick={p.onFriends}>
                {p.onFriends ? 'Tạo / vào phòng' : 'Sắp có'}
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mc-root">
      <div className="mc-top">
        <button className="mc-btn mc-back" onClick={() => setScreen('play')}>←</button>
        <h1>TẠO VÁN MỚI</h1>
        <span style={{ width: 48 }} />
      </div>
      <div className="mc-new">
        <div className="mc-side">
          <div className="mc-prev" />
          <button className="mc-btn green"
            onClick={() => p.onCreate({ name: name.trim() || 'Ván của tôi', mode, difficulty: diff })}>
            TẠO
          </button>
          {p.onFriends && <button className="mc-btn purple" onClick={p.onFriends}>Tạo phòng bạn bè</button>}
        </div>
        <div className="mc-main">
          <div>
            <div className="mc-label">Tên ván</div>
            <input className="mc-input" value={name} placeholder="Ván của tôi" maxLength={30}
              onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <div className="mc-label">Chế độ chơi</div>
            <div className="mc-seg">
              {p.modes.map(m => (
                <button key={m.id} className={'mc-btn' + (m.id === mode ? ' sel' : '')} onClick={() => setMode(m.id)}>{m.label}</button>
              ))}
            </div>
            {curMode?.desc && <div className="mc-desc">{curMode.desc}</div>}
          </div>
          <div>
            <div className="mc-label">Độ khó</div>
            <div className="mc-seg">
              {p.difficulties.map(d => (
                <button key={d.id} className={'mc-btn' + (d.id === diff ? ' sel' : '')} onClick={() => setDiff(d.id)}>{d.label}</button>
              ))}
            </div>
            {curDiff?.desc && <div className="mc-desc">{curDiff.desc}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
