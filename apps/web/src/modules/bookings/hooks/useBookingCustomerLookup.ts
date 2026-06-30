"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  adminCustomersClient,
  type CustomerProfile,
} from "@/modules/customers";

import { getErrorMessage } from "../utils/bookingFormatters";
import {
  bookingPhoneLocalValue,
  buildManualAttendeePayload,
  isValidBookingPhone,
  normalizeBookingCivilId,
  normalizeBookingPhoneCountryCode,
  normalizeBookingPhone,
  resolveBookingPhoneCountryCode,
} from "../utils/bookingNormalizers";
import { DEFAULT_BOOKING_PHONE_COUNTRY_CODE } from "../constants/bookingUi.constants";
import type { CustomerDraft, LookupStatus } from "../types/bookingUi.types";

export function useBookingCustomerLookup() {
  const inFlightLookupKeyRef = useRef<string | null>(null);
  const lastLookupKeyRef = useRef<string | null>(null);
  const [lookupPhoneCountryCode, setLookupPhoneCountryCode] = useState(
    DEFAULT_BOOKING_PHONE_COUNTRY_CODE,
  );
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
    const countryCode = resolveBookingPhoneCountryCode(customer.phone);

    setLookupCustomer(customer);
    setLookupPhoneCountryCode(countryCode);
    setLookupPhone(bookingPhoneLocalValue(customer.phone, countryCode));
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
    const localPhone = bookingPhoneLocalValue(value, lookupPhoneCountryCode);

    setLookupPhone(localPhone);
    setCustomerDraft((current) => ({
      ...current,
      phone: normalizeBookingPhone(localPhone, lookupPhoneCountryCode),
    }));
  };

  const updateLookupPhoneCountryCode = (value: string) => {
    const countryCode = normalizeBookingPhoneCountryCode(value);

    setLookupPhoneCountryCode(countryCode);
    setLookupCustomer(null);
    setCustomerDraft((current) => ({
      ...current,
      phone: normalizeBookingPhone(lookupPhone, countryCode),
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
    const phone = normalizeBookingPhone(lookupPhone, lookupPhoneCountryCode);
    const civilId = normalizeBookingCivilId(lookupCivilId);
    const civilDigits = civilId.replace(/\D/g, "");
    const canLookupByPhone = isValidBookingPhone(
      lookupPhone,
      lookupPhoneCountryCode,
    );
    const canLookupByCivilId = civilDigits.length === 12;
    const lookupInput = {
      ...(canLookupByPhone ? { phone } : {}),
      ...(canLookupByCivilId ? { civil_id: civilId } : {}),
    };
    const lookupKey = new URLSearchParams(lookupInput).toString();

    if (!canLookupByPhone && !canLookupByCivilId) {
      const reset = window.setTimeout(() => {
        inFlightLookupKeyRef.current = null;
        lastLookupKeyRef.current = null;
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

    if (lookupCustomer) {
      const customerPhone = normalizeBookingPhone(lookupCustomer.phone);
      const customerCivilId = normalizeBookingCivilId(lookupCustomer.civil_id);
      const matchesPhone = !canLookupByPhone || customerPhone === phone;
      const matchesCivilId = !canLookupByCivilId || customerCivilId === civilId;

      if (matchesPhone && matchesCivilId) {
        return;
      }
    }

    if (
      lookupKey &&
      (inFlightLookupKeyRef.current === lookupKey ||
        lastLookupKeyRef.current === lookupKey)
    ) {
      return;
    }

    const controller = new AbortController();
    const request = window.setTimeout(() => {
      inFlightLookupKeyRef.current = lookupKey;
      setLookupStatus({ tone: "loading", message: "Looking up attendee..." });
      void adminCustomersClient
        .lookup(lookupInput, controller.signal)
        .then((result) => {
          lastLookupKeyRef.current = lookupKey;

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
        })
        .finally(() => {
          if (inFlightLookupKeyRef.current === lookupKey) {
            inFlightLookupKeyRef.current = null;
          }
        });
    }, 120);

    return () => {
      window.clearTimeout(request);
      controller.abort();
    };
  }, [
    lookupCivilId,
    lookupCustomer,
    lookupPhone,
    lookupPhoneCountryCode,
    selectCustomer,
  ]);

  return {
    customerDraft,
    isCreatingCustomer,
    lookupCivilId,
    lookupCustomer,
    lookupPhone,
    lookupPhoneCountryCode,
    lookupStatus,
    resolveAttendee,
    updateCustomerDraft,
    updateLookupCivilId,
    updateLookupPhone,
    updateLookupPhoneCountryCode,
  };
}
