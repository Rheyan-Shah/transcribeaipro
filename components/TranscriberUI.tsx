
import React, { useEffect, useRef, memo, useState } from 'react';
import { TranscriptionSegment, CalendarEvent, Session } from '../types';

export const StatusBadge = memo(({ isActive, isPaused, duration }: { isActive: boolean, isPaused?: boolean, duration?: string }) => (
  <div className="flex items-center justify-between mb-4">
    <div className="flex items-center space-x-3">
      <div className={`w-2.5 h-2.5 rounded-full ${isActive ? (isPaused ? 'bg-amber-500' : 'bg-[#FF453A] animate-pulse') : 'bg-zinc-700'}`}></div>
      <span className={`text-[12px] font-bold tracking-[0.2em] uppercase ${isActive ? 'text-[#FF453A]' : 'text-zinc-600'}`}>
        {isActive ? (isPaused ? 'SESSION PAUSED' : 'LIVE TRANSCRIPTION') : 'SYSTEM READY'}
      </span>
    </div>
    {isActive && duration && (
      <div className="px-3 py-1 bg-white/5 rounded-full border border-white/5">
        <span className="text-[12px] font-mono text-zinc-400 font-bold tracking-widest">{duration}</span>
      </div>
    )}
  </div>
));

export const SegmentCard = memo(({ segment, startTime }: { segment: TranscriptionSegment, startTime?: number }) => {
  const speakerName = segment.speaker === 'user' ? 'SPEAKER' : 'SYSTEM';
  const displayTime = startTime 
    ? new Date(segment.timestamp - startTime).toISOString().substr(14, 5)
    : new Date(segment.timestamp).toLocaleTimeString([], { minute: '2-digit', second: '2-digit' });

  return (
    <div className="flex group mb-12 items-start animate-in segment-block">
      <div className="w-24 flex-shrink-0 pt-6">
        <span className="margin-timestamp opacity-0 group-hover:opacity-100 transition-opacity duration-300 text-zinc-600 font-mono text-[11px]">
          {displayTime}
        </span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-3 mb-2">
          <div className="speaker-label tracking-[0.15em]">
            {speakerName}
          </div>
          <div className="h-[1px] w-4 bg-zinc-800"></div>
        </div>
        <p className="text-[18px] leading-[1.7] text-[#E0E0E0] font-normal max-w-2xl">
          {segment.text}
        </p>
      </div>
    </div>
  );
});

export const SessionCard = memo(({ session, onClick, onDelete }: { session: Session; onClick: () => void; onDelete?: (id: string) => void }) => (
  <div 
    onClick={onClick}
    className="card-notion p-6 flex flex-col cursor-pointer h-full relative group bg-[#202020] hover:bg-[#252525] border border-white/5 hover:border-white/10 transition-all duration-300 rounded-2xl shadow-xl hover:shadow-2xl"
  >
    <div className="flex-1">
      <div className="w-10 h-10 rounded-xl bg-zinc-800/50 flex items-center justify-center mb-5 group-hover:bg-[#007AFF]/10 transition-colors">
        <span className="material-icons-outlined text-zinc-500 group-hover:text-[#007AFF] text-xl">description</span>
      </div>
      <h4 className="text-[17px] font-bold text-white mb-2 line-clamp-1">{session.title}</h4>
      <div className="flex items-center space-x-3 text-[12px] text-zinc-500 font-medium">
        <span className="material-icons-outlined text-sm">event</span>
        <span>{new Date(session.timestamp).toLocaleDateString()}</span>
      </div>
    </div>
    {onDelete && (
      <button 
        onClick={(e) => { e.stopPropagation(); onDelete(session.id); }}
        className="absolute top-4 right-4 w-8 h-8 rounded-full bg-black/20 text-zinc-600 hover:text-red-500 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center"
      >
        <span className="material-icons-outlined text-sm">delete</span>
      </button>
    )}
  </div>
));

export const EventCard = memo(({ event, onStart }: { event: CalendarEvent, onStart: () => void }) => (
  <div className="card-notion p-6 flex flex-col bg-[#202020] border border-white/5 hover:border-[#007AFF]/20 h-full group transition-all rounded-2xl">
    <div className="flex items-center justify-between mb-5">
      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-white/5 text-zinc-400 group-hover:text-white transition-colors">
        <span className="material-icons-outlined text-xl">calendar_today</span>
      </div>
      <div className="flex flex-col items-end">
        <span className="text-[12px] font-bold text-zinc-500 uppercase tracking-widest">{event.startTime}</span>
        {event.isExternal && <span className="text-[10px] text-[#007AFF] font-bold tracking-tighter bg-[#007AFF]/10 px-2 py-0.5 rounded-full mt-1">IMPORTED</span>}
      </div>
    </div>
    <h3 className="text-[16px] font-bold text-white mb-2 line-clamp-1">{event.title}</h3>
    <p className="text-[13px] text-zinc-500 mb-6 truncate flex items-center gap-2">
      <span className="material-icons-outlined text-[14px]">location_on</span>
      {event.location || 'No location'}
    </p>
    <button 
      onClick={(e) => { e.stopPropagation(); onStart(); }}
      className="mt-auto w-full py-3 bg-white/5 hover:bg-[#007AFF] text-zinc-300 hover:text-white rounded-xl text-[13px] font-bold transition-all border border-white/5 hover:border-transparent flex items-center justify-center gap-2"
    >
      <span className="material-icons-outlined text-sm">mic</span>
      <span>Start Session</span>
    </button>
  </div>
));

export const UpcomingEventsCallout = memo(({ event, onStart }: { event: CalendarEvent, onStart: () => void }) => (
  <div className="mb-16 animate-in">
    <div className="flex items-center space-x-2 text-zinc-600 mb-6 px-1">
      <span className="material-icons-outlined text-[18px]">bolt</span>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.2em]">Priority Action</h3>
    </div>
    <div className="bg-gradient-to-br from-[#252525] to-[#1E1E1E] rounded-3xl p-10 flex flex-col md:flex-row items-center justify-between gap-8 border border-white/5 shadow-2xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#007AFF]/5 rounded-full blur-3xl -mr-32 -mt-32 group-hover:bg-[#007AFF]/10 transition-all duration-700"></div>
      <div className="flex items-start space-x-10 w-full relative z-10">
        <div className="pt-1.5 flex-shrink-0">
          <div className="flex flex-col items-center">
             <p className="text-[14px] font-black text-[#FF453A] uppercase tracking-widest mb-1">Live</p>
             <div className="w-1.5 h-1.5 rounded-full bg-[#FF453A] animate-ping"></div>
          </div>
        </div>
        <div className={`border-l border-white/10 pl-10 space-y-5 flex-grow`}>
          <div>
            <div className="flex items-center space-x-3 mb-2">
              <h4 className="text-[24px] font-bold text-white tracking-tight">{event.title}</h4>
              <span className="bg-white/10 text-zinc-400 text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-widest">Schedule</span>
            </div>
            <div className="flex items-center space-x-4 text-[14px] text-zinc-400 font-medium">
              <span className="flex items-center space-x-2">
                <span className="material-icons-outlined text-[16px]">place</span>
                <span>{event.location}</span>
              </span>
              <span className="w-1 h-1 rounded-full bg-zinc-700"></span>
              <span className="flex items-center space-x-2">
                <span className="material-icons-outlined text-[16px]">schedule</span>
                <span>{event.startTime} — {event.endTime}</span>
              </span>
            </div>
          </div>
        </div>
      </div>
      <button 
        onClick={onStart}
        className="relative z-10 bg-[#007AFF] hover:bg-[#0062CC] text-white px-10 py-4 rounded-2xl text-[15px] font-bold flex items-center space-x-3 transition-all whitespace-nowrap active:scale-95 shadow-2xl shadow-blue-500/20"
      >
        <span className="material-icons-outlined">play_arrow</span>
        <span>Start Meeting</span>
      </button>
    </div>
  </div>
));

export const SettingsScreen = memo(({ 
  config, 
  onSave,
  scheduleLoaded,
  onICSImport
}: { 
  config: { groqKey: string },
  onSave: (newConfig: { groqKey: string }) => void,
  scheduleLoaded: boolean,
  onICSImport: (file: File) => void
}) => {
  const [localConfig, setLocalConfig] = useState(config);
  const [isSaved, setIsSaved] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSave = () => {
    onSave(localConfig);
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  return (
    <div className="animate-in pb-32 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-16">
        <h1 className="text-[48px] font-bold tracking-tight">Preferences</h1>
        <button 
          onClick={handleSave}
          className={`flex items-center gap-2 px-8 py-3 rounded-2xl text-[14px] font-bold transition-all shadow-xl active:scale-95 ${isSaved ? 'bg-green-500 text-white' : 'bg-[#007AFF] hover:bg-[#0062CC] text-white shadow-blue-500/20'}`}
        >
          <span className="material-icons-outlined text-sm">{isSaved ? 'check' : 'save'}</span>
          <span>{isSaved ? 'Configured' : 'Save Changes'}</span>
        </button>
      </div>

      <section className="mb-16">
        <h3 className="text-zinc-500 font-bold uppercase text-[12px] tracking-[0.2em] mb-8 border-b border-white/5 pb-4">Engine Configuration</h3>
        <div className="bg-[#202020] p-8 rounded-3xl border border-white/5 shadow-inner">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 rounded-lg bg-[#007AFF]/10 flex items-center justify-center text-[#007AFF]">
               <span className="material-icons-outlined text-lg">key</span>
            </div>
            <label className="text-[15px] font-bold text-white">Groq API Key</label>
          </div>
          <p className="text-[13px] text-zinc-500 mb-6 leading-relaxed">
            TranscribeAI uses <span className="text-zinc-300 font-bold">OpenAI Whisper v3</span> hosted on Groq for ultra-fast, accurate transcription. 
            Keep your key secure.
          </p>
          <input 
            type="password" 
            value={localConfig.groqKey}
            onChange={(e) => setLocalConfig({ groqKey: e.target.value })}
            placeholder="gsk_..."
            className="w-full bg-[#191919] border border-white/5 rounded-2xl text-white focus:ring-2 focus:ring-[#007AFF] focus:border-transparent py-4 px-6 font-mono text-sm shadow-inner transition-all"
          />
        </div>
      </section>

      <section className="mb-16">
        <h3 className="text-zinc-500 font-bold uppercase text-[12px] tracking-[0.2em] mb-8 border-b border-white/5 pb-4">Schedule Import</h3>
        <div 
          onClick={() => fileInputRef.current?.click()}
          className={`p-10 bg-[#202020] rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer hover:bg-[#252525] hover:border-[#007AFF]/50 transition-all group`}
        >
          <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-zinc-500 group-hover:text-[#007AFF] group-hover:bg-[#007AFF]/10 transition-all mb-6">
              <span className="material-icons-outlined text-3xl">upload_file</span>
          </div>
          <h4 className="text-[18px] font-bold text-white mb-2">Import iCalendar File</h4>
          <p className="text-[13px] text-zinc-500 text-center max-w-sm mb-8">
            Upload an <span className="text-zinc-300 font-bold">.ics</span> file to populate your dashboard with upcoming meetings and automated titles.
          </p>
          
          <div className={`flex items-center gap-2 px-6 py-2.5 rounded-full ${scheduleLoaded ? 'bg-green-500/10 text-green-500' : 'bg-white/5 text-zinc-400'}`}>
            <span className="material-icons-outlined text-sm">{scheduleLoaded ? 'check_circle' : 'add_circle_outline'}</span>
            <span className="text-[12px] font-bold uppercase tracking-widest">{scheduleLoaded ? 'Calendar Active' : 'Select ICS File'}</span>
          </div>
          
          <input 
            ref={fileInputRef}
            type="file"
            accept=".ics"
            className="hidden"
            onChange={(e) => e.target.files && onICSImport(e.target.files[0])}
          />
        </div>
      </section>
      
      <div className="p-8 bg-zinc-900/50 rounded-3xl border border-white/5">
        <p className="text-zinc-500 text-[12px] text-center leading-relaxed">
          TranscribeAI Pro stores all transcripts locally in your browser. <br/>
          Your API keys are never shared or sent to our servers.
        </p>
      </div>
    </div>
  );
});

export const WaveformMonitor: React.FC<{ stream: MediaStream | null; isActive: boolean; isPaused?: boolean }> = ({ stream, isActive, isPaused }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (isActive && stream && !isPaused) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      analyser.fftSize = 128;
      source.connect(analyser);
      
      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const draw = () => {
        animationRef.current = requestAnimationFrame(draw);
        analyser.getByteFrequencyData(dataArray);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        const barWidth = 4;
        const gap = 4;
        let x = (canvas.width - (bufferLength * (barWidth + gap))) / 2;

        for (let i = 0; i < bufferLength; i++) {
          const barHeight = (dataArray[i] / 255) * canvas.height;
          ctx.fillStyle = i % 2 === 0 ? '#007AFF' : '#2A2A2A';
          ctx.globalAlpha = 0.8;
          ctx.fillRect(x, (canvas.height - barHeight) / 2, barWidth, barHeight);
          x += barWidth + gap;
        }
      };
      draw();
      return () => {
        cancelAnimationFrame(animationRef.current);
        audioContext.close();
      };
    } else {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#2A2A2A';
      const count = 40;
      const barWidth = 4;
      const gap = 4;
      const xStart = (canvas.width - (count * (barWidth + gap))) / 2;
      for (let i = 0; i < count; i++) {
        const h = 4;
        ctx.fillRect(xStart + i * (barWidth + gap), (canvas.height - h) / 2, barWidth, h);
      }
    }
  }, [isActive, stream, isPaused]);

  return (
    <div className="w-full h-24 flex items-center justify-center mb-16 bg-[#1A1A1A] rounded-3xl border border-white/5 relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-r from-[#1A1A1A] via-transparent to-[#1A1A1A] z-10"></div>
      <canvas ref={canvasRef} width={600} height={96} className="w-full h-full relative z-0 opacity-60" />
    </div>
  );
};
