import React, { useState, useEffect, useRef } from 'react';
import type { RhythmPattern } from '../rhythms/RhythmPatterns';

interface MixerConsoleProps {
  pattern: RhythmPattern;
  currentStep: number;
  isPlaying: boolean;
  onVolumeChange: (channel: string, volume: number) => void;
  onPanChange: (channel: string, pan: number) => void;
  onMuteChange: (channel: string, muted: boolean) => void;
}

interface ChannelState {
  id: string;
  name: string;
  volume: number;
  pan: number;
  isMuted: boolean;
}

const INITIAL_CHANNELS: ChannelState[] = [
  { id: 'bombo', name: 'BOMBO', volume: 1.0, pan: 0.0, isMuted: false },
  { id: 'clave', name: 'CLAVE', volume: 1.0, pan: -0.15, isMuted: false },
  { id: 'shaker', name: 'SHAKER', volume: 0.8, pan: 0.25, isMuted: false },
  { id: 'kick', name: 'KICK', volume: 1.0, pan: 0.0, isMuted: false },
  { id: 'snare', name: 'REDO', volume: 0.9, pan: -0.1, isMuted: false },
  { id: 'hihat', name: 'HI-HAT', volume: 0.85, pan: 0.2, isMuted: false },
  { id: 'click', name: 'CLICK', volume: 0.9, pan: 0.05, isMuted: false },
  { id: 'synth', name: 'TECLADO', volume: 0.7, pan: -0.3, isMuted: false },
];

export const getChannelForInstrument = (inst: string): string => {
  switch (inst) {
    case 'bombo_leguero':
    case 'rim':
    case 'surdo':
      return 'bombo';
    case 'clave':
      return 'clave';
    case 'shaker':
      return 'shaker';
    case 'kick':
    case 'tom_low':
    case 'tom_floor':
      return 'kick';
    case 'snare':
    case 'tom_high':
      return 'snare';
    case 'hihat':
    case 'hihat_foot':
    case 'crash':
    case 'ride':
      return 'hihat';
    case 'click':
      return 'click';
    default:
      return 'synth';
  }
};

export const MixerConsole: React.FC<MixerConsoleProps> = ({
  pattern,
  currentStep,
  isPlaying,
  onVolumeChange,
  onPanChange,
  onMuteChange,
}) => {
  const [channels, setChannels] = useState<ChannelState[]>(INITIAL_CHANNELS);

  // Peak levels (0.0 to 1.0) for VU decay
  const [peaks, setPeaks] = useState<Record<string, number>>({
    bombo: 0, clave: 0, shaker: 0, kick: 0, snare: 0, hihat: 0, click: 0, synth: 0
  });

  const peakRefs = useRef<Record<string, number>>({
    bombo: 0, clave: 0, shaker: 0, kick: 0, snare: 0, hihat: 0, click: 0, synth: 0
  });

  // Track panning drag states
  const [activeDrag, setActiveDrag] = useState<{ channelId: string; startY: number; startPan: number } | null>(null);

  // Trigger peak flashes on steps
  useEffect(() => {
    if (isPlaying && pattern) {
      const activeSteps = pattern.steps.filter(s => s.step === currentStep + 1);
      activeSteps.forEach(step => {
        const channel = getChannelForInstrument(step.instrument);
        // Add a slight multiplier based on step velocity
        triggerPeak(channel, step.velocity);
      });

      // Simple detection for harmony accompaniment triggers (step 0 or half-way mark)
      const midPoint = Math.floor(pattern.subdivision / 2);
      if (currentStep === 0 || currentStep === midPoint) {
        triggerPeak('synth', 0.7);
      }
    }
  }, [currentStep, pattern, isPlaying]);

  // Trigger single previews or test click hits
  const triggerPeak = (channelId: string, level: number) => {
    peakRefs.current[channelId] = Math.min(1.0, Math.max(peakRefs.current[channelId], level));
  };

  // VU Meter smooth decay animation loop (runs on requestAnimationFrame)
  useEffect(() => {
    let animId: number;
    
    const updateVU = () => {
      const newPeaks: Record<string, number> = {};
      let changed = false;

      Object.keys(peakRefs.current).forEach(key => {
        const prev = peakRefs.current[key];
        // Decay exponentially (0.85 per frame) for natural realistic fallback ballistics
        const next = Math.max(0, prev * 0.87 - 0.005);
        peakRefs.current[key] = next;
        
        // Only trigger state update if there is visible difference
        if (Math.abs(peaks[key] - next) > 0.01 || next > 0) {
          changed = true;
        }
        newPeaks[key] = next;
      });

      if (changed) {
        setPeaks({ ...newPeaks });
      }

      animId = requestAnimationFrame(updateVU);
    };

    animId = requestAnimationFrame(updateVU);
    return () => cancelAnimationFrame(animId);
  }, [peaks]);

  // Initialize panning and volume to audio manager on start
  useEffect(() => {
    channels.forEach(ch => {
      onVolumeChange(ch.id, ch.isMuted ? 0 : ch.volume);
      onPanChange(ch.id, ch.pan);
      onMuteChange(ch.id, ch.isMuted);
    });
  }, []);

  const handleVolumeSliderChange = (channelId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    setChannels(prev => prev.map(ch => {
      if (ch.id === channelId) {
        onVolumeChange(channelId, ch.isMuted ? 0 : value);
        return { ...ch, volume: value };
      }
      return ch;
    }));
  };

  const handleMuteToggle = (channelId: string) => {
    setChannels(prev => prev.map(ch => {
      if (ch.id === channelId) {
        const nextMuted = !ch.isMuted;
        onMuteChange(channelId, nextMuted);
        onVolumeChange(channelId, nextMuted ? 0 : ch.volume);
        return { ...ch, isMuted: nextMuted };
      }
      return ch;
    }));
  };

  // Pan knob dragging mouse interaction
  const handlePanMouseDown = (channelId: string, e: React.MouseEvent) => {
    e.preventDefault();
    const ch = channels.find(c => c.id === channelId);
    if (!ch) return;

    setActiveDrag({
      channelId,
      startY: e.clientY,
      startPan: ch.pan
    });
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDrag) return;
      
      // Moving up increases pan (towards Right), moving down decreases pan (towards Left)
      const deltaY = activeDrag.startY - e.clientY;
      const sensitivity = 0.015;
      const newPan = Math.min(1.0, Math.max(-1.0, activeDrag.startPan + deltaY * sensitivity));
      
      setChannels(prev => prev.map(ch => {
        if (ch.id === activeDrag.channelId) {
          onPanChange(ch.id, newPan);
          return { ...ch, pan: newPan };
        }
        return ch;
      }));
    };

    const handleMouseUp = () => {
      if (activeDrag) {
        setActiveDrag(null);
      }
    };

    if (activeDrag) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDrag]);

  // Helper to draw random angles for physical chassis screws
  const screwAngles = useRef<number[]>([12, 45, 87, 34, 115, 78, 62, 95]);

  return (
    <div className="mixer-console-rack brass-trim">
      {/* Physical wood chassis boundaries and rack mount details */}
      <div className="mixer-header">
        <div className="analog-rack-screw" style={{ transform: `rotate(${screwAngles.current[0]}deg)` }}></div>
        <div className="vfd-screen-amber mixer-title-screen">
          <div className="vfd-glow">STUDIO MULTI-CHANNEL CONSOLE MIXER</div>
        </div>
        <div className="analog-rack-screw" style={{ transform: `rotate(${screwAngles.current[1]}deg)` }}></div>
      </div>

      <div className="mixer-channels-container">
        {channels.map((ch) => {
          const peak = peaks[ch.id] || 0;
          
          // Generate 10 VU segments (Green, Yellow, Red)
          const segments = Array.from({ length: 10 }).map((_, idx) => {
            const threshold = (idx + 1) / 10;
            const isActive = peak >= threshold;
            let type: 'green' | 'yellow' | 'red' = 'green';
            if (idx >= 8) type = 'red';
            else if (idx >= 6) type = 'yellow';

            return {
              isActive,
              type
            };
          }).reverse(); // Render top-down (reds on top, greens on bottom)

          return (
            <div key={ch.id} className={`mixer-channel-strip ${ch.isMuted ? 'muted' : ''}`}>
              
              {/* 1. PANNING KNOB Area */}
              <div className="channel-pan-section">
                <span className="channel-param-label">PAN</span>
                <div 
                  className="pan-knob"
                  onMouseDown={(e) => handlePanMouseDown(ch.id, e)}
                  style={{ transform: `rotate(${ch.pan * 135}deg)` }}
                  title="Click and drag up/down to adjust pan"
                >
                  <div className="pan-knob-notch"></div>
                </div>
                <span className="pan-value-display">
                  {ch.pan === 0 ? 'C' : ch.pan > 0 ? `R${Math.round(ch.pan * 50)}` : `L${Math.round(Math.abs(ch.pan) * 50)}`}
                </span>
              </div>

              {/* 2. VU LED Peak meter */}
              <div className="channel-vu-meter">
                {segments.map((seg, sIdx) => (
                  <div 
                    key={sIdx} 
                    className={`vu-segment ${seg.type} ${seg.isActive ? 'active' : ''}`}
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
                      onChange={(e) => handleVolumeSliderChange(ch.id, e)}
                      className="fader-input"
                      {...{ orient: "vertical" } as any}
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
                  onClick={() => handleMuteToggle(ch.id)}
                  title="Mute Channel"
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

      <div className="mixer-footer">
        <div className="analog-rack-screw" style={{ transform: `rotate(${screwAngles.current[2]}deg)` }}></div>
        <div className="brass-brand">ANALOGUE CLASS A SEQUENCER DRUMS</div>
        <div className="analog-rack-screw" style={{ transform: `rotate(${screwAngles.current[3]}deg)` }}></div>
      </div>
    </div>
  );
};
