import React, { useEffect, useRef } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';
import { CHANNEL_IDS, getChannelForInstrument } from '../audio/instrumentChannels';
import type { ChannelId } from '../audio/instrumentChannels';
import { ANALYSED_CHANNELS } from '../audio/channelLevel';
import { INSTRUMENT_IMAGES } from '../constants/instrumentAssets';
import type { ChannelState } from '../hooks/useMixer';
import { usePlaybackStore } from '../state/PlaybackContext';

interface MixerConsoleProps {
  /** The mix. It is owned by `useMixer` (in App) so it keeps sounding while this card is hidden. */
  channels: ChannelState[];
  onVolume: (channel: ChannelId, volume: number) => void;
  onPan: (channel: ChannelId, pan: number) => void;
  onToggleMute: (channel: ChannelId) => void;
  /** Steps of this pattern light the strip meters. */
  pattern: RhythmPattern;
  isPlaying: boolean;
  /** Real output level (0..1) of a channel; feeds the PIANO and TECLADO meters. */
  getChannelLevel?: (channel: string) => number;
}

const VU_SEGMENTS = 10;
const PAN_STEP = 0.05;

const CHANNEL_IMAGES = INSTRUMENT_IMAGES;

/** Analyser polling interval while nothing is playing. */
const IDLE_POLL_MS = 150;

const panLabel = (pan: number) =>
  Math.abs(pan) < 0.005 ? 'C' : pan > 0 ? `R${Math.round(pan * 50)}` : `L${Math.round(Math.abs(pan) * 50)}`;

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  channels,
  onVolume,
  onPan,
  onToggleMute,
  pattern,
  isPlaying,
  getChannelLevel,
}) => {
  const store = usePlaybackStore();

  // --- VU meters: driven imperatively from the playback store, no React re-render per frame. ---
  const peaksRef = useRef<Record<string, number>>({});
  const stripRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const rafRef = useRef<number | null>(null);
  const patternRef = useRef(pattern);
  const getLevelRef = useRef(getChannelLevel);
  const isPlayingRef = useRef(isPlaying);
  useEffect(() => {
    patternRef.current = pattern;
    getLevelRef.current = getChannelLevel;
    isPlayingRef.current = isPlaying;
  });

  useEffect(() => {
    let lastStep = -1;
    let idleTimer: ReturnType<typeof setTimeout> | null = null;

    const paintMeters = () => {
      let energy = false;
      CHANNEL_IDS.forEach(id => {
        const prev = peaksRef.current[id] || 0;
        let next = Math.max(0, prev * 0.87 - 0.005);
        // Pad and piano are not pattern steps: they follow their strip's real output.
        if ((ANALYSED_CHANNELS as readonly string[]).includes(id)) {
          next = Math.max(next, Math.min(1, getLevelRef.current?.(id) ?? 0));
        }
        peaksRef.current[id] = next;
        if (next > 0) energy = true;

        const strip = stripRefs.current[id];
        if (!strip) return;
        strip.classList.toggle('hot', next > 0.15);
        strip.querySelectorAll<HTMLElement>('.vu-segment').forEach(seg => {
          seg.classList.toggle('active', next >= Number(seg.dataset.threshold));
        });
      });
      if (energy || isPlayingRef.current) {
        rafRef.current = requestAnimationFrame(paintMeters);
      } else {
        rafRef.current = null;
        // Idle: a live piano key can still sound, so check the analysers at a slow rate (no per-frame loop).
        if (getLevelRef.current && idleTimer === null) {
          idleTimer = setTimeout(() => {
            idleTimer = null;
            if (rafRef.current === null) rafRef.current = requestAnimationFrame(paintMeters);
          }, IDLE_POLL_MS);
        }
      }
    };

    const unsubscribe = store.subscribe(() => {
      if (!isPlayingRef.current) return;
      const { step } = store.getSnapshot();
      if (step === lastStep) return;
      lastStep = step;
      const current = patternRef.current;
      current.steps.forEach(s => {
        if (s.step !== step + 1) return;
        const channel = getChannelForInstrument(s.instrument);
        peaksRef.current[channel] = Math.min(1, Math.max(peaksRef.current[channel] || 0, s.velocity));
      });
      if (rafRef.current === null) rafRef.current = requestAnimationFrame(paintMeters);
    });
    if (getLevelRef.current) rafRef.current = requestAnimationFrame(paintMeters);
    return () => {
      unsubscribe();
      if (idleTimer !== null) clearTimeout(idleTimer);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [store]);

  // --- Handlers ---
  const setPan = (channelId: ChannelId, pan: number) => {
    onPan(channelId, Math.round(Math.min(1, Math.max(-1, pan)) * 100) / 100);
  };

  // Pan knob: pointer drag (mouse + touch) and keyboard (arrows, Home = center).
  const dragRef = useRef<{ channelId: ChannelId; startY: number; startPan: number } | null>(null);

  const handlePanPointerDown = (channelId: ChannelId, e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    const ch = channels.find(c => c.id === channelId);
    if (!ch) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    dragRef.current = { channelId, startY: e.clientY, startPan: ch.pan };
  };

  const handlePanPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (!drag) return;
    // Moving up increases pan (towards Right), moving down decreases pan (towards Left)
    setPan(drag.channelId, drag.startPan + (drag.startY - e.clientY) * 0.015);
  };

  const handlePanPointerUp = () => {
    dragRef.current = null;
  };

  const handlePanKeyDown = (ch: ChannelState, e: React.KeyboardEvent<HTMLDivElement>) => {
    const deltas: Record<string, number> = { ArrowUp: PAN_STEP, ArrowRight: PAN_STEP, ArrowDown: -PAN_STEP, ArrowLeft: -PAN_STEP };
    if (e.key in deltas) {
      e.preventDefault();
      setPan(ch.id, ch.pan + deltas[e.key]);
    } else if (e.key === 'Home') {
      e.preventDefault();
      setPan(ch.id, 0);
    }
  };

  return (
    <div className="mixer-console-rack">
      <div className="mixer-channels-container">
        {channels.map((ch) => {
          const channelImg = CHANNEL_IMAGES[ch.id];

          // Generate 10 VU segments (Green, Yellow, Red), rendered top-down
          const segments = Array.from({ length: VU_SEGMENTS }).map((_, idx) => ({
            threshold: (idx + 1) / VU_SEGMENTS,
            type: idx >= 8 ? 'red' : idx >= 6 ? 'yellow' : 'green'
          })).reverse();

          return (
            <div
              key={ch.id}
              ref={el => { stripRefs.current[ch.id] = el; }}
              className={`mixer-channel-strip ${ch.isMuted ? 'muted' : ''}`}
              data-testid={`mixer-channel-${ch.id}`}
            >
              
              {/* Instrument Icon Avatar */}
              {channelImg && (
                <div style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  marginBottom: '10px',
                  marginTop: '4px',
                  position: 'relative'
                }}>
                  <img
                    src={channelImg}
                    alt=""
                    className="channel-avatar"
                    width={26}
                    height={26}
                  />
                </div>
              )}

              {/* 1. PANNING KNOB Area */}
              <div className="channel-pan-section">
                <span className="channel-param-label">PAN</span>
                <div
                  className="pan-knob"
                  role="slider"
                  tabIndex={0}
                  aria-label={`Paneo ${ch.name}`}
                  aria-valuemin={-1}
                  aria-valuemax={1}
                  aria-valuenow={ch.pan}
                  aria-valuetext={panLabel(ch.pan)}
                  onPointerDown={(e) => handlePanPointerDown(ch.id, e)}
                  onPointerMove={handlePanPointerMove}
                  onPointerUp={handlePanPointerUp}
                  onPointerCancel={handlePanPointerUp}
                  onKeyDown={(e) => handlePanKeyDown(ch, e)}
                  onDoubleClick={() => setPan(ch.id, 0)}
                  style={{ transform: `rotate(${ch.pan * 135}deg)`, touchAction: 'none' }}
                  title="Arrastrá arriba/abajo o usá las flechas. Doble clic: centro"
                >
                  <div className="pan-knob-notch"></div>
                </div>
                <span className="pan-value-display">
                  {panLabel(ch.pan)}
                </span>
              </div>

              {/* 2. VU LED Peak meter */}
              <div className="channel-vu-meter">
                {segments.map((seg, sIdx) => (
                  <div
                    key={sIdx}
                    className={`vu-segment ${seg.type}`}
                    data-threshold={seg.threshold}
                  />
                ))}
              </div>

              {/* 3. TACTILE FADER VOLUME SLIDER */}
              <div className="channel-fader-section">
                <div className="fader-scale">
                  <span>+6</span>
                  <span>0</span>
                  <span>-6</span>
                  <span>-18</span>
                  <span>-40</span>
                  <span>-∞</span>
                </div>
                <div className="fader-track-container">
                  <div className="fader-track">
                    <input 
                      type="range"
                      min="0"
                      max="1.5"
                      step="0.01"
                      value={ch.volume}
                      onChange={(e) => onVolume(ch.id, parseFloat(e.target.value))}
                      aria-label={`Volumen ${ch.name}`}
                      className="fader-input"
                    />
                    {/* Visual 3D brushed slider cap over the slider thumb */}
                    <div 
                      className="fader-cap"
                      style={{ 
                        bottom: `calc(${ch.volume / 1.5 * 100}% - 14px)`
                      }}
                    >
                      <div className="fader-cap-notch"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. MUTE TOGGLE LED BUTTON */}
              <div className="channel-mute-section">
                <button 
                  className={`mute-button ${ch.isMuted ? 'active' : ''}`}
                  onClick={() => onToggleMute(ch.id)}
                  title="Silenciar canal"
                  aria-label={`Silenciar ${ch.name}`}
                  aria-pressed={ch.isMuted}
                  data-testid={`mute-${ch.id}`}
                >
                  MUTE
                </button>
                <div className={`mute-led ${ch.isMuted ? 'active' : ''}`}></div>
              </div>

              {/* 5. PHYSICAL GLOWING VFD SCREEN LABEL */}
              <div className="channel-label-holder">
                <div className="vfd-screen channel-label-screen">
                  <div className="vfd-text">{ch.name}</div>
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
};
