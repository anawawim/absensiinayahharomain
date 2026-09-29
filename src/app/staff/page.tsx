
import Link from 'next/link';
import { UserPlus, ScanFace, ArrowLeft } from 'lucide-react';

export default function StaffPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl">
        <div className="mb-8">
          <Link href="/" className="flex items-center text-blue-600 hover:underline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Kembali ke Menu Utama
          </Link>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-4 text-blue-900">
            Menu Staff & Crew
          </h1>
          <p className="text-gray-600">
            Pilih menu pendaftaran atau absensi
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Daftar Wajah */}
          <Link 
            href="/staff/register"
            className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-purple-500 hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-purple-600 transition-colors duration-300">
              <UserPlus className="w-10 h-10 text-purple-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-purple-600">
              Daftar Wajah
            </h2>
            <p className="text-gray-500 text-sm text-center">
              Registrasi wajah baru untuk Staff atau Crew
            </p>
          </Link>

          {/* Absen Wajah */}
          <Link 
            href="/staff/scan"
            className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-500 hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
              <ScanFace className="w-10 h-10 text-blue-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600">
              Absen Wajah
            </h2>
            <p className="text-gray-500 text-sm text-center">
              Lakukan absensi menggunakan pengenalan wajah
            </p>
          </Link>
        </div>
      </div>
    </main>
  );
}
