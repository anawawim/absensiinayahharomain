import { NextResponse } from 'next/server';
import { appendAttendance } from '@/lib/googleSheets';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name } = body;

    console.log('Menerima request absen untuk raw data:', name);

    if (!name) {
      return NextResponse.json(
        { error: 'Data QR Code diperlukan' },
        { status: 400 }
      );
    }

    // Parse data QR Code
    // Format yang diharapkan: Porsi|Nama|Kecamatan|KabKota
    let porsi = '-';
    let namaJamaah = name;
    let kecamatan = '-';
    let kabKota = '-';

    if (name.includes('|')) {
      const parts = name.split('|');
      // Ambil data sesuai urutan, trim whitespace
      if (parts.length >= 1) porsi = parts[0].trim();
      if (parts.length >= 2) namaJamaah = parts[1].trim();
      if (parts.length >= 3) kecamatan = parts[2].trim();
      if (parts.length >= 4) kabKota = parts[3].trim();
    }

    const result = await appendAttendance({
      porsi,
      nama: namaJamaah,
      kecamatan,
      kabKota
    });
    console.log('Berhasil mencatat absen:', result);

    return NextResponse.json(result, { status: 200 });
  } catch (error: any) {
    console.error('API Error details:', error);
    
    // Pastikan pesan error sampai ke frontend
    const errorMessage = error.message || 'Terjadi kesalahan server internal';
    
    return NextResponse.json(
      { 
        error: errorMessage,
        details: process.env.NODE_ENV === 'development' ? JSON.stringify(error) : undefined
      },
      { status: 500 }
    );
  }
}
