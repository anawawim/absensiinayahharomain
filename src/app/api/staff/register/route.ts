
import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Staff, { IStaff } from '@/models/Staff';

function getEuclideanDistance(a: number[], b: number[]) {
  if (a.length !== b.length) return 1.0;
  return Math.sqrt(a.reduce((sum, val, i) => sum + Math.pow(val - b[i], 2), 0));
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { name, status, faceDescriptor } = await req.json();

    if (!name || !status || !faceDescriptor) {
      return NextResponse.json(
        { error: 'Nama, status, dan data wajah diperlukan' },
        { status: 400 }
      );
    }

    // Check for duplicate face
    const allStaff = await Staff.find({});
    let isDuplicate = false;
    let duplicateName = '';

    for (const staff of allStaff) {
      const distance = getEuclideanDistance(faceDescriptor, staff.faceDescriptor);
      // Threshold 0.45 for higher accuracy (99% target)
      if (distance < 0.45) {
        isDuplicate = true;
        duplicateName = staff.name;
        break;
      }
    }

    if (isDuplicate) {
      return NextResponse.json(
        { error: `Wajah sudah terdaftar atas nama ${duplicateName}` },
        { status: 400 }
      );
    }

    const newStaff = await Staff.create({
      name,
      status,
      faceDescriptor,
    });

    return NextResponse.json(
      { success: true, message: 'Pendaftaran berhasil', data: newStaff },
      { status: 201 }
    );
  } catch (error: any) {
    console.error('Registration Error:', error);
    return NextResponse.json(
      { error: 'Gagal mendaftarkan staff' },
      { status: 500 }
    );
  }
}
