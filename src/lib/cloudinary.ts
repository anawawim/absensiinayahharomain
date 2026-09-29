import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

export async function uploadImageToCloudinary(base64Image: string, fileName: string): Promise<string> {
  // Check if credentials are set
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    throw new Error('Cloudinary credentials missing');
  }

  return new Promise((resolve, reject) => {
    cloudinary.uploader.upload(
      base64Image,
      {
        public_id: fileName.replace(/\.[^/.]+$/, ""), // Remove extension for public_id
        folder: 'absen_staff',
        resource_type: 'image',
      },
      (error, result) => {
        if (error) return reject(error);
        if (result && result.secure_url) {
          resolve(result.secure_url);
        } else {
          reject(new Error('Upload failed'));
        }
      }
    );
  });
}