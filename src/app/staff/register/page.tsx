
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import * as faceapi from 'face-api.js';
import { ArrowLeft, UserPlus, Loader2, Camera, User, UserCheck, CheckCircle, AlertCircle } from 'lucide-react';
import Link from 'next/link';

export default function RegisterStaffPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [name, setName] = useState('');
  const [status, setStatus] = useState<'Staff' | 'Crew'>('Staff');
  const [isModelLoaded, setIsModelLoaded] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [detection, setDetection] = useState<faceapi.WithFaceDescriptor<faceapi.WithFaceLandmarks<{ detection: faceapi.FaceDetection }>> | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = '/models';
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ]);
        setIsModelLoaded(true);
      } catch (err) {
        console.error("Failed to load models:", err);
        setError("Gagal memuat model AI. Pastikan folder '/models' ada di public directory.");
      }
    };
    loadModels();
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
      if (videoRef.current && canvasRef.current && !isProcessing && !videoRef.current.paused && !videoRef.current.ended) {
        const displaySize = {
          width: videoRef.current.videoWidth,
          height: videoRef.current.videoHeight
        };
        
        faceapi.matchDimensions(canvasRef.current, displaySize);

        // Use stricter detection confidence (0.8) for registration to ensure high quality reference
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
            // Use the first detected face
            setDetection(detections[0]);
            } else {
            setDetection(null);
            }
        } catch (e) {
             console.error("Detection error", e);
        }
      }
      
      requestAnimationFrame(detectFrame);
    };

    detectFrame();
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detection) {
      setError("Wajah tidak terdeteksi. Pastikan wajah terlihat jelas di kamera.");
      return;
    }
    if (!name.trim()) {
      setError("Nama wajib diisi.");
      return;
    }

    setIsProcessing(true);
    setError('');
    setSuccess('');

    try {
      const descriptorArray = Array.from(detection.descriptor);
      
      const response = await fetch('/api/staff/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          status,
          faceDescriptor: descriptorArray
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Gagal mendaftar');
      }

      setSuccess(`Berhasil mendaftarkan ${name} sebagai ${status}`);
      setName('');
      // Optional: Redirect after success
      setTimeout(() => router.push('/staff'), 2000);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
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
              <UserPlus className="w-32 h-32" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold relative z-10 flex items-center gap-3">
              <UserPlus className="w-8 h-8" />
              Pendaftaran Wajah Staff
            </h1>
            <p className="mt-2 text-blue-100 relative z-10">
              Daftarkan wajah Staff atau Crew baru untuk sistem absensi.
            </p>
          </div>

          <div className="p-6 sm:p-8 space-y-8">
            {error && (
              <div className="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{error}</p>
              </div>
            )}
            
            {success && (
              <div className="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 flex items-start gap-3 animate-in fade-in slide-in-from-top-2">
                <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <p>{success}</p>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Camera Section */}
              <div className="space-y-4">
                <div className={`relative rounded-2xl overflow-hidden bg-black aspect-square shadow-inner transition-all duration-500 ring-4 ${detection ? 'ring-green-400/50 shadow-green-400/20' : 'ring-slate-200 shadow-slate-200/20'}`}>
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
                <div className="flex items-center gap-2 text-sm text-slate-500 bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <Camera className="w-4 h-4 text-blue-500" />
                  <p>Pastikan wajah terlihat jelas dan berada di tengah kotak.</p>
                </div>
              </div>

              {/* Form Section */}
              <form onSubmit={handleRegister} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <User className="w-4 h-4 text-blue-500" />
                    Nama Lengkap
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <User className="h-5 w-5 text-slate-400" />
                    </div>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-11 pr-4 py-3.5 rounded-xl border border-slate-200 bg-slate-50 focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all outline-none text-slate-900 font-medium placeholder:text-slate-400"
                      placeholder="Masukkan nama lengkap..."
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-blue-500" />
                    Status Kepegawaian
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <button
                      type="button"
                      onClick={() => setStatus('Staff')}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all group overflow-hidden ${
                        status === 'Staff'
                          ? 'border-blue-600 bg-blue-50/50 text-blue-700 shadow-sm'
                          : 'border-slate-200 hover:border-blue-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-2 relative z-10">
                        <UserCheck className={`w-6 h-6 ${status === 'Staff' ? 'text-blue-600' : 'text-slate-400 group-hover:text-blue-500'}`} />
                        <div>
                          <span className="block font-bold">Staff</span>
                          <span className="text-xs opacity-80">Pegawai Tetap</span>
                        </div>
                      </div>
                      {status === 'Staff' && (
                        <div className="absolute right-3 top-3">
                          <CheckCircle className="w-5 h-5 text-blue-600" />
                        </div>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setStatus('Crew')}
                      className={`relative p-4 rounded-xl border-2 text-left transition-all group overflow-hidden ${
                        status === 'Crew'
                          ? 'border-purple-500 bg-purple-50/50 text-purple-700 shadow-sm'
                          : 'border-slate-200 hover:border-purple-300 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex flex-col gap-2 relative z-10">
                        <UserCheck className={`w-6 h-6 ${status === 'Crew' ? 'text-purple-500' : 'text-slate-400 group-hover:text-purple-400'}`} />
                        <div>
                          <span className="block font-bold">Crew</span>
                          <span className="text-xs opacity-80">Tim Lapangan</span>
                        </div>
                      </div>
                      {status === 'Crew' && (
                        <div className="absolute right-3 top-3">
                          <CheckCircle className="w-5 h-5 text-purple-500" />
                        </div>
                      )}
                    </button>
                  </div>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!isModelLoaded || !detection || isProcessing || !name.trim()}
                    className={`w-full py-4 px-6 rounded-xl text-white font-bold text-lg transition-all shadow-lg transform active:scale-[0.98] flex items-center justify-center gap-2
                      ${(!isModelLoaded || !detection || isProcessing || !name.trim())
                        ? 'bg-slate-300 cursor-not-allowed shadow-none'
                        : 'bg-blue-600 hover:bg-blue-700 hover:shadow-blue-500/30 hover:-translate-y-0.5'
                      }`}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-6 h-6 animate-spin" />
                        <span>Sedang Mendaftarkan...</span>
                      </>
                    ) : (
                      <>
                        <Camera className="w-6 h-6" />
                        <span>Daftarkan Sekarang</span>
                      </>
                    )}
                  </button>
                  
                  <div className="mt-3 text-center text-xs text-slate-400">
                    {!name.trim() && <span>• Masukkan nama lengkap</span>}
                    {!detection && <span> • Tunggu wajah terdeteksi</span>}
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
