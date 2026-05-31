import React from 'react';
import { render, screen } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import adminReducer from '@/store/adminSlice';
import ModerationPage from '@/app/admin/moderation/page';

describe('ModerationPage', () => {
  it('renders the moderation page', () => {
    const store = configureStore({
      reducer: {
        admin: adminReducer,
      },
    });

    render(
      <Provider store={store}>
        <ModerationPage />
      </Provider>
    );

    expect(screen.getByText('Moderation')).toBeTruthy();
  });

  it('displays moderation queue section', () => {
    const store = configureStore({
      reducer: {
        admin: adminReducer,
      },
    });

    render(
      <Provider store={store}>
        <ModerationPage />
      </Provider>
    );

    expect(screen.getByText('Moderation Queue')).toBeTruthy();
  });

  it('displays flagged content section', () => {
    const store = configureStore({
      reducer: {
        admin: adminReducer,
      },
    });

    render(
      <Provider store={store}>
        <ModerationPage />
      </Provider>
    );

    expect(screen.getByText('Flagged Content')).toBeTruthy();
  });

  it('displays recent actions section', () => {
    const store = configureStore({
      reducer: {
        admin: adminReducer,
      },
    });

    render(
      <Provider store={store}>
        <ModerationPage />
      </Provider>
    );

    expect(screen.getByText('Recent Actions')).toBeTruthy();
  });

  it('updates current page to Moderation on mount', () => {
    const store = configureStore({
      reducer: {
        admin: adminReducer,
      },
    });

    render(
      <Provider store={store}>
        <ModerationPage />
      </Provider>
    );

    const state = store.getState();
    expect(state.admin.currentPage).toBe('Moderation');
  });
});
