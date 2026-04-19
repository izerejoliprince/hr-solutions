"use client";

import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "axios";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: "owner" | "recruiter" | "candidate";
  profilePhotoUrl?: string;
  companyName?: string;
  companyLogoUrl?: string;
}

interface AuthState {
  user: AuthUser | null;
  status: "idle" | "loading" | "succeeded" | "failed";
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  status: "idle",
  error: null,
};

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:4000";

export const login = createAsyncThunk(
  "auth/login",
  async (
    payload: { email: string; password: string },
    { rejectWithValue }: any,
  ) => {
    try {
      const res = await axios.post<AuthUser>(`${API_BASE_URL}/auth/login`, payload, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Login failed";
      return rejectWithValue(message);
    }
  },
);

export const register = createAsyncThunk(
  "auth/register",
  async (
    payload: { email: string; password: string; name: string; role?: AuthUser["role"] },
    { rejectWithValue }: any,
  ) => {
    try {
      const res = await axios.post<AuthUser>(`${API_BASE_URL}/auth/register`, payload, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      const message = err.response?.data?.error ?? "Register failed";
      return rejectWithValue(message);
    }
  },
);

export const logout = createAsyncThunk("auth/logout", async () => {
  await axios.post(
    `${API_BASE_URL}/auth/logout`,
    {},
    {
      withCredentials: true,
    },
  );
  return null;
});

export const initializeAuth = createAsyncThunk(
  "auth/initializeAuth",
  async (_, { rejectWithValue }: any) => {
    try {
      const res = await axios.get<AuthUser>(`${API_BASE_URL}/auth/me`, {
        withCredentials: true,
      });
      return res.data;
    } catch (err: any) {
      const status = err.response?.status;
      if (status === 401) {
        return rejectWithValue("Not authenticated");
      }
      const message = err.response?.data?.error ?? "Failed to initialize auth";
      return rejectWithValue(message);
    }
  },
);

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {},
  extraReducers: (builder: any) => {
    builder
      .addCase(login.pending, (state: AuthState) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state: AuthState, action: any) => {
        state.status = "succeeded";
        state.user = action.payload;
      })
      .addCase(login.rejected, (state: AuthState, action: any) => {
        state.status = "failed";
        state.error = (action.payload as string) ?? "Login failed";
      })
      .addCase(register.pending, (state: AuthState) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(register.fulfilled, (state: AuthState, action: any) => {
        state.status = "succeeded";
        state.user = action.payload;
      })
      .addCase(register.rejected, (state: AuthState, action: any) => {
        state.status = "failed";
        state.error = (action.payload as string) ?? "Register failed";
      })
      .addCase(logout.fulfilled, (state: AuthState) => {
        state.user = null;
        state.status = "idle";
        state.error = null;
      })
      .addCase(initializeAuth.pending, (state: AuthState) => {
        state.status = "loading";
      })
      .addCase(initializeAuth.fulfilled, (state: AuthState, action: any) => {
        state.status = "succeeded";
        state.user = action.payload;
        state.error = null;
      })
      .addCase(initializeAuth.rejected, (state: AuthState, action: any) => {
        state.status = "idle";
        state.user = null;
        state.error = action.payload === "Not authenticated" ? null : ((action.payload as string) ?? null);
      });
  },
});

export default authSlice.reducer;
