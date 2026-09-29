'use client';

import { useState, useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import Link from 'next/link';
import { ArrowLeft, Printer, FileDown, Upload, FileSpreadsheet } from 'lucide-react';
import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import QRCode from 'qrcode';

interface JamaahData {
  porsi: string;
  nama: string;
  kecamatan: string;
  kabKota: string;
}

export default function GeneratePage() {
  const [name, setName] = useState('');
  const [porsi, setPorsi] = useState('');
  const [kecamatan, setKecamatan] = useState('');
  const [kabKota, setKabKota] = useState('');
  const [generatedData, setGeneratedData] = useState<JamaahData | null>(null);
  const [importedData, setImportedData] = useState<JamaahData[]>([]);
  const qrRef = useRef<HTMLCanvasElement | null>(null);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      // Manual input dengan data lengkap
      setGeneratedData({
        porsi: porsi.trim() || '-',
        nama: name.trim(),
        kecamatan: kecamatan.trim() || '-',
        kabKota: kabKota.trim() || '-'
      });
      // Reset imported names agar fokus ke single generation
      setImportedData([]);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
      
      // Ambil data dari 4 kolom pertama: Porsi, Nama, Kecamatan, Kab/Kota
      const jamaahList: JamaahData[] = [];
      
      // Mulai dari baris ke-2 (index 1) jika ada header, tapi user bilang "ambil semua data"
      // Asumsi user mungkin punya header atau tidak.
      // Kita cek baris pertama, jika isinya seperti "No Porsi", "Nama", kita skip.
      // Untuk amannya kita ambil semua baris yang valid.
      
      data.forEach((row, index) => {
        // Simple heuristic: kalau baris pertama isinya "Nama" atau "Porsi", skip
        if (index === 0 && (row[0] === 'Porsi' || row[1] === 'Nama')) return;

        // Pastikan minimal ada nama (kolom ke-2) atau Porsi (kolom ke-1)
        const porsi = row[0] ? String(row[0]).trim() : '-';
        const nama = row[1] ? String(row[1]).trim() : '';
        const kecamatan = row[2] ? String(row[2]).trim() : '-';
        const kabKota = row[3] ? String(row[3]).trim() : '-';

        if (nama || porsi !== '-') {
           jamaahList.push({ porsi, nama: nama || '-', kecamatan, kabKota });
        }
      });
      
      if (jamaahList.length > 0) {
        setImportedData(jamaahList);
        setGeneratedData(null); // Reset single generated
        alert(`Berhasil mengimpor ${jamaahList.length} data jamaah dari Excel.`);
      } else {
        alert('Tidak ditemukan data valid di file Excel. Pastikan format: Porsi | Nama | Kecamatan | Kab/Kota');
      }
    };
    reader.readAsBinaryString(file);
  };
  
  const handleDownloadPdf = () => {
    if (!generatedData) return;
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      generatePdfPage(doc, generatedData);
      doc.save(`${generatedData.nama}-jamaah-2027.pdf`);
    } catch (e) {
      console.error('PDF generation error', e);
      alert('Gagal membuat PDF.');
    }
  };

  const handleDownloadBatchPdf = async () => {
    if (importedData.length === 0) return;
    
    try {
      const doc = new jsPDF({ unit: 'mm', format: 'a4' });
      
      for (let i = 0; i < importedData.length; i++) {
        if (i > 0) doc.addPage();
        const currentJamaah = importedData[i];
        
        // Generate QR Code data URL programmatically
        // Format: Porsi|Nama|Kecamatan|KabKota
        const qrContent = `${currentJamaah.porsi}|${currentJamaah.nama}|${currentJamaah.kecamatan}|${currentJamaah.kabKota}`;
        const qrDataUrl = await QRCode.toDataURL(qrContent, { errorCorrectionLevel: 'H' });
        
        generatePdfPage(doc, currentJamaah, qrDataUrl);
      }
      
      doc.save(`batch-jamaah-haji-${importedData.length}-orang.pdf`);
    } catch (e) {
      console.error('Batch PDF error', e);
      alert('Gagal membuat PDF Massal.');
    }
  };

  const generatePdfPage = (doc: jsPDF, data: JamaahData, qrDataUrl?: string) => {
    const pageWidth = doc.internal.pageSize.getWidth();
    const centerX = pageWidth / 2;
    
    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('Jamaah Haji Tahun 2027 / 1448H', centerX, 25, { align: 'center' });
    
    // Porsi
    doc.setFontSize(14);
    doc.text(`No. Porsi: ${data.porsi}`, centerX, 40, { align: 'center' });

    // Nama
    doc.setFontSize(24);
    // Handle nama panjang agar tidak terpotong (multiline)
    const splitName = doc.splitTextToSize(data.nama.toUpperCase(), 180);
    doc.text(splitName, centerX, 55, { align: 'center' });
    
    // Kecamatan & Kab/Kota
    doc.setFontSize(14);
    doc.text(`${data.kecamatan}`, centerX, 75, { align: 'center' });
    doc.text(`${data.kabKota}`, centerX, 85, { align: 'center' });

    // QR Code
    let dataUrl = qrDataUrl;
    if (!dataUrl && qrRef.current) {
      dataUrl = qrRef.current.toDataURL('image/png');
    }

    if (dataUrl) {
      const qrSize = 80; // mm
      const qrX = (pageWidth - qrSize) / 2;
      const qrY = 100; 
      doc.addImage(dataUrl, 'PNG', qrX, qrY, qrSize, qrSize);
    }
    
    // Footer note
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text('*Scan barcode ini untuk mencatat kehadiran', centerX, 190, { align: 'center' });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 print:hidden">
          <Link 
            href="/" 
            className="inline-flex items-center text-slate-600 hover:text-blue-600 hover:bg-white/50 px-4 py-2 rounded-full transition-all group"
          >
            <ArrowLeft className="w-4 h-4 mr-2 group-hover:-translate-x-1 transition-transform" />
            <span className="font-medium">Kembali ke Dashboard</span>
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-slate-100 print:shadow-none print:border-none print:rounded-none animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="bg-blue-600 p-6 sm:p-8 text-white relative overflow-hidden print:hidden">
            <div className="absolute top-0 right-0 p-8 opacity-10">
              <Printer className="w-32 h-32" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold relative z-10 flex items-center gap-3">
              <Printer className="w-8 h-8" />
              Buat Barcode Jamaah
            </h1>
            <p className="mt-2 text-blue-100 relative z-10">
              Generate barcode untuk jamaah haji secara manual atau massal.
            </p>
          </div>

          <div className="p-6 sm:p-8 print:p-0">
            <form onSubmit={handleGenerate} className="mb-8 print:hidden space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="porsi" className="text-sm font-semibold text-slate-700">
                    No. Porsi
                  </label>
                  <input
                    type="text"
                    id="porsi"
                    value={porsi}
                    onChange={(e) => setPorsi(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50/50 hover:bg-white focus:bg-white text-black"
                    placeholder="Masukkan nomor porsi..."
                  />
                </div>
                
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-semibold text-slate-700">
                    Nama Lengkap
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50/50 hover:bg-white focus:bg-white text-black"
                    placeholder="Masukkan nama jamaah..."
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="kecamatan" className="text-sm font-semibold text-slate-700">
                    Kecamatan
                  </label>
                  <input
                    type="text"
                    id="kecamatan"
                    value={kecamatan}
                    onChange={(e) => setKecamatan(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50/50 hover:bg-white focus:bg-white text-black"
                    placeholder="Contoh: Kaliwates"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="kabKota" className="text-sm font-semibold text-slate-700">
                    Kabupaten/Kota
                  </label>
                  <input
                    type="text"
                    id="kabKota"
                    value={kabKota}
                    onChange={(e) => setKabKota(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all bg-slate-50/50 hover:bg-white focus:bg-white text-black"
                    placeholder="Contoh: Jember"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 pt-4 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={!name}
                  className={`flex-1 py-3 px-6 rounded-xl font-bold text-white transition-all flex items-center justify-center gap-2 ${
                    !name
                      ? 'bg-slate-300 cursor-not-allowed'
                      : 'bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-200 hover:shadow-blue-300 active:scale-[0.98]'
                  }`}
                >
                  <Printer className="w-5 h-5" />
                  Generate Barcode
                </button>

                <div className="relative flex-1">
                  <input
                    type="file"
                    accept=".xlsx, .xls"
                    onChange={handleFileUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  />
                  <div className="w-full py-3 px-6 rounded-xl font-bold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2 cursor-pointer">
                    <Upload className="w-5 h-5 text-blue-600" />
                    Upload Excel
                  </div>
                </div>
              </div>
            </form>

          {importedData.length > 0 && (
            <div className="mb-8 p-4 bg-green-50 border border-green-200 rounded-xl animate-fade-in">
              <div className="flex items-center mb-2">
                <FileSpreadsheet className="w-5 h-5 text-green-600 mr-2" />
                <h3 className="font-semibold text-green-800">Data Terimport: {importedData.length} Jamaah</h3>
              </div>
              <div className="max-h-40 overflow-y-auto text-sm text-gray-600 mb-4 bg-white p-2 rounded-lg border">
                <ul className="list-disc pl-5">
                  {importedData.map((d, i) => (
                    <li key={i}>{d.nama} {d.porsi !== '-' ? `(${d.porsi})` : ''}</li>
                  ))}
                </ul>
              </div>
              <button
                onClick={handleDownloadBatchPdf}
                className="w-full flex items-center justify-center bg-green-600 text-white py-3 px-6 rounded-xl hover:bg-green-700 transition-all shadow-lg font-medium active:scale-95"
              >
                <FileDown className="w-5 h-5 mr-2" />
                Download PDF Semua ({importedData.length})
              </button>
            </div>
          )}

          {generatedData && (
            <div className="flex flex-col items-center justify-center border-t pt-8 print:border-none print:pt-0 animate-fade-in">
              <div className="print:flex print:flex-col print:items-center print:justify-center print:h-screen print:w-full bg-white p-8 rounded-xl border-4 border-double border-gray-200 print:border-none">
                
                {/* Header Dokumen */}
                <div className="text-center mb-8 border-b-2 border-gray-800 pb-4 w-full max-w-lg">
                  <h1 className="text-3xl font-bold text-gray-900 uppercase tracking-wider mb-2">
                    Jamaah Haji
                  </h1>
                  <h2 className="text-xl font-semibold text-gray-700">
                    Tahun 2027 / 1448H
                  </h2>
                </div>

                {/* Info Jamaah */}
                <div className="mb-8 text-center">
                  <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">No. Porsi</p>
                  <h4 className="text-xl font-bold text-gray-800 mb-4">{generatedData.porsi}</h4>

                  <p className="text-sm text-gray-500 uppercase tracking-widest mb-1">Nama Jamaah</p>
                  <h3 className="text-3xl font-bold text-blue-900 break-words max-w-2xl leading-tight mb-4">
                    {generatedData.nama}
                  </h3>

                  <div className="flex flex-col gap-1 text-gray-700 font-medium">
                    <p>{generatedData.kecamatan}</p>
                    <p>{generatedData.kabKota}</p>
                  </div>
                </div>

                {/* Barcode Area */}
                <div className="bg-white p-4 inline-block rounded-lg shadow-sm print:shadow-none border-2 border-gray-100 print:border-none">
                  <QRCodeCanvas 
                    ref={qrRef}
                    value={`${generatedData.porsi}|${generatedData.nama}|${generatedData.kecamatan}|${generatedData.kabKota}`} 
                    size={300} 
                    level={"H"}
                    includeMargin={true}
                  />
                </div>
                
                <p className="text-sm text-gray-400 mt-4 print:mt-8">
                  *Scan barcode ini untuk mencatat kehadiran
                </p>
              </div>

              <button
                onClick={handleDownloadPdf}
                className="mt-8 flex items-center justify-center bg-slate-800 text-white py-3 px-6 rounded-xl hover:bg-slate-900 transition-all shadow-lg print:hidden font-bold active:scale-[0.98]"
              >
                <Printer className="w-5 h-5 mr-2" />
                Cetak atau Simpan PDF
              </button>
            </div>
          )}
        </div>
      </div>
      
      <style jsx global>{`
        @media print {
          @page {
            size: auto;
            margin: 0mm;
          }
          body {
            background-color: white;
          }
          body * {
            visibility: hidden;
          }
          .print\\:flex, .print\\:flex * {
            visibility: visible;
          }
          .print\\:flex {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            height: 100vh;
            display: flex !important;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background-color: white;
            z-index: 9999;
            margin: 0;
            padding: 0;
          }
        }
      `}</style>
    </div>
    </div>
  );
}
