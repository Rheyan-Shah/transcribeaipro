
import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { TranscriptionSegment, AnalysisResult, AppMode, CalendarEvent, Session } from './types';
import { 
  StatusBadge, 
  SegmentCard, 
  WaveformMonitor, 
  UpcomingEventsCallout, 
  SessionCard,
  EventCard,
  SettingsScreen
} from './components/TranscriberUI';
import { summarizeTranscript } from './services/geminiService';
import { transcribeWithGroq } from './services/groqService';
import { 
  getStoredSchedule, 
  findActiveEvent, 
  parseICS,
  saveSchedule,
  filterUpcomingEvents
} from './services/calendarService';
import { getSessions, saveSession, deleteSession } from './services/storageService';

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.HOME);
  const [isActive, setIsActive] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [segments, setSegments] = useState<TranscriptionSegment[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentStream, setCurrentStream] = useState<MediaStream | null>(null);
  const [pastSessions, setPastSessions] = useState<Session[]>([]);
  const [viewingSession, setViewingSession] = useState<Session | null>(null);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const [schedule, setSchedule] = useState<CalendarEvent[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState<string | null>(null);
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [sessionStartTime, setSessionStartTime] = useState<number | null>(null);

  const [config, setConfig] = useState({
    groqKey: localStorage.getItem('groq_api_key') || '',
  });

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-refresh timer for time display and schedule filtering
  useEffect(() => {
    const timer = setInterval(() => {
      const now = new Date();
      setCurrentTime(now);
      // Clean up past events every minute
      if (now.getSeconds() === 0) {
        setSchedule(prev => filterUpcomingEvents(prev));
      }
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Recording duration timer
  useEffect(() => {
    let interval: number;
    if (isActive && !isPaused) {
      interval = window.setInterval(() => {
        setRecordingSeconds(prev => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isActive, isPaused]);

  const loadData = useCallback(() => {
    setSchedule(getStoredSchedule());
    setPastSessions(getSessions());
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const dynamicGreeting = useMemo(() => {
    const hours = currentTime.getHours();
    let base = "Good morning";
    if (hours >= 12 && hours < 17) base = "Good afternoon";
    if (hours >= 17 || hours < 4) base = "Good evening";

    const activeMeeting = findActiveEvent(schedule);
    if (activeMeeting) return `${base}. You have a meeting in progress: "${activeMeeting.title}"`;
    if (schedule.length > 0) return `${base}. You have ${schedule.length} upcoming items today.`;
    
    return `${base}. Your workspace is clear and ready.`;
  }, [currentTime, schedule]);

  const handleICSImport = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const rawEvents = parseICS(text);
      if (rawEvents.length > 0) {
        saveSchedule(rawEvents);
        setSchedule(filterUpcomingEvents(rawEvents));
        setNotification(`Successfully imported ${rawEvents.length} events.`);
      } else {
        setError("The file was parsed but contained no upcoming events.");
      }
    } catch (err: any) {
      console.error(err);
      setError("Failed to parse calendar. Ensure it's a valid .ics file.");
    }
  }, []);

  const processAudio = useCallback(async (blob: Blob | File) => {
    setIsProcessing(true);
    setError(null);
    try {
      const result = await transcribeWithGroq(blob);
      if (!result.text || result.text.trim().length < 2) {
        throw new Error("Whisper returned empty text. Was the audio silent?");
      }
      
      const newSegment: TranscriptionSegment = {
        id: `seg-${Date.now()}`,
        text: result.text,
        speaker: 'user',
        timestamp: Date.now()
      };
      
      const updatedSegments = [...segments, newSegment];
      setSegments(updatedSegments);
      
      // Auto-save the session as it grows
      if (activeSessionId && viewingSession) {
        const session: Session = {
          ...viewingSession,
          id: activeSessionId,
          segments: updatedSegments,
          analysis: analysis || undefined
        };
        saveSession(session);
        setPastSessions(getSessions());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  }, [activeSessionId, segments, analysis, viewingSession]);

  const startRecording = useCallback(async (eventTitle?: string) => {
    if (!config.groqKey) {
      setError("Groq API Key Required. Configure in Settings.");
      setMode(AppMode.SETTINGS);
      return;
    }

    try {
      setError(null);
      setSegments([]);
      setAnalysis(null);
      setRecordingSeconds(0);
      const now = Date.now();
      setSessionStartTime(now);
      const newId = `session-${now}`;
      setActiveSessionId(newId);
      
      const sessionTitle = eventTitle || `Session ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setViewingSession({ id: newId, title: sessionTitle, timestamp: now, segments: [] });

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setCurrentStream(stream);
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      
      mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data); };
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/m4a' });
        await processAudio(audioBlob);
        stream.getTracks().forEach(t => t.stop());
        setCurrentStream(null);
      };

      mediaRecorder.start();
      setIsActive(true);
      setIsPaused(false);
      setMode(AppMode.LIVE);
    } catch (err: any) {
      setError("Microphone access denied or hardware unavailable.");
    }
  }, [config.groqKey, processAudio]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state !== 'inactive') {
      mediaRecorderRef.current?.stop();
    }
    setIsActive(false);
    setIsPaused(false);
  }, []);

  const runAnalysis = useCallback(async () => {
    if (segments.length === 0) return;
    setIsProcessing(true);
    try {
      const transcript = segments.map(s => s.text).join('\n');
      const result = await summarizeTranscript(transcript);
      if (result) {
        setAnalysis(result);
        if (activeSessionId && viewingSession) {
          const updatedSession = { ...viewingSession, analysis: result, segments };
          saveSession(updatedSession);
          setPastSessions(getSessions());
        }
      }
    } catch (err: any) {
      setError("Summarization failed. Check Gemini API connectivity.");
    } finally {
      setIsProcessing(false);
    }
  }, [segments, activeSessionId, viewingSession]);

  const handleSaveSettings = (newConfig: { groqKey: string }) => {
    setConfig(newConfig);
    localStorage.setItem('groq_api_key', newConfig.groqKey.trim());
    setNotification("Settings saved locally.");
  };

  const downloadTranscript = () => {
    if (!viewingSession) return;
    const content = segments.map(s => s.text).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${viewingSession.title.replace(/\s+/g, '_')}_transcript.txt`;
    a.click();
    setNotification("Exported to local file.");
  };

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return pastSessions;
    const q = searchQuery.toLowerCase();
    return pastSessions.filter(s => 
      s.title.toLowerCase().includes(q) || 
      s.segments.some(seg => seg.text.toLowerCase().includes(q))
    );
  }, [pastSessions, searchQuery]);

  return (
    <div className="flex h-screen w-full bg-[#141414] text-white overflow-hidden selection:bg-[#007AFF]/30">
      {/* Sidebar Navigation */}
      <aside className="w-[280px] notion-sidebar flex flex-col z-20">
        <div className="p-8">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-tr from-[#007AFF] to-[#00C2FF] rounded-lg flex items-center justify-center text-[14px] font-black text-white shadow-lg shadow-blue-500/20">T</div>
            <span className="text-[16px] font-bold tracking-tight text-white">Transcribe Pro</span>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 overflow-y-auto custom-scrollbar">
          <button onClick={() => { setMode(AppMode.HOME); setViewingSession(null); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-bold transition-all ${mode === AppMode.HOME ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
            <span className="material-icons-outlined text-[20px]">dashboard</span>
            <span>Dashboard</span>
          </button>
          <button onClick={() => setMode(AppMode.SEARCH)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-bold transition-all ${mode === AppMode.SEARCH ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
            <span className="material-icons-outlined text-[20px]">search</span>
            <span>Search</span>
          </button>
          <button onClick={() => setMode(AppMode.LIBRARY)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-bold transition-all ${mode === AppMode.LIBRARY ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
            <span className="material-icons-outlined text-[20px]">auto_awesome</span>
            <span>Library</span>
          </button>

          <div className="text-[10px] font-black text-zinc-700 uppercase px-4 py-6 tracking-[0.2em]">Recent History</div>
          <div className="space-y-1">
            {pastSessions.slice(0, 10).map(session => (
              <button 
                key={session.id} 
                onClick={() => { setViewingSession(session); setSegments(session.segments); setAnalysis(session.analysis || null); setMode(AppMode.LIVE); }} 
                className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-[14px] font-medium text-zinc-500 hover:bg-white/5 hover:text-white transition-all group"
              >
                <span className="material-icons-outlined text-[18px] opacity-40 group-hover:opacity-100 group-hover:text-[#007AFF]">description</span>
                <span className="truncate">{session.title}</span>
              </button>
            ))}
          </div>
        </nav>

        <div className="p-4 border-t border-white/5 mt-auto">
            <button onClick={() => setMode(AppMode.SETTINGS)} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-[14px] font-bold transition-all ${mode === AppMode.SETTINGS ? 'bg-white/10 text-white' : 'text-zinc-500 hover:bg-white/5'}`}>
                <span className="material-icons-outlined text-[20px]">settings</span>
                <span>Settings</span>
            </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        <header className="h-16 flex items-center justify-between px-10 border-b border-white/5 bg-[#141414]/80 backdrop-blur-3xl z-10">
          <div className="flex items-center space-x-3 text-[12px] text-zinc-600 font-bold uppercase tracking-[0.1em]">
             <span className="material-icons-outlined text-[16px]">folder</span>
             <span>Local Workspace</span>
             <span>/</span>
             <span className="text-zinc-300">{viewingSession?.title || mode}</span>
          </div>
          <div className="text-[13px] font-mono text-zinc-500 font-bold">
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </header>

        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto custom-scrollbar px-10 md:px-24 py-16">
          <div className="document-canvas">
            {mode === AppMode.HOME ? (
              <div className="animate-in">
                <div className="mb-16">
                    <h1 className="text-[48px] font-black tracking-tighter mb-4 bg-gradient-to-br from-white to-zinc-600 bg-clip-text text-transparent">
                      {dynamicGreeting}
                    </h1>
                    <p className="text-zinc-500 font-medium text-lg">Your intelligence dashboard for {currentTime.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}.</p>
                </div>

                {schedule.length > 0 ? (
                  <UpcomingEventsCallout 
                    event={findActiveEvent(schedule) || schedule[0]} 
                    onStart={() => startRecording(findActiveEvent(schedule)?.title || schedule[0].title)} 
                  />
                ) : null}

                <div className="flex items-center gap-3 text-zinc-600 mb-8 px-1 uppercase tracking-[0.2em] font-black text-[11px]">
                  <span className="material-icons-outlined text-[20px]">history</span>
                  <span>Latest Documents</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">
                  {pastSessions.slice(0, 3).map(session => (
                    <SessionCard key={session.id} session={session} onClick={() => { setViewingSession(session); setSegments(session.segments); setAnalysis(session.analysis || null); setMode(AppMode.LIVE); }} onDelete={(id) => { deleteSession(id); loadData(); }} />
                  ))}
                  {pastSessions.length === 0 && <div className="col-span-full py-20 text-center bg-white/5 rounded-3xl border border-dashed border-white/10 text-zinc-600 font-bold">No sessions captured yet.</div>}
                </div>

                <div className="flex items-center gap-3 text-zinc-600 mb-8 px-1 uppercase tracking-[0.2em] font-black text-[11px]">
                  <span className="material-icons-outlined text-[20px]">calendar_today</span>
                  <span>Full Schedule</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                  {schedule.length > 0 ? schedule.slice(0, 9).map(event => (<EventCard key={event.id} event={event} onStart={() => startRecording(event.title)} />)) : (<div className="col-span-full py-12 text-center bg-white/5 rounded-2xl text-zinc-600 text-[13px] font-bold">No upcoming meetings. Import an .ics file in Settings.</div>)}
                </div>
              </div>
            ) : mode === AppMode.SETTINGS ? (
              <SettingsScreen config={config} onSave={handleSaveSettings} scheduleLoaded={schedule.length > 0} onICSImport={handleICSImport} />
            ) : mode === AppMode.SEARCH ? (
              <div className="animate-in max-w-2xl mx-auto">
                <h1 className="text-[40px] font-black mb-12 tracking-tight">Universal Search</h1>
                <div className="bg-[#202020] p-6 rounded-3xl border border-white/10 flex items-center mb-12 shadow-2xl">
                   <span className="material-icons-outlined text-zinc-500 mr-5">search</span>
                   <input type="text" placeholder="Search keywords or topics..." className="bg-transparent border-none text-white text-lg w-full focus:ring-0 placeholder-zinc-800 font-semibold" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoFocus />
                </div>
                <div className="space-y-4">
                  {filteredSessions.map(session => (
                    <div key={session.id} onClick={() => { setViewingSession(session); setSegments(session.segments); setAnalysis(session.analysis || null); setMode(AppMode.LIVE); }} className="p-8 bg-white/5 rounded-2xl border border-white/5 cursor-pointer hover:bg-white/10 transition-all shadow-xl group">
                       <h4 className="font-bold text-white group-hover:text-[#007AFF] transition-colors mb-2">{session.title}</h4>
                       <p className="text-[14px] text-zinc-500 line-clamp-1">"{session.segments[0]?.text || 'Empty session.'}"</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : mode === AppMode.LIBRARY ? (
              <div className="animate-in">
                <h1 className="text-[40px] font-black mb-16 tracking-tight">Your Library</h1>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                  {pastSessions.map(session => (
                    <SessionCard key={session.id} session={session} onClick={() => { setViewingSession(session); setSegments(session.segments); setAnalysis(session.analysis || null); setMode(AppMode.LIVE); }} onDelete={(id) => { deleteSession(id); loadData(); }} />
                  ))}
                </div>
              </div>
            ) : (
              <div className="animate-in pb-64">
                <StatusBadge isActive={isActive} isPaused={isPaused} duration={formatDuration(recordingSeconds)} />
                <div className="flex items-center justify-between mb-12">
                  <h1 className="text-[56px] font-black tracking-tighter">{viewingSession?.title || 'Live Recording'}</h1>
                </div>
                
                <WaveformMonitor stream={currentStream} isActive={isActive} isPaused={isPaused} />
                
                <div className="space-y-0">
                  {segments.map(segment => (<SegmentCard key={segment.id} segment={segment} startTime={sessionStartTime || undefined} />))}
                  {isProcessing && (<div className="flex items-center space-x-6 text-zinc-600 text-[18px] font-medium pt-12 animate-pulse"><div className="w-2 h-2 rounded-full bg-[#007AFF]"></div><span>Whisper Engine analyzing audio...</span></div>)}
                </div>

                {analysis && (
                  <div className="mt-32 pt-20 border-t border-white/5 animate-in">
                    <div className="flex items-center justify-between mb-12">
                        <h2 className="text-[40px] font-black tracking-tight">Intelligence Report</h2>
                        <span className="material-icons-outlined text-[#007AFF] text-3xl">auto_awesome</span>
                    </div>
                    <div className="p-12 bg-white/5 rounded-[40px] space-y-16 border border-white/5">
                      <p className="text-[22px] text-white leading-relaxed font-semibold italic opacity-90">"{analysis.summary}"</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-16">
                        <div>
                          <h4 className="speaker-label mb-8 text-[#007AFF]">Highlights</h4>
                          <ul className="space-y-4">{analysis.keyPoints.map((p, i) => (<li key={i} className="flex items-start space-x-4 text-[15px] text-zinc-300"><div className="w-1.5 h-1.5 rounded-full bg-zinc-700 mt-2 flex-shrink-0"></div><span>{p}</span></li>))}</ul>
                        </div>
                        <div>
                          <h4 className="speaker-label mb-8 text-[#FF453A]">Action Items</h4>
                          <ul className="space-y-4">{analysis.actionItems.map((p, i) => (<li key={i} className="flex items-start space-x-4 text-[15px] text-zinc-300"><span className="text-[#FF453A] font-black flex-shrink-0">→</span><span>{p}</span></li>))}</ul>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Global Action Bar */}
        <div className="absolute bottom-12 left-1/2 -translate-x-1/2 z-30">
          <div className="floating-pill px-8 py-5 flex items-center space-x-8 bg-[#252525]/90 shadow-2xl">
            <button 
              onClick={isActive ? stopRecording : () => startRecording()}
              className={`w-14 h-14 flex items-center justify-center rounded-2xl transition-all duration-300 ${isActive ? 'bg-[#FF453A]' : 'bg-[#007AFF] hover:scale-105'}`}
            >
              <span className="material-icons-outlined text-3xl text-white">{isActive ? 'stop' : 'mic'}</span>
            </button>
            <div className="h-8 w-[1px] bg-white/10"></div>
            <button disabled={segments.length === 0 || isProcessing} onClick={runAnalysis} className={`flex flex-col items-center gap-1 transition-all group ${segments.length === 0 ? 'opacity-20' : 'text-zinc-500 hover:text-white'}`}>
              <span className="material-icons-outlined text-2xl group-hover:text-[#007AFF]">auto_awesome</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Analyze</span>
            </button>
            <button disabled={segments.length === 0} onClick={downloadTranscript} className={`flex flex-col items-center gap-1 transition-all group ${segments.length === 0 ? 'opacity-20' : 'text-zinc-500 hover:text-white'}`}>
              <span className="material-icons-outlined text-2xl group-hover:text-[#007AFF]">download</span>
              <span className="text-[10px] font-black uppercase tracking-widest">Export</span>
            </button>
          </div>
        </div>

        {/* Feedback Notifications */}
        {error && (
          <div className="fixed bottom-36 right-12 p-6 bg-red-500/10 border border-red-500/20 text-red-400 rounded-2xl z-50 animate-in shadow-2xl max-w-sm backdrop-blur-xl">
            <p className="text-[13px] font-bold leading-relaxed">{error}</p>
            <button onClick={() => setError(null)} className="mt-4 text-[11px] font-black uppercase underline">Dismiss</button>
          </div>
        )}

        {notification && (
          <div className="fixed bottom-36 right-12 px-8 py-4 bg-[#252525] border border-white/10 rounded-2xl shadow-2xl flex items-center gap-4 animate-in z-50">
            <span className="material-icons-outlined text-green-500">check_circle</span>
            <span className="text-[13px] font-bold text-white">{notification}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;
