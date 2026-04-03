import { useRef, useMemo, useState } from 'react';
import { BookUser, Upload } from 'lucide-react';
import { matchSorter } from 'match-sorter';
import type { TContact } from 'librechat-data-provider';
import {
  Button,
  Spinner,
  FilterInput,
  TooltipAnchor,
  useToastContext,
} from '@librechat/client';
import {
  useContactsQuery,
  useImportContactsCsvMutation,
  useDeleteContactMutation,
} from '~/data-provider';
import { useLocalize } from '~/hooks';

export default function ContactPanel() {
  const localize = useLocalize();
  const { showToast } = useToastContext();
  const fileRef = useRef<HTMLInputElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const { data, isLoading } = useContactsQuery();
  const importMutation = useImportContactsCsvMutation();
  const deleteMutation = useDeleteContactMutation();

  const contacts: TContact[] = useMemo(() => data?.contacts ?? [], [data]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim();
    if (!q) {
      return contacts;
    }
    return matchSorter(contacts, q, { keys: ['name', 'email', 'company', 'phone', 'notes'] });
  }, [contacts, searchQuery]);

  const handleContactClick = (contact: TContact) => {
    const parts: string[] = [];
    if (contact.email) {
      parts.push(`Email: ${contact.email}`);
    }
    if (contact.phone) {
      parts.push(`Phone: ${contact.phone}`);
    }
    if (contact.company) {
      parts.push(`Company: ${contact.company}`);
    }
    if (contact.notes) {
      parts.push(`Notes: ${contact.notes}`);
    }

    showToast({
      message:
        parts.length > 0
          ? `${contact.name}\n${parts.join('\n')}`
          : contact.name,
      status: 'info',
    });
  };

  const handlePickFile = () => fileRef.current?.click();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) {
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    importMutation.mutate(formData, {
      onSuccess: (result) => {
        showToast({
          message: localize('com_ui_contacts_import_success', {
            inserted: result.inserted,
            skipped: result.skipped,
          }),
          status: 'success',
        });
      },
      onError: () => {
        showToast({
          message: localize('com_ui_contacts_import_error'),
          status: 'error',
        });
      },
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 px-3 pb-3">
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-border-light pb-2 pt-1">
        <BookUser className="h-5 w-5 text-text-secondary" aria-hidden />
        <h2 className="text-sm font-semibold text-text-primary">{localize('com_ui_contacts')}</h2>
      </div>

      <p className="text-xs text-text-secondary">{localize('com_ui_contacts_import_hint')}</p>

      <input
        ref={fileRef}
        type="file"
        accept=".csv,text/csv"
        className="hidden"
        onChange={handleFileChange}
        aria-label={localize('com_ui_contacts_import_csv')}
      />
      <TooltipAnchor
        side="bottom"
        description={localize('com_ui_contacts_import_csv')}
        render={
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={handlePickFile}
            disabled={importMutation.isLoading}
            aria-label={localize('com_ui_contacts_import_csv')}
          >
            {importMutation.isLoading ? (
              <Spinner className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" aria-hidden />
            )}
            {localize('com_ui_contacts_import_csv')}
          </Button>
        }
      />

      <FilterInput
        inputId="contacts-filter"
        label={localize('com_ui_contacts_search')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        containerClassName="w-full"
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <ul className="flex flex-col gap-2 py-2" role="status" aria-busy="true">
            {Array.from({ length: 6 }).map((_, idx) => (
              <li
                // eslint-disable-next-line react/no-array-index-key
                key={idx}
                className="animate-pulse rounded-lg border border-border-light bg-surface-secondary px-2 py-2"
              >
                <div className="flex items-start gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="mb-1 h-3 w-32 rounded bg-surface-tertiary" />
                    <div className="mb-1 h-2 w-40 rounded bg-surface-tertiary" />
                    <div className="h-2 w-24 rounded bg-surface-tertiary" />
                  </div>
                  <div className="h-5 w-5 rounded-full bg-surface-tertiary" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtered.length === 0 ? (
          <p className="py-4 text-center text-sm text-text-secondary">
            {localize('com_ui_contacts_empty')}
          </p>
        ) : (
          <ul className="flex flex-col gap-2" role="list">
            {filtered.map((c) => (
              <li
                key={c.id}
                className="cursor-pointer rounded-lg border border-border-light bg-surface-secondary px-2 py-2 text-sm transition-colors hover:bg-surface-secondary/80"
                role="listitem"
                onClick={() => handleContactClick(c)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate font-medium text-text-primary">{c.name}</div>
                    {c.email ? (
                      <div className="truncate text-xs text-text-secondary">{c.email}</div>
                    ) : null}
                    {c.company ? (
                      <div className="truncate text-xs text-text-secondary">{c.company}</div>
                    ) : null}
                    {c.phone ? (
                      <div className="truncate text-xs text-text-secondary">{c.phone}</div>
                    ) : null}
                  </div>
                  <TooltipAnchor
                    side="left"
                    description={localize('com_ui_contacts_delete')}
                    render={
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="flex-shrink-0 text-text-secondary hover:text-red-500"
                        aria-label={localize('com_ui_contacts_delete')}
                        disabled={deleteMutation.isLoading}
                        onClick={() => deleteMutation.mutate(c.id)}
                      >
                        ×
                      </Button>
                    }
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
