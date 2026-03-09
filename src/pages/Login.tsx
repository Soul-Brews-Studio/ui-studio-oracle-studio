import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password.trim()) return;

    setLoading(true);
    setError('');

    try {
      const result = await login(password);
      if (result.success) {
        navigate('/');
      } else {
        setError(result.error || 'Login failed');
      }
    } catch (e) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-60px)] flex items-center justify-center p-6">
      <div className="bg-bg-card border border-border rounded-2xl p-12 max-w-[400px] w-full text-center">
        <div className="text-4xl font-bold text-accent mb-6">Oracle</div>
        <h1 className="text-2xl font-semibold text-text-primary mb-2">Sign In</h1>
        <p className="text-text-secondary text-sm mb-8">Enter your password to access the dashboard</p>

        <form onSubmit={handleSubmit} className="text-left">
          {error && (
            <div className="bg-[rgba(239,68,68,0.1)] border border-[rgba(239,68,68,0.3)] text-[#ef4444] px-4 py-3 rounded-lg text-sm mb-5">
              {error}
            </div>
          )}

          <div className="mb-5">
            <label className="block text-text-secondary text-sm mb-2">Password</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password"
              className="w-full bg-bg-secondary border border-border text-text-primary px-4 py-3.5 rounded-lg text-base font-[inherit] outline-none focus:border-accent transition-colors duration-200 placeholder:text-text-muted"
              autoFocus
            />
          </div>

          <button
            type="submit"
            disabled={loading || !password.trim()}
            className="w-full bg-accent border-none text-white py-4 rounded-lg text-base font-medium cursor-pointer transition-colors duration-200 hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}
