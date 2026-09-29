
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Staff from '@/models/Staff';
import { appendStaffAttendance } from '@/lib/googleSheets';
import { uploadImageToCloudinary } from '@/lib/cloudinary';
import { writeFile } from 'fs/promises';
import path from 'path';

function getEuclideanDistance(a: number[], b: number[]) {
  if (a.length !== b.length) return 1.0;
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

async function getPlaceName(lat: number, lng: number) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return `Lat: ${lat}, Long: ${lng}`;
  }

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`
    );
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      return data.results[0].formatted_address;
    }
    return `Lat: ${lat}, Long: ${lng}`;
  } catch (error) {
    console.error('Geocoding error:', error);
    return `Lat: ${lat}, Long: ${lng}`;
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { faceDescriptor, latitude, longitude, image } = await req.json();

    if (!faceDescriptor || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Data wajah dan lokasi diperlukan' },
        { status: 400 }
      );
    }

    const allStaff = await Staff.find({});
    let matchedStaff = null;
    let minDistance = 1.0;

    for (const staff of allStaff) {
      const distance = getEuclideanDistance(faceDescriptor, staff.faceDescriptor);
      console.log(`Comparing with ${staff.name}: distance ${distance}`); // Debug log
      // Threshold 0.45 for higher accuracy (99% target)
      if (distance < 0.45 && distance < minDistance) {
        minDistance = distance;
        matchedStaff = staff;
      }
    }

    if (!matchedStaff) {
      return NextResponse.json(
        { error: 'Wajah tidak dikenali. Silakan daftar terlebih dahulu.' },
        { status: 404 }
      );
    }

    // Get location name
    const locationName = await getPlaceName(latitude, longitude);

    // Upload photo if provided
    let photoUrl = undefined;
    if (image) {
      try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `absen_${matchedStaff.name}_${timestamp}.jpg`;
        
        // Strategy: Cloudinary (Preferred) -> Local (Fallback)
        try {
          if (process.env.CLOUDINARY_CLOUD_NAME) {
             console.log('Attempting Cloudinary upload...');
             photoUrl = await uploadImageToCloudinary(image, fileName);
             console.log('Saved to Cloudinary:', photoUrl);
          } else {
             throw new Error('Cloudinary credentials not set');
          }
        } catch (cloudErr) {
            console.log('Cloudinary skipped/failed, trying local storage...', cloudErr);
            
            try {
              const base64Data = image.replace(/^data:image\/\w+;base64,/, '');
              const buffer = Buffer.from(base64Data, 'base64');
              const uploadDir = path.join(process.cwd(), 'public', 'uploads');
              await writeFile(path.join(uploadDir, fileName), buffer);
              
              const host = req.headers.get('host');
              const protocol = req.headers.get('x-forwarded-proto') || 'http';
              photoUrl = `${protocol}://${host}/uploads/${fileName}`;
              console.log('Saved photo locally:', photoUrl);
            } catch (localErr) {
              console.error('Local save failed:', localErr);
              // No more Google Drive fallback
            }
        }

      } catch (err) {
        console.error('Failed to process photo:', err);
        // Continue without photo URL if fails
      }
    }

    // Save to Google Sheets
    await appendStaffAttendance({
      name: matchedStaff.name,
      status: matchedStaff.status,
      location: locationName,
      photoUrl: photoUrl,
    });

    return NextResponse.json({
      success: true,
      name: matchedStaff.name,
      status: matchedStaff.status,
      location: locationName,
      photoUrl: photoUrl,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('Attendance Error:', error);
    return NextResponse.json(
      { error: 'Gagal memproses absensi' },
      { status: 500 }
    );
  }
}
