import Link from 'next/link';
import { QrCode, Scan } from 'lucide-react';

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 bg-gray-50">
      <div className="z-10 max-w-5xl w-full items-center justify-center font-mono text-sm lg:flex mb-12">
        <h1 className="text-4xl font-bold text-center text-blue-800">
          Aplikasi Absen Jamaah Haji 2027
        </h1>
      </div>

      <div className="grid text-center lg:max-w-5xl lg:w-full lg:mb-0 lg:grid-cols-2 lg:text-left gap-8">
        <Link
          href="/generate"
          className="group rounded-lg border border-transparent px-5 py-8 transition-colors hover:border-gray-300 hover:bg-white hover:shadow-lg bg-white shadow-sm flex flex-col items-center justify-center"
        >
          <QrCode className="w-16 h-16 mb-4 text-blue-600" />
          <h2 className={`mb-3 text-2xl font-semibold text-gray-800`}>
            Buat Barcode{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-60 text-gray-600 text-center`}>
            Buat barcode unik untuk setiap jamaah dengan nama masing-masing.
          </p>
        </Link>

        <Link
          href="/scan"
          className="group rounded-lg border border-transparent px-5 py-8 transition-colors hover:border-gray-300 hover:bg-white hover:shadow-lg bg-white shadow-sm flex flex-col items-center justify-center"
        >
          <Scan className="w-16 h-16 mb-4 text-green-600" />
          <h2 className={`mb-3 text-2xl font-semibold text-gray-800`}>
            Scan Absen{' '}
            <span className="inline-block transition-transform group-hover:translate-x-1 motion-reduce:transform-none">
              -&gt;
            </span>
          </h2>
          <p className={`m-0 max-w-[30ch] text-sm opacity-60 text-gray-600 text-center`}>
            Scan barcode untuk mencatat kehadiran secara otomatis ke Spreadsheet.
          </p>
        </Link>
      </div>
    </main>
  );
}
