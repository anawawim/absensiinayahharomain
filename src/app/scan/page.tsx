'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Link from 'next/link';
import { 
  ArrowLeft, 
  CheckCircle, 
  AlertCircle, 
  Loader2, 
  Clock, 
  Scan, 
  Calendar, 
  ExternalLink,
  Keyboard,
  Sparkles,
  ShieldAlert,
  FlipHorizontal
} from 'lucide-react';

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<{ 
    porsi: string; 
    nama: string; 
    kecamatan: string; 
    kabKota: string; 
    timestamp: string;
    minggu?: number;
    pertemuan?: string;
    rekapanUpdated?: boolean;
    rekapanRow?: number | null;
    hadirCount?: number | string;
    absenCount?: number | string;
    totalCount?: number | string;
    rekapanMessage?: string;
  } | null>(null);

  const [rejectedResult, setRejectedResult] = useState<{
    porsi: string;
    nama: string;
    kecamatan?: string;
    kabKota?: string;
    minggu: number;
    pertemuan: string;
    message: string;
    hadirCount?: number | string;
  } | null>(null);

  const [selectedMinggu, setSelectedMinggu] = useState<number>(3);
  const [isMirrored, setIsMirrored] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeData, setTimeData] = useState<{ time: string; date: string }>({ time: '', date: '' });
  const [manualInput, setManualInput] = useState('');
  const [showManual, setShowManual] = useState(false);

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isScanningRef = useRef(false);

  // Inisialisasi minggu dan status mirror dari localStorage jika ada
  useEffect(() => {
    const saved = localStorage.getItem('absen_minggu');
    if (saved) {
      const num = parseInt(saved, 10);
      if (!isNaN(num) && num >= 1 && num <= 24) {
        setSelectedMinggu(num);
      }
    }
    const savedMirror = localStorage.getItem('absen_camera_mirror');
    if (savedMirror !== null) {
      setIsMirrored(savedMirror === 'true');
    }
  }, []);

  const toggleMirror = () => {
    setIsMirrored((prev) => {
      const next = !prev;
      localStorage.setItem('absen_camera_mirror', String(next));
      return next;
    });
  };

  const handleMingguChange = (val: number) => {
    setSelectedMinggu(val);
    localStorage.setItem('absen_minggu', String(val));
    handleReset();
  };

  // Suara konfirmasi sukses (chime dua nada tinggi)
  const playSuccessSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
      osc.frequency.setValueAtTime(880, audioCtx.currentTime + 0.1); // A5
      gain.gain.setValueAtTime(0.18, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.35);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.35);
    } catch {
      // Audio fallback silent
    }
  };

  // Suara tolak absen (buzz dua nada rendah)
  const playRejectSound = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const audioCtx = new AudioCtx();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(220, audioCtx.currentTime); // A3
      osc.frequency.setValueAtTime(164.81, audioCtx.currentTime + 0.12); // E3
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.4);
    } catch {
      // Audio fallback silent
    }
  };

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const dateOptions: Intl.DateTimeFormatOptions = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      };
      const timeOptions: Intl.DateTimeFormatOptions = {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      };
      
      setTimeData({
        date: now.toLocaleDateString('id-ID', dateOptions),
        time: now.toLocaleTimeString('id-ID', timeOptions).replace(/\./g, ':')
      });
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Shortcut keyboard spasi / Enter untuk scan berikutnya
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.code === 'Space' || e.code === 'Enter') && (scanResult || rejectedResult)) {
        if ((e.target as HTMLElement)?.tagName !== 'INPUT') {
          e.preventDefault();
          handleReset();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scanResult, rejectedResult]);

  const processAttendance = async (rawCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          name: rawCode,
          minggu: selectedMinggu 
        }),
      });

      const data = await response.json();

      // Cek apakah tertolak karena sudah pernah absen di minggu tersebut
      if (data.alreadyAttended) {
        playRejectSound();
        setRejectedResult({
          porsi: data.porsi || '-',
          nama: data.nama,
          kecamatan: data.kecamatan,
          kabKota: data.kabKota,
          minggu: data.minggu || selectedMinggu,
          pertemuan: data.pertemuan || `Minggu ${selectedMinggu}`,
          message: data.message || `Jamaah sudah tercatat absen pada Minggu ${selectedMinggu}`,
          hadirCount: data.hadirCount
        });
        setScanResult(null);
        return;
      }

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mencatat kehadiran');
      }

      playSuccessSound();
      setRejectedResult(null);
      setScanResult({
        porsi: data.porsi || '-',
        nama: data.nama,
        kecamatan: data.kecamatan || '-',
        kabKota: data.kabKota || '-',
        timestamp: data.timestamp,
        minggu: data.minggu || selectedMinggu,
        pertemuan: data.pertemuan || `Minggu ${selectedMinggu}`,
        rekapanUpdated: data.rekapanUpdated,
        rekapanRow: data.rekapanRow,
        hadirCount: data.hadirCount ?? 1,
        absenCount: data.absenCount ?? 23,
        totalCount: data.totalCount ?? 24,
        rekapanMessage: data.rekapanMessage
      });
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan sistem');
    } finally {
      setIsLoading(false);
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processAttendance(manualInput.trim());
    setManualInput('');
  };

  useEffect(() => {
    // Hindari inisialisasi ganda pada React Strict Mode atau saat menampilkan hasil
    if (isScanningRef.current || scanResult || rejectedResult) return;

    const onScanSuccess = async (decodedText: string) => {
      if (scannerRef.current) {
        try {
          await scannerRef.current.clear();
          isScanningRef.current = false;
        } catch (e) {
          console.error("Failed to clear scanner", e);
        }
      }

      await processAttendance(decodedText);
    };

    const onScanFailure = () => {
      // Ignored for smoother UX
    };

    const timerId = setTimeout(() => {
      const readerElement = document.getElementById('reader');
      if (readerElement) {
        readerElement.innerHTML = "";
      }

      if (scannerRef.current) {
        try {
          scannerRef.current.clear();
        } catch (e) {
          console.warn("Pre-init cleanup error:", e);
        }
        scannerRef.current = null;
      }

      const scanner = new Html5QrcodeScanner(
        "reader",
        { 
          fps: 15, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          videoConstraints: {
            facingMode: { ideal: "environment" }
          }
        },
        false
      );
      
      scannerRef.current = scanner;
      isScanningRef.current = true;
      
      scanner.render(onScanSuccess, onScanFailure);
    }, 100);

    return () => {
      clearTimeout(timerId);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          console.warn("Scanner clear error:", error);
        });
        scannerRef.current = null;
        isScanningRef.current = false;
      }
    };
  }, [scanResult, rejectedResult, selectedMinggu]);

  const handleReset = () => {
    setScanResult(null);
    setRejectedResult(null);
    setError(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/40 to-slate-100 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <Link 
            href="/" 
            className="inline-flex items-center text-slate-600 hover:text-blue-600 hover:bg-white/80 px-4 py-2 rounded-full transition-all group backdrop-blur-sm shadow-sm border border-slate-200/60"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Kembali ke Dashboard</span>
          </Link>

          <a 
            href="https://docs.google.com/spreadsheets/d/1c3nnEaJRg0utvtdztkP6dOpCxC_dGaXL4T05UtdCFfI/edit?gid=1314218965#gid=1314218965"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center text-xs font-semibold text-blue-700 bg-blue-100/70 hover:bg-blue-200/80 px-3.5 py-1.5 rounded-full transition-colors border border-blue-200"
          >
            <span>Buka Google Sheet</span>
            <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
          </a>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up">
          {/* Header Card */}
          <div className="bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
              <Scan className="w-36 h-36" />
            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10 mb-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold flex items-center gap-3 tracking-tight">
                  <Scan className="w-8 h-8 text-blue-200" />
                  Scan Barcode Jamaah
                </h1>
                <p className="mt-1.5 text-blue-100 text-sm sm:text-base">
                  Absensi otomatis masuk ke sheet <strong>Jamaah Haji</strong> & terceklis di <strong>Rekapan</strong>.
                </p>
              </div>

              {/* Jam Realtime */}
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[190px] text-center shadow-inner">
                <div className="flex items-center justify-center gap-1.5 text-blue-100 text-xs font-medium mb-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>{timeData.date}</span>
                </div>
                <div className="text-2xl sm:text-3xl font-bold tabular-nums tracking-tight text-white">
                  {timeData.time}
                </div>
              </div>
            </div>

            {/* Pilihan Pertemuan / Minggu Ke */}
            <div className="bg-white/15 backdrop-blur-md border border-white/25 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-white/20 rounded-xl">
                  <Calendar className="w-5 h-5 text-white" />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wider text-blue-200 font-semibold">Sesi Pertemuan Aktif</p>
                  <p className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                    Minggu ke-{selectedMinggu}
                    <span className="inline-block w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5">
                <label htmlFor="select-minggu" className="text-xs text-blue-100 font-medium hidden sm:inline">
                  Ganti Minggu:
                </label>
                <div className="relative">
                  <select
                    id="select-minggu"
                    value={selectedMinggu}
                    onChange={(e) => handleMingguChange(parseInt(e.target.value, 10))}
                    className="bg-white text-blue-900 font-bold text-sm sm:text-base px-4 py-2.5 rounded-xl border-2 border-white/80 shadow-md cursor-pointer hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-300 transition-all appearance-none pr-9"
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((m) => (
                      <option key={m} value={m}>
                        Minggu {m}
                      </option>
                    ))}
                  </select>
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-blue-900 font-bold text-xs">
                    ▼
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Scanner Container */}
            {!scanResult && !rejectedResult && !isLoading && !error && (
              <div className="space-y-4">
                <div className="overflow-hidden rounded-2xl border-4 border-slate-100 bg-slate-50 shadow-inner">
                  <style dangerouslySetInnerHTML={{__html: `
                    #reader video {
                      transform: ${isMirrored ? 'scaleX(-1)' : 'none'} !important;
                      border-radius: 12px;
                      object-fit: cover;
                    }
                    #reader button, 
                    #reader #html5-qrcode-anchor-scan-type-change {
                      display: inline-block !important;
                      padding: 12px 24px;
                      margin: 10px 5px;
                      border-radius: 12px;
                      border: none;
                      font-size: 14px;
                      font-weight: 600;
                      cursor: pointer;
                      transition: all 0.2s;
                      background-color: #2563eb;
                      color: white !important;
                      text-decoration: none !important;
                      box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);
                    }
                    #reader button:active, 
                    #reader #html5-qrcode-anchor-scan-type-change:active {
                      transform: scale(0.95);
                    }
                    #reader #html5-qrcode-button-camera-stop {
                      background-color: #ef4444 !important;
                      box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.2);
                    }
                    #reader #html5-qrcode-button-camera-stop:hover {
                      background-color: #dc2626 !important;
                    }
                    #reader select {
                      padding: 10px 16px;
                      border-radius: 12px;
                      border: 1px solid #e2e8f0;
                      margin-bottom: 16px;
                      width: 100%;
                      max-width: 300px;
                      font-size: 14px;
                      background-color: white;
                      color: #475569;
                    }
                  `}} />
                  <div id="reader" className="w-full"></div>
                  <div className="bg-white p-3.5 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 px-4">
                    <p className="text-xs sm:text-sm font-medium text-slate-600 flex items-center gap-1.5">
                      <Scan className="w-4 h-4 text-blue-600 shrink-0" />
                      Arahkan kamera ke Barcode / QR Code
                    </p>

                    <button
                      type="button"
                      onClick={toggleMirror}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg border transition-all ${
                        isMirrored
                          ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                          : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                      }`}
                      title="Klik untuk membalik/mirror orientasi kamera"
                    >
                      <FlipHorizontal className="w-3.5 h-3.5" />
                      <span>Mirror: {isMirrored ? 'Aktif' : 'Mati (Normal)'}</span>
                    </button>
                  </div>
                </div>

                {/* Input Manual / Barcode Scanner Gun Toggle */}
                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => setShowManual(!showManual)}
                    className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600 font-medium py-1.5 px-3 rounded-lg hover:bg-slate-100 transition-colors"
                  >
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>{showManual ? 'Tutup Input Manual' : 'Input Manual / Barcode Scanner Gun'}</span>
                  </button>

                  {showManual && (
                    <form onSubmit={handleManualSubmit} className="mt-3 p-4 bg-slate-50 rounded-2xl border border-slate-200 flex gap-2">
                      <input
                        type="text"
                        value={manualInput}
                        onChange={(e) => setManualInput(e.target.value)}
                        placeholder="Contoh: 2800181268 atau MUKTI ALI BUCHORI YUNUS"
                        className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                        autoFocus
                      />
                      <button
                        type="submit"
                        className="bg-blue-600 text-white font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors shadow-sm"
                      >
                        Absen
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 bg-slate-50 rounded-2xl border border-slate-100">
                <Loader2 className="w-14 h-14 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-800 font-bold text-lg">Mencatat Kehadiran...</p>
                <p className="text-slate-500 text-sm mt-1">
                  Sinkronisasi cepat ke sheet <em>Jamaah Haji</em> & sheet <em>Rekapan</em>
                </p>
              </div>
            )}

            {/* REJECTED / ALREADY ATTENDED STATE */}
            {rejectedResult && (
              <div className="flex flex-col items-center justify-center py-4 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-3 shadow-sm border-2 border-rose-200">
                  <ShieldAlert className="w-10 h-10" />
                </div>
                
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-100 text-rose-800 text-xs font-bold uppercase tracking-wider mb-2">
                  <span className="w-2 h-2 rounded-full bg-rose-600"></span>
                  Absen Ditolak (Sudah Hadir)
                </div>

                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight text-center">
                  Jamaah Sudah Absen!
                </h2>
                <p className="text-rose-600 font-semibold text-sm sm:text-base mt-1 text-center max-w-md">
                  {rejectedResult.nama} sudah tercatat hadir pada <strong>{rejectedResult.pertemuan}</strong>.
                </p>

                {/* Detail Jamaah Card */}
                <div className="bg-rose-50/60 p-6 rounded-2xl w-full text-center border-2 border-rose-200 shadow-sm mt-5 max-w-lg">
                  <div className="grid grid-cols-2 gap-4 text-left mb-4 pb-4 border-b border-rose-200/60">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">No. Porsi</p>
                      <p className="text-base sm:text-lg font-bold text-slate-800 font-mono">{rejectedResult.porsi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Sesi Pertemuan</p>
                      <p className="text-sm sm:text-base font-bold text-rose-700">{rejectedResult.pertemuan}</p>
                    </div>
                  </div>
                  
                  <div className="text-left">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Nama Jamaah</p>
                    <p className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-3">{rejectedResult.nama}</p>
                    
                    <div className="bg-white p-3.5 rounded-xl border border-rose-200 text-xs sm:text-sm text-slate-700 flex items-center justify-between">
                      <span className="font-medium text-slate-600">Total Hadir Terkumpul:</span>
                      <span className="font-extrabold text-rose-800 text-base">{rejectedResult.hadirCount ?? '-'} Pertemuan</span>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg mt-6">
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-slate-900 hover:bg-black text-white py-3.5 px-6 rounded-xl transition-all shadow-lg font-bold active:scale-[0.98] flex items-center justify-center gap-2"
                    autoFocus
                  >
                    <Scan className="w-5 h-5" />
                    <span>Scan Jamaah Berikutnya</span>
                  </button>

                  <a
                    href="https://docs.google.com/spreadsheets/d/1c3nnEaJRg0utvtdztkP6dOpCxC_dGaXL4T05UtdCFfI/edit?gid=1314218965#gid=1314218965"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 py-3.5 px-5 rounded-xl transition-all font-semibold flex items-center justify-center gap-2 text-sm"
                  >
                    <span>Cek Rekapan</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Success State */}
            {scanResult && (
              <div className="flex flex-col items-center justify-center py-4 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-4 shadow-sm border-2 border-emerald-200">
                  <CheckCircle className="w-10 h-10" />
                </div>
                
                <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-800 tracking-tight">
                  Absensi Berhasil Dicatat!
                </h2>
                <p className="text-emerald-700 font-semibold text-sm mt-1 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4" />
                  Tercatat untuk {scanResult.pertemuan}
                </p>

                {/* Status Centang Rekapan */}
                <div className="mt-4 w-full max-w-lg">
                  {scanResult.rekapanUpdated ? (
                    <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 p-4 rounded-2xl flex items-center justify-between gap-4 shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-sm">
                          ✓
                        </div>
                        <div>
                          <p className="text-xs uppercase font-bold text-emerald-700 tracking-wider">Sheet Rekapan</p>
                          <p className="text-sm font-semibold text-emerald-900">
                            Minggu ke-{scanResult.minggu} Otomatis Tercentang
                          </p>
                        </div>
                      </div>
                      <div className="text-right border-l border-emerald-200 pl-4">
                        <p className="text-xs text-emerald-700 font-medium">Total Hadir</p>
                        <p className="text-xl font-extrabold text-emerald-800 tabular-nums">
                          {scanResult.hadirCount} <span className="text-xs font-normal text-emerald-600">/ 24</span>
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-amber-50 border border-amber-200 text-amber-900 p-4 rounded-2xl flex items-center gap-3 text-sm">
                      <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                      <div>
                        <p className="font-semibold">Log Sheet Jamaah Haji Tersimpan</p>
                        <p className="text-xs text-amber-700">
                          {scanResult.rekapanMessage || 'Jamaah belum ditemukan di tabel Rekapan.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Detail Jamaah Card */}
                <div className="bg-slate-50 p-6 rounded-2xl w-full text-center border border-slate-200 shadow-sm mt-4 max-w-lg">
                  <div className="grid grid-cols-2 gap-4 text-left mb-5">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">No. Porsi</p>
                      <p className="text-base sm:text-lg font-bold text-slate-800 font-mono">{scanResult.porsi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Waktu Scan</p>
                      <p className="text-xs sm:text-sm font-medium text-slate-700">{scanResult.timestamp}</p>
                    </div>
                  </div>
                  
                  <div className="text-left border-t border-slate-200 pt-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1 font-semibold">Nama Jamaah</p>
                    <p className="text-xl sm:text-2xl font-extrabold text-blue-900 mb-4">{scanResult.nama}</p>
                    
                    <div className="flex flex-col gap-1.5 text-sm text-slate-600 bg-white p-3.5 rounded-xl border border-slate-200/80">
                      <p><span className="font-semibold text-slate-700">Kecamatan:</span> {scanResult.kecamatan}</p>
                      <p><span className="font-semibold text-slate-700">Kab/Kota:</span> {scanResult.kabKota}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 w-full max-w-lg mt-6">
                  <button
                    onClick={handleReset}
                    className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 text-white py-3.5 px-6 rounded-xl hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg shadow-blue-500/20 font-bold active:scale-[0.98] flex items-center justify-center gap-2"
                  >
                    <Scan className="w-5 h-5" />
                    <span>Scan Jamaah Berikutnya</span>
                  </button>

                  <a
                    href="https://docs.google.com/spreadsheets/d/1c3nnEaJRg0utvtdztkP6dOpCxC_dGaXL4T05UtdCFfI/edit?gid=1314218965#gid=1314218965"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="bg-white border-2 border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-blue-600 py-3.5 px-5 rounded-xl transition-all font-semibold flex items-center justify-center gap-2 text-sm"
                  >
                    <span>Cek Sheet</span>
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6 shadow-sm border-2 border-red-200">
                  <AlertCircle className="w-10 h-10" />
                </div>
                <h2 className="text-2xl font-bold text-red-700 mb-2">Gagal Absen</h2>
                <p className="text-slate-600 text-center mb-8 max-w-md bg-red-50 p-4 rounded-xl border border-red-200 text-sm">
                  {error}
                </p>
                
                <button
                  onClick={handleReset}
                  className="w-full max-w-xs bg-slate-800 text-white py-3.5 px-6 rounded-xl hover:bg-slate-900 transition-all shadow-lg font-bold active:scale-[0.98]"
                >
                  Coba Lagi
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
