const express = require('express');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const mongoose = require('mongoose');
const { logger } = require('@librechat/data-schemas');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const jsonLimit = express.json({ limit: '256kb' });

router.use(requireJwtAuth);

function toApiContact(doc) {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email ?? '',
    phone: doc.phone ?? '',
    company: doc.company ?? '',
    notes: doc.notes ?? '',
    attributes: doc.attributes && typeof doc.attributes === 'object' ? doc.attributes : {},
    created_at:
      doc.created_at instanceof Date ? doc.created_at.toISOString() : new Date(doc.created_at).toISOString(),
    updated_at:
      doc.updated_at instanceof Date ? doc.updated_at.toISOString() : new Date(doc.updated_at).toISOString(),
  };
}

/**
 * GET /contacts?q=
 */
router.get('/', async (req, res) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const Contact = mongoose.models.Contact;
    const filter = { userId: req.user.id };
    if (q) {
      filter.searchText = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    }
    const docs = await Contact.find(filter).sort({ updated_at: -1 }).lean();
    res.json({ contacts: docs.map(toApiContact) });
  } catch (err) {
    logger.error('[contacts] list failed', err);
    res.status(500).json({ error: 'Failed to list contacts' });
  }
});

/**
 * POST /contacts
 */
router.post('/', jsonLimit, async (req, res) => {
  try {
    const { name, email, phone, company, notes, attributes } = req.body ?? {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const Contact = mongoose.models.Contact;
    const now = new Date();
    const doc = await Contact.create({
      userId: req.user.id,
      name: name.trim(),
      email: typeof email === 'string' ? email.trim() : '',
      phone: typeof phone === 'string' ? phone.trim() : '',
      company: typeof company === 'string' ? company.trim() : '',
      notes: typeof notes === 'string' ? notes.trim() : '',
      attributes:
        attributes && typeof attributes === 'object' && !Array.isArray(attributes)
          ? attributes
          : {},
      searchText: [
        name,
        email,
        phone,
        company,
        notes,
        ...(attributes && typeof attributes === 'object'
          ? Object.values(attributes).map((v) => (v == null ? '' : String(v)))
          : []),
      ]
        .filter(Boolean)
        .join(' ')
        .slice(0, 32000),
      created_at: now,
      updated_at: now,
    });

    res.status(201).json({ contact: toApiContact(doc) });
  } catch (err) {
    logger.error('[contacts] create failed', err);
    res.status(500).json({ error: 'Failed to create contact' });
  }
});

/**
 * POST /contacts/import — register before /:id
 */
router.post('/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: 'CSV file is required (field name: file)' });
    }
    const text = req.file.buffer.toString('utf8');
    const records = parse(text, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_column_count: true,
    });
    if (!Array.isArray(records) || records.length === 0) {
      return res.status(400).json({ error: 'No data rows found in CSV' });
    }

    const Contact = mongoose.models.Contact;
    const now = new Date();
    let inserted = 0;
    let skipped = 0;
    const docs = [];

    for (const row of records) {
      const entries = Object.entries(row || {});
      const lower = entries.reduce((acc, [k, v]) => {
        acc[k.toLowerCase().trim()] = v == null ? '' : String(v).trim();
        return acc;
      }, {});

      // Prefer explicit name-ish columns
      let name =
        lower.name ||
        lower.full_name ||
        lower.fullname ||
        lower.contact ||
        lower['contact name'] ||
        '';

      // Fallback: build a name from the first non-empty cells in the row
      if (!name) {
        const nonEmptyValues = entries
          .map(([, v]) => (v == null ? '' : String(v).trim()))
          .filter(Boolean);
        if (nonEmptyValues.length > 0) {
          name = nonEmptyValues.slice(0, 3).join(' ');
        }
      }

      // Still nothing: row is effectively empty, skip it
      if (!name) {
        skipped += 1;
        continue;
      }

      const email = lower.email || lower['e-mail'] || lower.mail || '';
      const phone = lower.phone || lower.mobile || lower.tel || '';
      const company = lower.company || lower.organization || lower.org || lower.employer || '';
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

      const attributes = Object.entries(lower).reduce((acc, [k, v]) => {
        if (!coreKeys.has(k) && v) {
          acc[k] = v;
        }
        return acc;
      }, {});

      const payload = { name, email, phone, company, notes, attributes };

      docs.push({
        userId: req.user.id,
        ...payload,
        searchText: [
          name,
          email,
          phone,
          company,
          notes,
          ...Object.values(attributes),
        ]
          .filter(Boolean)
          .join(' ')
          .slice(0, 32000),
        created_at: now,
        updated_at: now,
      });
    }

    if (docs.length > 0) {
      await Contact.insertMany(docs, { ordered: false });
      inserted = docs.length;
    }

    res.json({ inserted, skipped });
  } catch (err) {
    logger.error('[contacts] import failed', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

/**
 * PATCH /contacts/:id
 */
router.patch('/:id', jsonLimit, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact id' });
    }
    const { name, email, phone, company, notes, attributes } = req.body ?? {};
    const payload = {};
    if (name !== undefined) {
      payload.name = name;
    }
    if (email !== undefined) {
      payload.email = email;
    }
    if (phone !== undefined) {
      payload.phone = phone;
    }
    if (company !== undefined) {
      payload.company = company;
    }
    if (notes !== undefined) {
      payload.notes = notes;
    }
    if (attributes !== undefined) {
      payload.attributes = attributes;
    }
    const doc = await updateContact({
      userId: req.user.id,
      contactId: id,
      data: payload,
    });
    if (!doc) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.json({ contact: toApiContact(doc) });
  } catch (err) {
    logger.error('[contacts] update failed', err);
    res.status(500).json({ error: 'Failed to update contact' });
  }
});

/**
 * DELETE /contacts/:id
 */
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ error: 'Invalid contact id' });
    }
    const ok = await deleteContact({ userId: req.user.id, contactId: id });
    if (!ok) {
      return res.status(404).json({ error: 'Contact not found' });
    }
    res.status(204).send();
  } catch (err) {
    logger.error('[contacts] delete failed', err);
    res.status(500).json({ error: 'Failed to delete contact' });
  }
});

module.exports = router;
