import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ForgotPasswordPage from './page';
import { apiFetch } from '@/lib/api';
import { useRouter } from 'next/navigation';

// Mock the modules
vi.mock('@/lib/api', () => ({
  apiFetch: vi.fn(),
}));

vi.mock('@/components/AuthCarousel', () => ({
  default: () => <div data-testid="auth-carousel">Carousel</div>,
}));

describe('ForgotPasswordPage', () => {
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
    
    // Mock sessionStorage
    const mockSessionStorage = {
      setItem: vi.fn(),
      getItem: vi.fn(),
    };
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true,
    });
  });

  it('renders forgot password form correctly', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('Lupa Password?')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('admin@laporkos.id')).toBeInTheDocument();
  });

  it('submits form successfully and redirects to verify-otp', async () => {
    (apiFetch as any).mockResolvedValue({ message: 'OTP sent' });
    
    render(<ForgotPasswordPage />);
    
    fireEvent.change(screen.getByPlaceholderText('admin@laporkos.id'), {
      target: { value: 'test@example.com' },
    });
    
    fireEvent.click(screen.getByText('Kirim Kode OTP'));

    await waitFor(() => {
      expect(apiFetch).toHaveBeenCalledWith('/api/auth/forgot-password', expect.objectContaining({
        method: 'POST',
      }));
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith('reset_email', 'test@example.com');
      expect(mockPush).toHaveBeenCalledWith('/verify-otp');
    });
  });
});
