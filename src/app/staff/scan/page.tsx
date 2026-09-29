
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as faceapi from 'face-api.js';
import { ArrowLeft, MapPin, ScanFace, Loader2, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function ScanStaffPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detection, setDetection] = useState<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null>(null);
  const [error, setError] = useState('');
  const [successData, setSuccessData] = useState<any>(null);
  const [location, setLocation] = useState<{lat: number, lng: number} | null>(null);
  const [timeData, setTimeData] = useState<{ time: string; date: string }>({ time: '', date: '' });

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
    const timer = setInterval(updateTime, 1000);

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        // Check if models are already loaded to prevent reload lag
        if (!faceapi.nets.ssdMobilenetv1.params) {
            await Promise.all([
              faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
              faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
              faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
            ]);
        }
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Failed to load models:", err);
        setError("Gagal memuat model AI. Pastikan folder '/models' ada di public directory.");
      }
    };
    loadModels();
    
    // Get Location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (err) => {
          console.error("Geolocation error:", err);
          setError("Gagal mendapatkan lokasi. Pastikan GPS aktif.");
        }
      );
    } else {
      setError("Browser tidak mendukung Geolocation.");
    }
  }, []);

  useEffect(() => {
    if (isModelLoaded) {
      startVideo();
    }
  }, [isModelLoaded]);

  const startVideo = () => {
    navigator.mediaDevices
      .getUserMedia({ video: {} })
      .then((stream) => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      })
      .catch((err) => {
        console.error("Camera error:", err);
        setError("Gagal mengakses kamera");
      });
  };

  const handleVideoPlay = () => {
    setIsVideoReady(true);
    
    const detectFrame = async () => {
      if (videoRef.current && canvasRef.current && !isProcessing && !successData && !videoRef.current.paused && !videoRef.current.ended) {
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };
        
        faceapi.matchDimensions(canvasRef.current, displaySize);

        // Use stricter detection confidence (0.8) to ensure high quality face capture
        const options = new faceapi.SsdMobilenetv1Options({ minConfidence: 0.8 });
        
        try {
            const detections = await faceapi.detectAllFaces(videoRef.current, options)
            .withFaceLandmarks()
            .withFaceDescriptors();

            const resizedDetections = faceapi.resizeResults(detections, displaySize);
            
            if (canvasRef.current) {
                const context = canvasRef.current.getContext('2d');
                if (context) {
                    context.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
                    faceapi.draw.drawDetections(canvasRef.current, resizedDetections);
                }
            }

            if (detections.length > 0) {
            setDetection(detections[0]);
            } else {
            setDetection(null);
            }
        } catch (e) {
            // Handle detection errors silently to prevent loop crash
            console.error("Detection error", e);
        }
      }
      
      // Schedule next frame
      if (!successData) {
          requestAnimationFrame(detectFrame);
      }
    };

    detectFrame();
  };

  const handleScan = async () => {
    if (!detection) return;
    if (!location) {
      setError("Menunggu lokasi GPS...");
      return;
    }

    setIsProcessing(true);
    setError('');

    try {
      const descriptorArray = Array.from(detection.descriptor);
      
      // Capture image from video
      let imageBase64 = '';
      if (videoRef.current) {
        const captureCanvas = document.createElement('canvas');
        captureCanvas.width = videoRef.current.videoWidth;
        captureCanvas.height = videoRef.current.videoHeight;
        const ctx = captureCanvas.getContext('2d');
        if (ctx) {
          // Flip horizontally to match the preview
          ctx.translate(captureCanvas.width, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(videoRef.current, 0, 0);
          imageBase64 = captureCanvas.toDataURL('image/jpeg', 0.8);
        }
      }

      const response = await fetch('/api/staff/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          faceDescriptor: descriptorArray,
          latitude: location.lat,
          longitude: location.lng,
          image: imageBase64 // Send captured image
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal melakukan absensi');
      }

      setSuccessData(data);
      
      // Auto-reset after 5 seconds to allow next person
      setTimeout(() => {
        setSuccessData(null);
        setIsProcessing(false);
      }, 5000);
      
    } catch (err: any) {
      setError(err.message);
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <Link 
          href="/staff" 
          className="inline-flex items-center text-slate-600 hover:text-blue-600 hover:bg-white/50 px-4 py-2 rounded-full transition-all mb-6 group"
        >
          <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
          <span className="font-medium">Kembali ke Menu Staff</span>
        </Link>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-blue-600 p-6 sm:p-8 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <ScanFace className="w-32 h-32" />
            </div>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 relative z-10">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-3">
                  <ScanFace className="w-8 h-8" />
                  Absensi Wajah Staff
                </h1>
                <p className="mt-2 text-blue-100">
                  Scan wajah untuk melakukan absensi kehadiran.
                </p>
              </div>

              {/* Real-time Clock Card */}
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

          <div className="p-6 sm:p-8 space-y-8">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            
            {successData && (
              <div className="bg-green-50 text-green-700 p-6 rounded-xl border border-green-200 flex items-start gap-4 animate-in fade-in slide-in-from-top-2 shadow-sm">
                <CheckCircle2 className="w-8 h-8 flex-shrink-0 text-green-600" />
                <div>
                  <h3 className="text-lg font-bold text-green-800">Absensi Berhasil!</h3>
                  <div className="mt-2 space-y-1 text-green-700">
                    <p>Nama: <span className="font-semibold">{successData.name}</span></p>
                    <p>Status: <span className="font-semibold">{successData.status}</span></p>
                    <p>Waktu: {new Date().toLocaleTimeString('id-ID')}</p>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Camera Section */}
              <div className="space-y-4">
                <div className={`relative rounded-2xl overflow-hidden bg-black aspect-video shadow-inner transition-all duration-500 ring-4 ${detection ? 'ring-green-400/50 shadow-green-400/20' : 'ring-slate-200 shadow-slate-200/20'}`}>
                  {!isModelLoaded && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-white bg-slate-900/90 backdrop-blur-sm z-20 transition-opacity duration-700">
                      <Loader2 className="w-10 h-10 animate-spin mb-3 text-blue-400" />
                      <p className="font-medium animate-pulse">Memuat Model AI...</p>
                    </div>
                  )}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    onPlay={handleVideoPlay}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                  <canvas
                    ref={canvasRef}
                    className="absolute inset-0 w-full h-full"
                    style={{ transform: 'scaleX(-1)' }}
                  />
                </div>
                
                {/* Location Status */}
                <div className={`flex items-center gap-3 p-3 rounded-xl border ${location ? 'bg-blue-50 border-blue-100 text-blue-700' : 'bg-amber-50 border-amber-100 text-amber-700'}`}>
                  <MapPin className={`w-5 h-5 ${location ? 'text-blue-600' : 'text-amber-500 animate-pulse'}`} />
                  <div className="flex-1">
                    <p className="text-sm font-semibold">{location ? 'Lokasi Terdeteksi' : 'Mencari Lokasi GPS...'}</p>
                    {location && <p className="text-xs opacity-80">{location.lat.toFixed(6)}, {location.lng.toFixed(6)}</p>}
                  </div>
                </div>
              </div>

              {/* Instructions & Action */}
              <div className="flex flex-col justify-center space-y-6">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
                    <ScanFace className="w-5 h-5 text-blue-500" />
                    Panduan Absensi
                  </h3>
                  <ul className="space-y-3">
                    {[
                      'Pastikan pencahayaan cukup terang',
                      'Lepas masker atau kacamata hitam',
                      'Posisikan wajah di dalam kotak hijau',
                      'Pastikan GPS aktif untuk validasi lokasi'
                    ].map((item, idx) => (
                      <li key={idx} className="flex items-start gap-3 text-sm text-slate-600">
                        <div className="w-6 h-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center flex-shrink-0 text-xs font-bold">
                          {idx + 1}
                        </div>
                        <span className="mt-0.5">{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handleScan}
                  disabled={isProcessing || !isModelLoaded || !detection || !location}
                  className={`w-full py-4 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    isProcessing || !isModelLoaded || !detection || !location
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 active:scale-[0.98]'
                  }`}
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Memproses...
                    </>
                  ) : (
                    <>
                      <ScanFace className="w-5 h-5" />
                      Lakukan Absensi
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
