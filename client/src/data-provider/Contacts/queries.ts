import {
  QueryKeys,
  MutationKeys,
  dataService,
  type ContactsListResponse,
  type ContactsImportResponse,
  type TContact,
} from 'librechat-data-provider';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import type { UseQueryOptions, UseMutationOptions, QueryObserverResult } from '@tanstack/react-query';

export const useContactsQuery = (
  params?: { q?: string },
  config?: UseQueryOptions<ContactsListResponse>,
): QueryObserverResult<ContactsListResponse> => {
  return useQuery<ContactsListResponse>(
    [QueryKeys.contacts, params?.q ?? ''],
    () => dataService.getContacts(params),
    {
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      ...config,
    },
  );
};

export const useImportContactsCsvMutation = (
  options?: UseMutationOptions<ContactsImportResponse, Error, FormData>,
) => {
  const queryClient = useQueryClient();
  return useMutation<ContactsImportResponse, Error, FormData>(
    [MutationKeys.importContactsCsv],
    (formData) => dataService.importContactsCsv(formData),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([QueryKeys.contacts]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export const useDeleteContactMutation = (
  options?: UseMutationOptions<void, Error, string>,
) => {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>(
    (id) => dataService.deleteContact(id),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([QueryKeys.contacts]);
        options?.onSuccess?.(...args);
      },
    },
  );
};

export type CreateContactInput = {
  name: string;
  email?: string;
  phone?: string;
  company?: string;
  notes?: string;
};

export const useCreateContactMutation = (
  options?: UseMutationOptions<{ contact: TContact }, Error, CreateContactInput>,
) => {
  const queryClient = useQueryClient();
  return useMutation<{ contact: TContact }, Error, CreateContactInput>(
    (data) => dataService.createContact(data),
    {
      ...options,
      onSuccess: (...args) => {
        queryClient.invalidateQueries([QueryKeys.contacts]);
        options?.onSuccess?.(...args);
      },
    },
  );
};
