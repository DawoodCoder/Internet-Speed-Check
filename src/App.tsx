/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useRef } from 'react';
import { Activity, Download, Upload, Share2 } from 'lucide-react';
import { motion } from 'motion/react';
import { toBlob } from 'html-to-image';

type TestPhase = 'idle' | 'ping' | 'download' | 'upload' | 'complete';

const Speedometer = ({ value, max = 100, unit = "Mbps" }: { value: number, max?: number, unit?: string }) => {
  const percentage = Math.min(Math.max(value / max, 0), 1);
  const angle = percentage * 180 - 90;
  const radius = 90;
  const circumference = Math.PI * radius;
  const dashOffset = circumference - (percentage * circumference);

  const ticks = [];
  for (let i = 0; i <= 10; i++) {
    const tickAngle = (i / 10) * 180 - 90;
    const isMajor = i % 2 === 0;
    const length = isMajor ? 8 : 4;
    const tickValue = (max / 10) * i;
    
    ticks.push(
      <g key={i} transform={`rotate(${tickAngle} 100 100)`}>
        <line x1="100" y1="16" x2="100" y2={16 + length} stroke="#4b5563" strokeWidth={isMajor ? 2 : 1} />
        {isMajor && (
          <text x="100" y={36} fill="#6b7280" fontSize="8" textAnchor="middle" transform={`rotate(${-tickAngle} 100 36)`} className="font-mono font-medium">
            {tickValue >= 1000 ? `${tickValue/1000}k` : tickValue}
          </text>
        )}
      </g>
    );
  }

  return (
    <div className="relative flex flex-col items-center">
      <div className="relative w-80 h-40 overflow-hidden">
        <svg viewBox="0 0 200 100" className="w-full h-full overflow-visible drop-shadow-[0_0_8px_rgba(59,130,246,0.3)]">
          <defs>
            <linearGradient id="gauge-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#06b6d4" />
              <stop offset="50%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>
          
          {ticks}

          {/* Background Track */}
          <path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="#1f2937"
            strokeWidth="6"
            strokeLinecap="round"
          />
          {/* Active Track */}
          <motion.path
            d="M 10 100 A 90 90 0 0 1 190 100"
            fill="none"
            stroke="url(#gauge-gradient)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ type: "spring", stiffness: 60, damping: 15 }}
          />
        </svg>
        
        {/* Needle */}
        <motion.div
          className="absolute bottom-0 left-1/2 w-1.5 h-32 bg-white origin-bottom rounded-t-full shadow-[0_0_10px_rgba(255,255,255,0.5)]"
          style={{ x: "-50%", y: "0%" }}
          animate={{ rotate: angle }}
          transition={{ type: "spring", stiffness: 60, damping: 15 }}
        />
        {/* Needle Base */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-8 h-8 bg-gray-900 rounded-full shadow-lg border-4 border-white flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
        </div>
      </div>
      
      <div className="mt-10 text-center">
        <div className="text-6xl font-bold tracking-tighter text-white font-mono">
          {value.toFixed(1)}
        </div>
        <div className="text-gray-400 font-medium uppercase tracking-widest text-sm mt-2">
          {unit}
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ label, value, unit, icon, active }: { label: string, value: number | null, unit: string, icon: React.ReactNode, active: boolean }) => {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-gray-900 border ${active ? 'border-blue-500/50 shadow-[0_0_15px_rgba(59,130,246,0.2)]' : 'border-gray-800'} p-4 transition-all duration-300`}>
      <div className="flex items-center gap-2 text-gray-400 mb-2">
        <div className={active ? 'text-blue-400 animate-pulse' : ''}>
          {icon}
        </div>
        <span className="text-sm font-medium uppercase tracking-wider">{label}</span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-white font-mono">
          {value !== null ? (label === 'Ping' ? Math.round(value) : value.toFixed(1)) : '--'}
        </span>
        <span className="text-sm text-gray-500 font-medium">{unit}</span>
      </div>
      
      {active && (
        <div className="absolute -inset-1 bg-gradient-to-r from-blue-500/10 to-violet-500/10 blur-xl -z-10" />
      )}
    </div>
  );
};

export default function App() {
  const [phase, setPhase] = useState<TestPhase>('idle');
  const [ping, setPing] = useState<number | null>(null);
  const [download, setDownload] = useState<number | null>(null);
  const [upload, setUpload] = useState<number | null>(null);
  const [currentSpeed, setCurrentSpeed] = useState(0);
  const [maxSpeed, setMaxSpeed] = useState(100);

  const captureRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);

  useEffect(() => {
    if (currentSpeed > maxSpeed * 0.9) {
      setMaxSpeed(prev => prev * 2);
    }
  }, [currentSpeed, maxSpeed]);

  const startTest = async () => {
    setPhase('ping');
    setPing(null);
    setDownload(null);
    setUpload(null);
    setCurrentSpeed(0);
    setMaxSpeed(100);

    // 1. Ping Test
    let totalPing = 0;
    const pingCount = 5;
    for (let i = 0; i < pingCount; i++) {
      const start = performance.now();
      await fetch('/api/ping', { cache: 'no-store' });
      const end = performance.now();
      totalPing += (end - start);
    }
    setPing(totalPing / pingCount);

    // 2. Download Test
    setPhase('download');
    await testDownload();

    // 3. Upload Test
    setPhase('upload');
    await testUpload();

    setPhase('complete');
    setCurrentSpeed(0);
  };

  const testDownload = async () => {
    return new Promise<void>(async (resolve) => {
      try {
        const response = await fetch('/api/download?size=30000000', { cache: 'no-store' }); // 30MB
        if (!response.body) return resolve();
        
        const reader = response.body.getReader();
        let received = 0;
        const startTime = performance.now();
        let lastReportTime = startTime;
        
        let windowBytes = 0;
        let windowStartTime = startTime;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          received += value.length;
          windowBytes += value.length;
          
          const now = performance.now();
          
          if (now - lastReportTime > 100) {
            const duration = (now - startTime) / 1000;
            const avgSpeed = (received * 8 / 1000000) / duration;
            
            const windowDuration = (now - windowStartTime) / 1000;
            const windowSpeed = (windowBytes * 8 / 1000000) / windowDuration;
            
            const displaySpeed = (avgSpeed * 0.3) + (windowSpeed * 0.7);
            
            setCurrentSpeed(displaySpeed);
            setDownload(avgSpeed);
            
            lastReportTime = now;
            windowBytes = 0;
            windowStartTime = now;
          }
        }
        
        const totalDuration = (performance.now() - startTime) / 1000;
        const finalSpeed = (received * 8 / 1000000) / totalDuration;
        setDownload(finalSpeed);
        resolve();
      } catch (e) {
        console.error(e);
        resolve();
      }
    });
  };

  const testUpload = async () => {
    return new Promise<void>((resolve) => {
      const size = 20 * 1024 * 1024; // 20MB
      const data = new Uint8Array(size);
      const blob = new Blob([data], { type: 'application/octet-stream' });

      const xhr = new XMLHttpRequest();
      const startTime = performance.now();
      let lastReportTime = startTime;
      
      let windowBytes = 0;
      let windowStartTime = startTime;
      let lastLoaded = 0;

      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const now = performance.now();
          const loaded = event.loaded;
          const chunk = loaded - lastLoaded;
          lastLoaded = loaded;
          windowBytes += chunk;

          if (now - lastReportTime > 100) {
            const duration = (now - startTime) / 1000;
            const avgSpeed = (loaded * 8 / 1000000) / duration;
            
            const windowDuration = (now - windowStartTime) / 1000;
            const windowSpeed = (windowBytes * 8 / 1000000) / windowDuration;
            
            const displaySpeed = (avgSpeed * 0.3) + (windowSpeed * 0.7);
            
            setCurrentSpeed(displaySpeed);
            setUpload(avgSpeed);
            
            lastReportTime = now;
            windowBytes = 0;
            windowStartTime = now;
          }
        }
      };

      xhr.onload = () => {
        const totalDuration = (performance.now() - startTime) / 1000;
        const finalSpeed = (size * 8 / 1000000) / totalDuration;
        setUpload(finalSpeed);
        resolve();
      };

      xhr.onerror = () => {
        resolve();
      };

      xhr.open('POST', '/api/upload');
      xhr.send(blob);
    });
  };

  const handleShare = async () => {
    if (!captureRef.current) return;
    setIsSharing(true);
    try {
      const blob = await toBlob(captureRef.current, { cacheBust: true, backgroundColor: '#030712' });
      if (!blob) throw new Error('Failed to generate image');
      
      const file = new File([blob], 'speed-test-result.png', { type: 'image/png' });
      
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'My Internet Speed',
          text: `I just tested my internet speed! Download: ${download?.toFixed(1)} Mbps, Upload: ${upload?.toFixed(1)} Mbps.`,
          files: [file]
        });
      } else {
        // Fallback to download
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'speed-test-result.png';
        a.click();
        URL.revokeObjectURL(url);
        alert('Image downloaded! You can now share it with your friends.');
      }
    } catch (err) {
      console.error('Error sharing:', err);
      alert('Could not share the image. Please try again.');
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-between font-sans">
      <div className="flex-1 flex flex-col items-center justify-center w-full p-6">
        <div ref={captureRef} className="max-w-2xl w-full space-y-16 p-8 rounded-3xl bg-gray-950">
          <div className="text-center space-y-2">
            <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-r from-cyan-400 via-blue-500 to-violet-500 text-transparent bg-clip-text">
              Speed Test
            </h1>
            <p className="text-gray-400">Check your internet connection speed</p>
          </div>

          <div className="flex justify-center">
            <Speedometer value={currentSpeed} max={maxSpeed} unit="Mbps" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard label="Ping" value={ping} unit="ms" icon={<Activity size={20} />} active={phase === 'ping'} />
            <StatCard label="Download" value={download} unit="Mbps" icon={<Download size={20} />} active={phase === 'download'} />
            <StatCard label="Upload" value={upload} unit="Mbps" icon={<Upload size={20} />} active={phase === 'upload'} />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row justify-center gap-4 pt-4">
          <button
            onClick={startTest}
            disabled={phase !== 'idle' && phase !== 'complete'}
            className="relative group overflow-hidden rounded-full bg-blue-600 px-10 py-4 font-semibold text-white transition-all hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="relative z-10 flex items-center gap-2">
              {phase === 'idle' ? 'Start Test' : phase === 'complete' ? 'Test Again' : 'Testing...'}
            </span>
            {phase === 'idle' || phase === 'complete' ? (
              <div className="absolute inset-0 -z-10 bg-gradient-to-r from-cyan-500 via-blue-500 to-violet-500 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
            ) : null}
          </button>

          {phase === 'complete' && (
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="relative group overflow-hidden rounded-full bg-gray-800 border border-gray-700 px-8 py-4 font-semibold text-white transition-all hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <Share2 size={18} />
              <span>{isSharing ? 'Preparing...' : 'Share Result'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full py-8 border-t border-gray-800/50 text-center text-gray-500 text-sm mt-auto">
        <div className="max-w-4xl mx-auto px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p>&copy; {new Date().getFullYear()} Internet Speedometer. All rights reserved.</p>
          <div className="flex gap-6">
            <a href="#" className="hover:text-gray-300 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-gray-300 transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
