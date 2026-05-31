import { createSlice, PayloadAction } from '@reduxjs/toolkit';

interface AdminState {
  currentPage: string;
}

const initialState: AdminState = {
  currentPage: 'dashboard',
};

const adminSlice = createSlice({
  name: 'admin',
  initialState,
  reducers: {
    setCurrentPage: (state, action: PayloadAction<{ pageName: string; routePath: string }>) => {
      state.currentPage = action.payload.pageName;
    },
  },
});

export const { setCurrentPage } = adminSlice.actions;
export default adminSlice.reducer;
