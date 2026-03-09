import { useState } from 'react';
import { api } from '../services/api';

export default function Admin() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [message, setMessage] = useState('');

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('sending');
    setMessage('');

    try {
      const res = await api.post<{ success: boolean; message: string }>(
        '/admin/email/test',
        { to: email }
      );
      setStatus('success');
      setMessage(res.data.message);
    } catch {
      setStatus('error');
      setMessage('Failed to send test email. Check server logs.');
    }
  };

  return (
    <div className="max-w-lg mx-auto">
      <h1 className="text-2xl font-bold mb-6">Admin Panel</h1>

      <section className="border rounded-lg p-6">
        <h2 className="text-lg font-semibold mb-4">Email Testing</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Send a test email to verify the email service is configured correctly.
        </p>

        <form onSubmit={handleSend} className="space-y-4">
          <div>
            <label htmlFor="test-email" className="block text-sm font-medium mb-1">
              Email Address
            </label>
            <input
              id="test-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="recipient@example.com"
              className="w-full border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <button
            type="submit"
            disabled={status === 'sending'}
            className="w-full bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium hover:bg-primary/90 disabled:opacity-50"
          >
            {status === 'sending' ? 'Sending\u2026' : 'Send Test Email'}
          </button>
        </form>

        {status === 'success' && (
          <p className="mt-3 text-sm text-green-600">{message}</p>
        )}
        {status === 'error' && (
          <p className="mt-3 text-sm text-destructive">{message}</p>
        )}
      </section>
    </div>
  );
}
