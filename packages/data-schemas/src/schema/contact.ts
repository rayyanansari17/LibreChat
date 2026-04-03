import { Schema } from 'mongoose';
import type { IContact } from '~/types/contact';

const ContactSchema: Schema<IContact> = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      default: '',
    },
    phone: {
      type: String,
      trim: true,
      default: '',
    },
    company: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    attributes: {
      type: Schema.Types.Mixed,
      default: {},
    },
    searchText: {
      type: String,
      default: '',
      index: true,
    },
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
    tenantId: {
      type: String,
      index: true,
    },
  },
  { timestamps: false },
);

ContactSchema.index({ userId: 1, updated_at: -1 });

export default ContactSchema;
