import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import { google } from 'googleapis';

// Inisialisasi Auth dengan Service Account
const serviceAccountAuth = new JWT({
  email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  scopes: [
    'https://www.googleapis.com/auth/spreadsheets',
  ],
});

// Singleton client Google Sheets API v4 untuk performa maksimal tanpa inisialisasi berulang
const sheetsClient = google.sheets({ version: 'v4', auth: serviceAccountAuth });

// Helper untuk konversi nomor kolom (1-based) ke format huruf (A, B, ..., Z, AA, AB, ...)
function getColumnLetter(colNum: number): string {
  let letter = '';
  while (colNum > 0) {
    const rem = (colNum - 1) % 26;
    letter = String.fromCharCode(65 + rem) + letter;
    colNum = Math.floor((colNum - 1) / 26);
  }
  return letter;
}

// Helper untuk normalisasi string (menghapus spasi ekstra, karakter non-alfanumerik, huruf kecil)
function normalizeString(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
}

interface JamaahRecord {
  porsi: string;
  nama: string;
  kecamatan: string;
  kabKota: string;
  rowNumber: number;
  weeks: boolean[]; // Array 24 boolean untuk Minggu 1 s/d 24 (index 0 = Minggu 1)
  hadirCount: number;
}

interface RekapanCache {
  list: JamaahRecord[];
  byPorsi: Map<string, JamaahRecord>;
  byNama: Map<string, JamaahRecord>;
  timestamp: number;
}


// In-memory cache data & status absensi seluruh jamaah
let rekapanCache: RekapanCache | null = null;
const CACHE_TTL_MS = 10 * 60 * 1000; // Cache 10 menit

export function invalidateRekapanCache() {
  rekapanCache = null;
}

// Mengambil atau menginisialisasi cache dari Sheet Rekapan dalam 1 panggilan API tunggal
async function getOrInitCache(spreadsheetId: string): Promise<RekapanCache> {
  const now = Date.now();
  if (rekapanCache && (now - rekapanCache.timestamp) < CACHE_TTL_MS) {
    return rekapanCache;
  }

  // 1 network call mengambil: No. Porsi (B), Nama (C), Kecamatan (D), Kota (E), dan Minggu 1-24 (F-AC)
  const res = await sheetsClient.spreadsheets.values.get({
    spreadsheetId,
    range: 'Rekapan!B4:AC1000',
  });

  const rows: string[][] = res.data.values || [];
  const list: JamaahRecord[] = [];
  const byPorsi = new Map<string, JamaahRecord>();
  const byNama = new Map<string, JamaahRecord>();

  rows.forEach((r, idx) => {
    const porsi = String(r[0] || '').trim();
    const nama = String(r[1] || '').trim();
    // Lewati baris kosong atau baris rekapitulasi/rumus total di bagian bawah
    if (!porsi && !nama) return;

    const kecamatan = String(r[2] || '').trim();
    const kabKota = String(r[3] || '').trim();
    const rowNumber = 4 + idx;

    // Kolom F sampai AC berada di index 4 s/d 27 relatif terhadap kolom B
    const weeks: boolean[] = [];
    let hadirCount = 0;
    for (let w = 0; w < 24; w++) {
      const val = String(r[4 + w] || '').trim().toUpperCase();
      const isChecked = val === 'TRUE';
      weeks.push(isChecked);
      if (isChecked) hadirCount++;
    }

    const record: JamaahRecord = {
      porsi,
      nama,
      kecamatan,
      kabKota,
      rowNumber,
      weeks,
      hadirCount,
    };

    list.push(record);
    if (porsi && porsi !== '-') {
      byPorsi.set(porsi, record);
    }
    if (nama) {
      byNama.set(normalizeString(nama), record);
    }
  });

  rekapanCache = { list, byPorsi, byNama, timestamp: now };
  return rekapanCache;
}

export const appendAttendance = async (data: { 
  porsi: string; 
  nama: string; 
  kecamatan: string; 
  kabKota: string;
  minggu?: number | string;
}) => {
  if (!process.env.GOOGLE_SHEET_ID) {
    throw new Error('Konfigurasi Error: GOOGLE_SHEET_ID belum diset di .env.local');
  }
  
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('Konfigurasi Error: Credential Service Account belum diset di .env.local');
  }

  const spreadsheetId = process.env.GOOGLE_SHEET_ID;

  // Normalisasi Pertemuan Minggu ke-N (1 sampai 24)
  let weekNum = 1;
  if (data.minggu) {
    const parsed = parseInt(String(data.minggu).replace(/\D/g, ''), 10);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= 24) {
      weekNum = parsed;
    }
  }
  const labelPertemuan = `Minggu ${weekNum}`;
  const weekIndex = weekNum - 1; // 0-based index

  try {
    // 1. Dapatkan cache data & matriks absensi
    const cache = await getOrInitCache(spreadsheetId);

    // 2. Pencarian Jamaah secara instan di memori (O(1) hash map lookup)
    const inputPorsi = String(data.porsi || '').trim();
    const inputNamaRaw = String(data.nama || '').trim();
    const inputNamaNorm = normalizeString(data.nama);

    let matched: JamaahRecord | undefined;
    if (inputPorsi && inputPorsi !== '-') {
      matched = cache.byPorsi.get(inputPorsi);
      // Jika input menyertakan nama (dari QR Code) dan nama pada Porsi tersebut berbeda
      // (misal ada duplikasi No. Porsi di Rekapan), prioritaskan kecocokan nama yang spesifik
      if (matched && inputNamaNorm && !/^\d+$/.test(inputNamaRaw)) {
        if (normalizeString(matched.nama) !== inputNamaNorm) {
          const byNameMatch = cache.byNama.get(inputNamaNorm);
          if (byNameMatch) {
            matched = byNameMatch;
          }
        }
      }
    }
    if (!matched && inputNamaRaw) {
      // Cek apakah input manual berupa Nomor Porsi langsung (tanpa pemisah '|')
      matched = cache.byPorsi.get(inputNamaRaw);
    }
    if (!matched && inputNamaNorm) {
      matched = cache.byNama.get(inputNamaNorm);
      if (!matched) {
        // Fallback pencarian parsial jika ada perbedaan kecil dalam penulisan nama
        matched = cache.list.find(j => {
          const jNorm = normalizeString(j.nama);
          return jNorm && (jNorm.includes(inputNamaNorm) || inputNamaNorm.includes(jNorm));
        });
      }
    }

    const finalPorsi = (matched?.porsi && matched.porsi !== '-') ? matched.porsi : (inputPorsi || '-');
    const finalNama = matched?.nama || inputNamaRaw;
    const finalKecamatan = (data.kecamatan && data.kecamatan !== '-') ? data.kecamatan : (matched?.kecamatan || '-');
    const finalKabKota = (data.kabKota && data.kabKota !== '-') ? data.kabKota : (matched?.kabKota || '-');

    // 3. CEK APAKAH SUDAH ABSEN DI MINGGU INI? JIKA SUDAH -> TOLAK ABSEN!
    if (matched && matched.weeks[weekIndex] === true) {
      return {
        success: false,
        alreadyAttended: true,
        message: `Absen ditolak! ${finalNama} sudah tercatat hadir pada ${labelPertemuan}.`,
        porsi: finalPorsi,
        nama: finalNama,
        kecamatan: finalKecamatan,
        kabKota: finalKabKota,
        minggu: weekNum,
        pertemuan: labelPertemuan,
        hadirCount: matched.hadirCount,
        absenCount: 24 - matched.hadirCount,
        totalCount: 24,
      };
    }

    // 4. Jika belum absen: perbarui status di cache secara langsung untuk mencegah scan ganda serentak
    if (matched) {
      matched.weeks[weekIndex] = true;
      matched.hadirCount += 1;
    }

    const timestamp = new Date().toLocaleString('id-ID', { 
      timeZone: 'Asia/Jakarta',
      dateStyle: 'full',
      timeStyle: 'medium'
    });

    const colLetter = getColumnLetter(5 + weekNum);
    const rekapanRowNumber = matched ? matched.rowNumber : null;

    // 5. EKSEKUSI PARALEL (Promise.all) KE GOOGLE SHEETS
    // Mengirim append log ke "Jamaah Haji" dan ceklis ke "Rekapan" secara bersamaan
    const updatePromises: Promise<any>[] = [
      // Log di sheet "Jamaah Haji"
      sheetsClient.spreadsheets.values.append({
        spreadsheetId,
        range: "'Jamaah Haji'!A:F",
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [[
            finalPorsi,
            finalNama,
            finalKecamatan,
            finalKabKota,
            timestamp,
            labelPertemuan,
          ]],
        },
      }),
    ];

    if (rekapanRowNumber) {
      // Ceklis checkbox di sheet "Rekapan"
      updatePromises.push(
        sheetsClient.spreadsheets.values.update({
          spreadsheetId,
          range: `Rekapan!${colLetter}${rekapanRowNumber}`,
          valueInputOption: 'USER_ENTERED',
          requestBody: {
            values: [[true]],
          },
        })
      );
    }

    await Promise.all(updatePromises);

    const updatedHadir = matched ? matched.hadirCount : 1;

    return { 
      success: true, 
      alreadyAttended: false,
      porsi: finalPorsi, 
      nama: finalNama, 
      kecamatan: finalKecamatan, 
      kabKota: finalKabKota, 
      minggu: weekNum,
      pertemuan: labelPertemuan,
      timestamp,
      rekapanUpdated: !!rekapanRowNumber,
      rekapanRow: rekapanRowNumber,
      hadirCount: updatedHadir,
      absenCount: 24 - updatedHadir,
      totalCount: 24,
    };
  } catch (error: any) {
    console.error('Google Sheets Error:', error);
    if (error.response?.status === 403) {
      throw new Error('Permission Denied: Service Account tidak memiliki akses ke Spreadsheet ini.');
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
    } catch {
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
