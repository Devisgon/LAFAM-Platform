"use client";

import { useCallback, useEffect, useState } from "react";
import { adminCustomersClient, type CustomerProfile } from "@/modules/customers";

import { getErrorMessage } from "../utils/bookingFormatters";
import {
  bookingPhoneLocalValue,
  buildManualAttendeePayload,
  isValidKuwaitBookingPhone,
  normalizeBookingCivilId,
  normalizeBookingPhone,
} from "../utils/bookingNormalizers";
import type { CustomerDraft, LookupStatus } from "../types/bookingUi.types";

export function useBookingCustomerLookup() {
  const [lookupPhone, setLookupPhone] = useState("");
  const [lookupCivilId, setLookupCivilId] = useState("");
  const [lookupCustomer, setLookupCustomer] = useState<CustomerProfile | null>(
    null,
  );
  const [customerDraft, setCustomerDraft] = useState<CustomerDraft>({
    civilId: "",
    email: "",
    fullName: "",
    phone: "",
    timezone: "Asia/Kuwait",
  });
  const [lookupStatus, setLookupStatus] = useState<LookupStatus>({
    tone: "idle",
    message: "Enter phone or Civil ID to find an attendee.",
  });
  const [isCreatingCustomer, setIsCreatingCustomer] = useState(false);

  const selectCustomer = useCallback((customer: CustomerProfile) => {
    setLookupCustomer(customer);
    setLookupPhone(bookingPhoneLocalValue(customer.phone));
    setLookupCivilId(customer.civil_id);
    setCustomerDraft({
      civilId: customer.civil_id,
      email: customer.email,
      fullName: customer.full_name,
      phone: customer.phone,
      timezone: customer.timezone ?? "Asia/Kuwait",
    });
  }, []);

  const updateLookupPhone = (value: string) => {
    const localPhone = bookingPhoneLocalValue(value);

    setLookupPhone(localPhone);
    setCustomerDraft((current) => ({
      ...current,
      phone: normalizeBookingPhone(localPhone),
    }));
  };

  const updateLookupCivilId = (value: string) => {
    setLookupCivilId(value);
    setCustomerDraft((current) => ({
      ...current,
      civilId: normalizeBookingCivilId(value),
    }));
  };

  const updateCustomerDraft = (field: keyof CustomerDraft, value: string) => {
    setCustomerDraft((current) => ({ ...current, [field]: value }));
  };

  const resolveAttendee = async (
    form: HTMLFormElement,
  ): Promise<CustomerProfile> => {
    if (lookupCustomer) {
      return lookupCustomer;
    }

    setIsCreatingCustomer(true);
    try {
      const createdCustomer = await adminCustomersClient.create(
        buildManualAttendeePayload(new FormData(form)),
      );

      selectCustomer(createdCustomer);
      setLookupStatus({
        tone: "success",
        message: `${createdCustomer.full_name} was added and selected.`,
      });
      window.dispatchEvent(new CustomEvent("lafam:users:changed"));
      return createdCustomer;
    } catch (requestError: unknown) {
      setLookupStatus({
        tone: "error",
        message: getErrorMessage(requestError),
      });
      throw requestError;
    } finally {
      setIsCreatingCustomer(false);
    }
  };

  useEffect(() => {
    const phone = normalizeBookingPhone(lookupPhone);
    const civilId = normalizeBookingCivilId(lookupCivilId);
    const civilDigits = civilId.replace(/\D/g, "");
    const canLookupByPhone = isValidKuwaitBookingPhone(phone);
    const canLookupByCivilId = civilDigits.length === 12;

    if (!canLookupByPhone && !canLookupByCivilId) {
      const reset = window.setTimeout(() => {
        setLookupCustomer(null);
        setLookupStatus({
          tone: civilDigits.length > 0 ? "warning" : "idle",
          message:
            civilDigits.length > 0
              ? "Invalid Civil ID."
              : "Enter phone or Civil ID to find an attendee.",
        });
      }, 0);

      return () => window.clearTimeout(reset);
    }

    const controller = new AbortController();
    const request = window.setTimeout(() => {
      setLookupStatus({ tone: "loading", message: "Looking up attendee..." });
      void adminCustomersClient
        .lookup(
          {
            ...(canLookupByPhone ? { phone } : {}),
            ...(canLookupByCivilId ? { civil_id: civilId } : {}),
          },
          controller.signal,
        )
        .then((result) => {
          if (!result.customer) {
            setLookupCustomer(null);
            setCustomerDraft((current) => ({
              ...current,
              civilId,
              email: "",
              fullName: "",
              phone,
            }));
            setLookupStatus({
              tone: "warning",
              message:
                "No attendee matched those details. Complete the form, then add the attendee.",
            });
            return;
          }

          selectCustomer(result.customer);
          setLookupStatus({
            tone: "success",
            message: `${result.customer.full_name} found and selected.`,
          });
        })
        .catch((requestError: unknown) => {
          if (
            requestError instanceof DOMException &&
            requestError.name === "AbortError"
          ) {
            return;
          }

          setLookupCustomer(null);
          setLookupStatus({
            tone: "error",
            message: getErrorMessage(requestError),
          });
        });
    }, 120);

    return () => {
      window.clearTimeout(request);
      controller.abort();
    };
  }, [lookupCivilId, lookupPhone, selectCustomer]);

  return {
    customerDraft,
    isCreatingCustomer,
    lookupCivilId,
    lookupCustomer,
    lookupPhone,
    lookupStatus,
    resolveAttendee,
    updateCustomerDraft,
    updateLookupCivilId,
    updateLookupPhone,
  };
}
