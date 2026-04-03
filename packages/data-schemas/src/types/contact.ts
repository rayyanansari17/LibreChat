import type { Types, Document } from 'mongoose';

export interface IContact extends Document {
  userId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  attributes?: Record<string, string>;
  searchText: string;
  created_at: Date;
  updated_at: Date;
  tenantId?: string;
}

export interface IContactLean {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  attributes?: Record<string, string>;
  searchText: string;
  created_at: Date;
  updated_at: Date;
  tenantId?: string;
}

export interface CreateContactParams {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  attributes?: Record<string, string>;
}
