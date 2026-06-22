"use client";
import { useEffect, useState } from "react";
export function useDebounce<TValue>(value: TValue, delayMs = 300): TValue { const [debounced, setDebounced] = useState(value); useEffect(() => { const timer = window.setTimeout(() => setDebounced(value), delayMs); return () => window.clearTimeout(timer); }, [delayMs, value]); return debounced; }

