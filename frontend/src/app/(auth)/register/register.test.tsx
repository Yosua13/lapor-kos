import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RegisterPage from './page';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

// Mock the modules
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/components/AuthCarousel', () => ({
  default: () => <div data-testid="auth-carousel">Carousel</div>,
}));

describe('RegisterPage', () => {
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

  it('renders register form correctly', () => {
    render(<RegisterPage />);
    expect(screen.getByText('Daftar Akun Baru')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Masukkan nama lengkap')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@laporkos.id')).toBeInTheDocument();
  });

  it('shows validation errors for empty fields', async () => {
    render(<RegisterPage />);
    const submitButton = screen.getByText('Daftar Sekarang');
    
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Nama minimal 3 karakter')).toBeInTheDocument();
      expect(screen.getByText('Format email tidak valid')).toBeInTheDocument();
      expect(screen.getByText('Password minimal 6 karakter')).toBeInTheDocument();
    });
  });

  it('submits form successfully and shows popup', async () => {
    (apiFetch as any).mockResolvedValue({ message: 'Success' });
    
    render(<RegisterPage />);
    
    fireEvent.change(screen.getByPlaceholderText('Masukkan nama lengkap'), {
      target: { value: 'Test User' },
    });
    fireEvent.change(screen.getByPlaceholderText('admin@laporkos.id'), {
      target: { value: 'test@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('Minimal 6 karakter'), {
      target: { value: 'password123' },
    });
    
    fireEvent.click(screen.getByText('Daftar Sekarang'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
        method: 'POST',
      }));
      expect(screen.getByText('Cek Email Anda')).toBeInTheDocument();
    });
  });
});
