const { Tool } = require('@langchain/core/tools');
const mongoose = require('mongoose');

// Escape regex special characters to avoid malformed RegExp when user input includes punctuation.
function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const contactsSearchJsonSchema = {
  type: 'object',
  properties: {
    query: {
      type: 'string',
      description:
        'Optional search text for finding matching contacts. If omitted/empty, returns the most recently updated contacts.',
    },
    limit: {
      type: 'integer',
      minimum: 1,
      maximum: 50,
      description: 'Maximum number of contacts to return. Defaults to 5 (max 50).',
    },
  },
  required: [],
};

class ContactsSearch extends Tool {
  static lc_name() {
    return 'contacts_search';
  }

  static get jsonSchema() {
    return contactsSearchJsonSchema;
  }

  constructor(fields = {}) {
    super(fields);
    this.name = 'contacts_search';
    this.userId = fields.userId;
    this.description =
      "Search the authenticated user's imported contacts and return the most relevant matches. If query is omitted/empty, return the most recently updated contacts.";
    this.schema = contactsSearchJsonSchema;
  }

  async _call(input) {
    const Contact = mongoose.models.Contact;
    if (!Contact) {
      throw new Error('Contact model is not registered');
    }

    const query = String(input?.query ?? '').trim();
    const limit = Math.max(1, Math.min(50, Number(input?.limit ?? 5) || 5));

    const qLower = query.toLowerCase();
    const shouldSearch =
      Boolean(query) && !['*', 'all', 'all contacts', 'list all contacts'].includes(qLower);

    const filter = { userId: this.userId };
    if (shouldSearch) {
      const regex = new RegExp(escapeRegExp(query), 'i');
      filter.searchText = regex;
    }

    const docs = await Contact.find(filter).sort({ updated_at: -1 }).limit(limit).lean();

    const contacts = (docs ?? []).map((doc) => {
      const attributesObj = doc.attributes && typeof doc.attributes === 'object' ? doc.attributes : {};
      const attributesEntries = Object.entries(attributesObj);
      const trimmedAttributes = Object.fromEntries(attributesEntries.slice(0, 10));

      return {
        id: String(doc._id),
        name: doc.name ?? '',
        email: doc.email ?? '',
        phone: doc.phone ?? '',
        company: doc.company ?? '',
        notes: doc.notes ?? '',
        attributes: trimmedAttributes,
        created_at: doc.created_at ?? null,
        updated_at: doc.updated_at ?? null,
      };
    });

    return JSON.stringify({ contacts });
  }
}

module.exports = ContactsSearch;

