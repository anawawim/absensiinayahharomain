
import Link from 'next/link';
import { Users, UserCheck } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="w-full max-w-4xl text-center">
        <h1 className="text-4xl font-bold mb-4 text-blue-900">
          Aplikasi Absen Inayah Haromain
        </h1>
        <p className="text-gray-600 mb-12 text-lg">
          Silakan pilih metode absensi yang sesuai
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-2xl mx-auto">
          {/* Absen Staff & Crew */}
          <Link 
            href="/staff"
            className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-blue-500 hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-blue-600 transition-colors duration-300">
              <UserCheck className="w-10 h-10 text-blue-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-blue-600">
              Absen Staff & Crew
            </h2>
            <p className="text-gray-500 text-sm">
              Absensi menggunakan pengenalan wajah (Face Recognition)
            </p>
          </Link>

          {/* Absen Jamaah Haji */}
          <Link 
            href="/jamaah"
            className="group relative flex flex-col items-center p-8 bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 hover:border-green-500 hover:-translate-y-1"
          >
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-6 group-hover:bg-green-600 transition-colors duration-300">
              <Users className="w-10 h-10 text-green-600 group-hover:text-white transition-colors duration-300" />
            </div>
            <h2 className="text-2xl font-bold text-gray-800 mb-2 group-hover:text-green-600">
              Absen Jamaah Haji
            </h2>
            <p className="text-gray-500 text-sm">
              Absensi menggunakan Scan QR Code / Barcode
            </p>
          </Link>
        </div>

        <div className="mt-16 text-sm text-gray-400">
          &copy; 2027 Aplikasi Absen Inayah Haromain. All rights reserved.
        </div>
      </div>
    </main>
  );
}
