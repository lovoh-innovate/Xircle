import { createSlice } from "@reduxjs/toolkit";

const storedUser = localStorage.getItem("userInfo");

const initialState = {
  userInfo: storedUser ? JSON.parse(storedUser) : null,
};

const authSlice = createSlice({
  name: "auth",

  initialState,

  reducers: {
    setCredentials: (state, action) => {
      // IMPORTANT:
      // Merge new user data with the existing auth data
      // so the JWT token is never accidentally removed.
      state.userInfo = {
        ...state.userInfo,
        ...action.payload,
      };

      localStorage.setItem(
        "userInfo",
        JSON.stringify(state.userInfo)
      );
    },

    logout: (state) => {
      state.userInfo = null;
      localStorage.removeItem("userInfo");
    },
  },
});

export const { setCredentials, logout } = authSlice.actions;

export default authSlice.reducer;