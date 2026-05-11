import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './page';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

// Mock the modules
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/lib/auth', () => ({
  setToken: vi.fn(),
}));

vi.mock('@/components/AuthCarousel', () => ({
  default: () => <div data-testid="auth-carousel">Carousel</div>,
}));

describe('LoginPage', () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useRouter).mockReturnValue({
      push: mockPush,
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
      forward: vi.fn(),
      refresh: vi.fn(),
    } as any);
  });

  it('renders login form correctly', () => {
    render(<LoginPage />);
    expect(screen.getByText('Masuk ke akun Anda')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@laporkos.id')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Masukkan password')).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    render(<LoginPage />);
    const submitButton = screen.getByText('Masuk Sekarang');
    
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Format email tidak valid')).toBeInTheDocument();
      expect(screen.getByText('Password minimal 6 karakter')).toBeInTheDocument();
    });
  });

  it('submits form successfully and redirects', async () => {
    (apiFetch as any).mockResolvedValue({ token: 'fake-token' });
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByPlaceholderText('admin@laporkos.id'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Masukkan password'), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByText('Masuk Sekarang'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
        method: 'POST',
      }));
      expect(mockPush).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message on login failure', async () => {
    (apiFetch as any).mockRejectedValue(new Error('Invalid credentials'));
    
    render(<LoginPage />);
    
    fireEvent.change(screen.getByPlaceholderText('admin@laporkos.id'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Masukkan password'), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByText('Masuk Sekarang'));

    await waitFor(() => {
      expect(screen.getByText('Invalid credentials')).toBeInTheDocument();
    });
  });
});
