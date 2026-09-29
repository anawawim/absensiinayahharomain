import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// Inisialisasi Auth dengan Service Account
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

export const appendAttendance = async (data: { porsi: string; nama: string; kecamatan: string; kabKota: string }) => {
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error('Konfigurasi Error: GOOGLE_SHEET_ID belum diset di .env.local');
  }
  
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Konfigurasi Error: Credential Service Account belum diset di .env.local');
  }

  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);

    await doc.loadInfo(); // memuat properti dokumen

    // Menggunakan sheet pertama
    const sheet = doc.sheetsByIndex[0];

    // Cek apakah header sudah ada
    const requiredHeaders = ['Porsi', 'Nama', 'Kecamatan', 'Kab/Kota', 'Waktu'];
    try {
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues;
      // Cek apakah semua header yang dibutuhkan ada
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
        console.log('Header tidak lengkap, memperbarui header...');
        // Note: Ini akan menimpa header yang ada. Jika urutan penting, ini mungkin perlu disesuaikan.
        // Untuk amannya, kita set header row jika benar-benar kosong atau berbeda struktur
        if (headers.length < requiredHeaders.length) {
           await sheet.setHeaderRow(requiredHeaders);
        }
      }
    } catch (e) {
      console.log('Sheet mungkin kosong, membuat header baru...');
      await sheet.setHeaderRow(requiredHeaders);
    }
    
    const timestamp = new Date().toLocaleString('id-ID', { 
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    await sheet.addRow({
      'Porsi': data.porsi || '-',
      'Nama': data.nama,
      'Kecamatan': data.kecamatan || '-',
      'Kab/Kota': data.kabKota || '-',
      'Waktu': timestamp,
    });

    return { success: true, ...data, timestamp };
  } catch (error: any) {
    console.error('Google Sheets Error:', error);
    // Melempar error yang lebih deskriptif
    if (error.response?.status === 403) {
      throw new Error('Permission Denied: Service Account tidak memiliki akses ke Spreadsheet ini. Pastikan email Service Account sudah ditambahkan sebagai Editor.');
    }
    if (error.response?.status === 404) {
      throw new Error('Spreadsheet Not Found: ID Spreadsheet salah atau tidak ditemukan.');
    }
    throw error;
  }
};

export const appendStaffAttendance = async (data: { name: string; status: string; location: string; photoUrl?: string }) => {
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error('Konfigurasi Error: GOOGLE_SHEET_ID belum diset di .env.local');
  }
  
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Konfigurasi Error: Credential Service Account belum diset di .env.local');
  }

  try {
    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle['Staff'];
    if (!sheet) {
      sheet = await doc.addSheet({ title: 'Staff' });
    }

    const requiredHeaders = ['Nama', 'Status', 'Lokasi', 'Waktu', 'Link Foto'];
    try {
      await sheet.loadHeaderRow();
      const headers = sheet.headerValues;
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      if (missingHeaders.length > 0) {
         await sheet.setHeaderRow(requiredHeaders);
      }
    } catch (e) {
      await sheet.setHeaderRow(requiredHeaders);
    }
    
    const timestamp = new Date().toLocaleString('id-ID', { 
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    await sheet.addRow({
      'Nama': data.name,
      'Status': data.status,
      'Lokasi': data.location,
      'Waktu': timestamp,
      'Link Foto': data.photoUrl || '-',
    });

    return { success: true, ...data, timestamp };
  } catch (error: any) {
    console.error('Google Sheets Error (Staff):', error);
    throw error;
  }
};
