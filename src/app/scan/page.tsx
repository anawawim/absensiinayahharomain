'use client';

import { useState, useEffect, useRef } from 'react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, AlertCircle, Loader2, Clock, Scan } from 'lucide-react';

export default function ScanPage() {
  const [scanResult, setScanResult] = useState<{ 
    porsi: string; 
    nama: string; 
    kecamatan: string; 
    kabKota: string; 
    timestamp: string 
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [timeData, setTimeData] = useState<{ time: string; date: string }>({ time: '', date: '' });
  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const isScanningRef = useRef(false);

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

  useEffect(() => {
    // Hindari inisialisasi ganda pada React Strict Mode
    if (isScanningRef.current || scanResult) return;

    const onScanSuccess = async (decodedText: string, decodedResult: any) => {
      // Hentikan scanning sementara
      if (scannerRef.current) {
        try {
          await scannerRef.current.clear();
          isScanningRef.current = false;
        } catch (e) {
          console.error("Failed to clear scanner", e);
        }
      }

      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/attendance', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ name: decodedText }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Gagal mencatat kehadiran');
        }

        setScanResult({
          porsi: data.porsi || '-',
          nama: data.nama,
          kecamatan: data.kecamatan || '-',
          kabKota: data.kabKota || '-',
          timestamp: data.timestamp
        });
      } catch (err: any) {
        setError(err.message);
        // Jika error, kita mungkin ingin membiarkan user mencoba lagi secara manual
      } finally {
        setIsLoading(false);
      }
    };

    const onScanFailure = (error: any) => {
      // Ignored for better UX, otherwise it spams console
    };

    // Inisialisasi Scanner dengan delay untuk menangani React Strict Mode
    const timerId = setTimeout(() => {
      // Bersihkan container terlebih dahulu untuk mencegah duplikasi UI (fix double camera bug)
      const readerElement = document.getElementById('reader');
      if (readerElement) {
        readerElement.innerHTML = "";
      }

      // Pastikan scanner sebelumnya sudah dibersihkan
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
          fps: 10, 
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1.0,
          disableFlip: true
        },
        false
      );
      
      scannerRef.current = scanner;
      isScanningRef.current = true;
      
      scanner.render(onScanSuccess, onScanFailure);
    }, 100);

    // Cleanup function
    return () => {
      clearTimeout(timerId);
      if (scannerRef.current) {
        scannerRef.current.clear().catch(error => {
          // Ignore clear errors
          console.warn("Scanner clear error:", error);
        });
        scannerRef.current = null;
        isScanningRef.current = false;
      }
    };
  }, [scanResult]);

  const handleReset = () => {
    setScanResult(null);
    setError(null);
    // State change will trigger useEffect to restart scanner
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Link 
            href="/" 
            className="inline-flex items-center text-slate-600 hover:text-blue-600 hover:bg-white/50 px-4 py-2 rounded-full transition-all group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Kembali ke Dashboard</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <div className="bg-blue-600 p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Scan className="w-32 h-32" />
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <Scan className="w-8 h-8" />
                  Scan Absen
                </h1>
                <p className="mt-2 text-blue-100">
                  Scan barcode jamaah untuk mencatat kehadiran.
                </p>
              </div>
              <div className="bg-white/10 backdrop-blur-md border border-white/20 rounded-2xl p-4 min-w-[200px] text-center">
                <div className="flex items-center justify-center gap-2 text-blue-100 text-sm font-medium mb-1">
                  <Clock className="w-4 h-4" />
                  <span>{timeData.date}</span>
                </div>
                <div className="text-3xl font-bold tabular-nums tracking-tight text-white">
                  {timeData.time}
                </div>
              </div>
            </div>
          </div>

          <div className="p-6 sm:p-8">
            {/* Scanner Container */}
            {!scanResult && !isLoading && !error && (
              <div className="overflow-hidden rounded-2xl border-4 border-slate-100 bg-slate-50 shadow-inner">
                <style dangerouslySetInnerHTML={{__html: `
                  #reader video {
                    transform: scaleX(-1) !important;
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
                <div className="bg-white p-4 text-center border-t border-slate-200">
                  <p className="text-sm font-medium text-slate-500 flex items-center justify-center gap-2">
                    <Scan className="w-4 h-4" />
                    Arahkan kamera ke Barcode / QR Code
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-12 bg-slate-50 rounded-2xl border border-slate-100">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-slate-600 font-medium">Sedang memproses kehadiran...</p>
              </div>
            )}

            {/* Success State */}
            {scanResult && (
              <div className="flex flex-col items-center justify-center py-8 animate-in fade-in zoom-in duration-300">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <CheckCircle className="w-10 h-10 text-green-600" />
                </div>
                <h2 className="text-2xl font-bold text-green-700 mb-2">Berhasil Absen!</h2>
                <div className="bg-slate-50 p-6 rounded-2xl w-full text-center border border-slate-200 shadow-sm mt-4 max-w-lg">
                  <div className="grid grid-cols-2 gap-4 text-left mb-6">
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">No. Porsi</p>
                      <p className="text-lg font-bold text-slate-800">{scanResult.porsi}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Waktu Scan</p>
                      <p className="text-lg font-bold text-slate-800">{scanResult.timestamp}</p>
                    </div>
                  </div>
                  
                  <div className="text-left border-t border-slate-200 pt-4">
                    <p className="text-xs text-slate-500 uppercase tracking-wider mb-1">Nama Jamaah</p>
                    <p className="text-2xl font-bold text-blue-900 mb-4">{scanResult.nama}</p>
                    
                    <div className="flex flex-col gap-1 text-sm text-slate-600 bg-white p-3 rounded-xl border border-slate-100">
                      <p><span className="font-semibold">Kecamatan:</span> {scanResult.kecamatan}</p>
                      <p><span className="font-semibold">Kab/Kota:</span> {scanResult.kabKota}</p>
                    </div>
                  </div>
                </div>
                
                <button
                  onClick={handleReset}
                  className="mt-8 w-full max-w-lg bg-blue-600 text-white py-4 px-6 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 font-bold active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Scan className="w-5 h-5" />
                  Scan Berikutnya
                </button>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mb-6 shadow-sm">
                  <AlertCircle className="w-10 h-10 text-red-600" />
                </div>
                <h2 className="text-2xl font-bold text-red-700 mb-2">Gagal Absen</h2>
                <p className="text-slate-600 text-center mb-8 max-w-md">{error}</p>
                
                <button
                  onClick={handleReset}
                  className="w-full max-w-xs bg-slate-800 text-white py-3 px-6 rounded-xl hover:bg-slate-900 transition-all shadow-lg font-bold active:scale-[0.98]"
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
