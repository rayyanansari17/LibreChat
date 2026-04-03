import { Types } from 'mongoose';
import type * as t from '~/types';

function asTrimmedString(value: unknown): string {
  if (value == null) {
    return '';
  }
  return String(value).trim();
}

function buildSearchText(input: {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
  attributes?: Record<string, string>;
}): string {
  const parts: string[] = [input.name];
  for (const key of ['email', 'phone', 'company', 'notes'] as const) {
    const v = input[key];
    if (v) {
      parts.push(v);
    }
  }
  if (input.attributes) {
    for (const v of Object.values(input.attributes)) {
      if (v) {
        parts.push(v);
      }
    }
  }
  return parts.join(' ').slice(0, 32000);
}

export interface ContactMethods {
  getContactsForUser: (params: {
    userId: string | Types.ObjectId;
    query?: string;
  }) => Promise<t.IContactLean[]>;
  createContact: (params: {
    userId: string | Types.ObjectId;
    data: t.CreateContactParams;
  }) => Promise<t.IContactLean>;
  updateContact: (params: {
    userId: string | Types.ObjectId;
    contactId: string | Types.ObjectId;
    data: Partial<t.CreateContactParams>;
  }) => Promise<t.IContactLean | null>;
  deleteContact: (params: {
    userId: string | Types.ObjectId;
    contactId: string | Types.ObjectId;
  }) => Promise<boolean>;
  importContactsForUser: (params: {
    userId: string | Types.ObjectId;
    rows: Record<string, string>[];
  }) => Promise<{ inserted: number; skipped: number }>;
}

export function createContactMethods(mongoose: typeof import('mongoose')): ContactMethods {
  async function getContactsForUser({
    userId,
    query,
  }: {
    userId: string | Types.ObjectId;
    query?: string;
  }): Promise<t.IContactLean[]> {
    const Contact = mongoose.models.Contact;
    const filter: Record<string, unknown> = { userId };
    const q = query?.trim();
    if (q) {
      filter.searchText = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const docs = await Contact.find(filter).sort({ updated_at: -1 }).lean();
    return docs as t.IContactLean[];
  }

  async function createContact({
    userId,
    data,
  }: {
    userId: string | Types.ObjectId;
    data: t.CreateContactParams;
  }): Promise<t.IContactLean> {
    const Contact = mongoose.models.Contact;
    const now = new Date();
    const doc = await Contact.create({
      userId,
      name: data.name.trim(),
      email: asTrimmedString(data.email),
      phone: asTrimmedString(data.phone),
      company: asTrimmedString(data.company),
      notes: asTrimmedString(data.notes),
      attributes: data.attributes ?? {},
      searchText: buildSearchText({
        name: data.name.trim(),
        email: asTrimmedString(data.email),
        phone: asTrimmedString(data.phone),
        company: asTrimmedString(data.company),
        notes: asTrimmedString(data.notes),
        attributes: data.attributes ?? {},
      }),
      created_at: now,
      updated_at: now,
    });
    return doc.toObject() as t.IContactLean;
  }

  async function updateContact({
    userId,
    contactId,
    data,
  }: {
    userId: string | Types.ObjectId;
    contactId: string | Types.ObjectId;
    data: Partial<t.CreateContactParams>;
  }): Promise<t.IContactLean | null> {
    const Contact = mongoose.models.Contact;
    const existing = await Contact.findOne({ _id: contactId, userId }).lean();
    if (!existing) {
      return null;
    }
    const next: t.CreateContactParams = {
      name: data.name !== undefined ? data.name.trim() : existing.name,
      email: data.email !== undefined ? asTrimmedString(data.email) : existing.email ?? '',
      phone: data.phone !== undefined ? asTrimmedString(data.phone) : existing.phone ?? '',
      company: data.company !== undefined ? asTrimmedString(data.company) : existing.company ?? '',
      notes: data.notes !== undefined ? asTrimmedString(data.notes) : existing.notes ?? '',
      attributes:
        data.attributes !== undefined
          ? data.attributes
          : (existing.attributes as Record<string, string>) ?? {},
    };
    if (!next.name) {
      throw new Error('Contact name cannot be empty');
    }
    const updated = await Contact.findOneAndUpdate(
      { _id: contactId, userId },
      {
        ...next,
        searchText: buildSearchText(next),
        updated_at: new Date(),
      },
      { new: true },
    ).lean();
    return updated as t.IContactLean | null;
  }

  async function deleteContact({
    userId,
    contactId,
  }: {
    userId: string | Types.ObjectId;
    contactId: string | Types.ObjectId;
  }): Promise<boolean> {
    const Contact = mongoose.models.Contact;
    const result = await Contact.deleteOne({ _id: contactId, userId });
    return result.deletedCount === 1;
  }

  async function importContactsForUser({
    userId,
    rows,
  }: {
    userId: string | Types.ObjectId;
    rows: Record<string, string>[];
  }): Promise<{ inserted: number; skipped: number }> {
    const Contact = mongoose.models.Contact;
    const now = new Date();
    let inserted = 0;
    let skipped = 0;

    const docs = [];
    for (const row of rows) {
      const lower: Record<string, string> = {};
      for (const [k, v] of Object.entries(row)) {
        lower[k.toLowerCase().trim()] = v == null ? '' : String(v).trim();
      }
      const name =
        lower.name ||
        lower.full_name ||
        lower.fullname ||
        lower.contact ||
        lower['contact name'] ||
        '';
      if (!name) {
        skipped += 1;
        continue;
      }
      const email =
        lower.email ||
        lower['e-mail'] ||
        lower.mail ||
        '';
      const phone = lower.phone || lower.mobile || lower.tel || '';
      const company =
        lower.company ||
        lower.organization ||
        lower.org ||
        lower.employer ||
        '';
      const notes = lower.notes || lower.description || lower.comment || '';
      const coreKeys = new Set([
        'name',
        'full_name',
        'fullname',
        'contact',
        'contact name',
        'email',
        'e-mail',
        'mail',
        'phone',
        'mobile',
        'tel',
        'company',
        'organization',
        'org',
        'employer',
        'notes',
        'description',
        'comment',
      ]);
      const attributes: Record<string, string> = {};
      for (const [k, v] of Object.entries(lower)) {
        if (!coreKeys.has(k) && v) {
          attributes[k] = v;
        }
      }
      const payload = {
        name,
        email,
        phone,
        company,
        notes,
        attributes,
      };
      docs.push({
        userId,
        ...payload,
        searchText: buildSearchText(payload),
        created_at: now,
        updated_at: now,
      });
    }

    if (docs.length > 0) {
      await Contact.insertMany(docs, { ordered: false });
      inserted = docs.length;
    }

    return { inserted, skipped };
  }

  return {
    getContactsForUser,
    createContact,
    updateContact,
    deleteContact,
    importContactsForUser,
  };
}
