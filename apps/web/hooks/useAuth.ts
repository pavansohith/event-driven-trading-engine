import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getMe, User } from '@/lib/auth';

/**
 * Hook for protected routes that checks authentication
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      try {
        const currentUser = await getMe();
        setUser(currentUser);
      } catch (error: any) {
        // The axios interceptor will handle token refresh automatically
        // Only redirect if refresh also fails (handled by interceptor)
        // If we get here, it means the request failed but refresh might be in progress
        if (error.response?.status === 401) {
          // Don't redirect immediately - let the interceptor try to refresh first
          // The interceptor will redirect if refresh fails
          console.log('Authentication check failed, refresh token will be attempted');
        }
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  return { user, loading };
}

