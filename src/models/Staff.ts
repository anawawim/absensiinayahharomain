
import mongoose, { Schema, Document } from 'mongoose';

export interface IStaff extends Document {
  name: string;
  status: 'Staff' | 'Crew';
  faceDescriptor: number[];
  createdAt: Date;
}

const StaffSchema: Schema = new Schema({
  name: { type: String, required: true },
  status: { type: String, enum: ['Staff', 'Crew'], required: true },
  faceDescriptor: { type: [Number], required: true }, // Store Float32Array as array of numbers
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.models.Staff || mongoose.model<IStaff>('Staff', StaffSchema);
