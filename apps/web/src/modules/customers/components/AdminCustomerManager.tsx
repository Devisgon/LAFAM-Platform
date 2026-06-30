"use client";

import { type FormEvent, useState } from "react";
import { Plus } from "lucide-react";
import { Toast } from "@/components/ui/Toast";

import { adminCustomersClient } from "../api/customersApi";
import type { ResultToast } from "../types/customerUi.types";
import {
  buildCreatePayload,
  getErrorMessage,
} from "../utils/customerPayload";
import { CustomerCreateForm } from "./customer-management/CustomerCreateForm";

export function AdminCustomerManager() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [toast, setToast] = useState<ResultToast | null>(null);

  const submitCustomer = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsCreating(true);
    try {
      const created = await adminCustomersClient.create(
        buildCreatePayload(new FormData(event.currentTarget)),
      );

      event.currentTarget.reset();
      setIsCreateOpen(false);
      setToast({
        title: "Customer user created",
        message: `${created.full_name} can log in immediately.`,
        tone: "success",
      });
      window.dispatchEvent(new CustomEvent("lafam:users:changed"));
    } catch (requestError: unknown) {
      setToast({
        title: "Customer user not created",
        message: getErrorMessage(requestError),
        tone: "error",
      });
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <section aria-label="Customer user creation" className="grid gap-5">
        {isCreateOpen ? (
          <CustomerCreateForm
            isSaving={isCreating}
            onCancel={() => setIsCreateOpen(false)}
            onSubmit={submitCustomer}
          />
        ) : (
          <section className="flex flex-col gap-4 rounded-md bg-card-bg-primary px-5 py-5 shadow-sm md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-2xl font-medium">Add Customer User</h2>
              <p className="mt-1 text-sm text-txt-secondary">
                Create a verified customer user account. The user list below remains the single account list.
              </p>
            </div>
            <button
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-sm bg-button-primary px-5 text-base font-semibold text-txt-primary transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              onClick={() => setIsCreateOpen(true)}
              type="button"
            >
              <Plus aria-hidden="true" size={18} />
              Add customer user
            </button>
          </section>
        )}
      </section>

      {toast ? (
        <div className="fixed right-4 top-4 z-[90]">
          <Toast
            onDismiss={() => setToast(null)}
            title={toast.title}
            tone={toast.tone}
          >
            {toast.message}
          </Toast>
        </div>
      ) : null}
    </>
  );
}
