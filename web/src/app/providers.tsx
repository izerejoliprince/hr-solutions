"use client";

import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { store } from "../store";
import { initializeAuth } from "../store/slices/authSlice";

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void store.dispatch(initializeAuth() as any);
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
