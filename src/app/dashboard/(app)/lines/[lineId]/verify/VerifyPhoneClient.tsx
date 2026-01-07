'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ShieldCheck, MessageSquare, Phone, ArrowLeft, CheckCircle } from 'lucide-react';
import { startPhoneVerification, checkPhoneVerification } from '~/lib/ultaura/verification';

interface VerifyPhoneClientProps {
  lineId: string;
  lineShortId: string;
  phoneNumber: string;
  disabled?: boolean;
}

export function VerifyPhoneClient({
  lineId,
  lineShortId,
  phoneNumber,
  disabled = false,
}: VerifyPhoneClientProps) {
  const router = useRouter();
  const [step, setStep] = useState<'choose' | 'enter' | 'success'>('choose');
  const [channel, setChannel] = useState<'sms' | 'call'>('sms');
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Focus first input when entering code step
  useEffect(() => {
    if (step === 'enter' && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [step]);

  if (disabled) {
    return (
      <div className="max-w-md w-full mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-muted-foreground" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Verification unavailable</h2>
        <p className="text-muted-foreground mt-2">
          Subscribe to verify this phone number and continue using Ultaura.
        </p>
        <Link
          href="/dashboard/settings/subscription"
          className="inline-flex items-center justify-center rounded-lg bg-primary px-5 py-3 text-primary-foreground font-medium hover:bg-primary/90 transition-colors mt-6"
        >
          Choose a Plan
        </Link>
      </div>
    );
  }

  const handleSendCode = async (selectedChannel: 'sms' | 'call') => {
    setChannel(selectedChannel);
    setIsLoading(true);
    setError(null);

    try {
      const result = await startPhoneVerification(lineId, selectedChannel);

      if (result.success) {
        setStep('enter');
      } else {
        setError(result.error.message || 'Failed to send verification code');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCodeChange = (index: number, value: string) => {
    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newCode.every((d) => d) && value) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setCode(pasted.split(''));
      handleVerify(pasted);
    }
  };

  const handleVerify = async (verificationCode: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await checkPhoneVerification(lineId, verificationCode);

      if (result.success) {
        setStep('success');
        // Redirect after a short delay
        setTimeout(() => {
          router.push(`/dashboard/lines/${lineShortId}/schedule`);
        }, 2000);
      } else {
        setError(result.error.message || 'Invalid verification code');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (err) {
      setError('Verification check failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = () => {
    setCode(['', '', '', '', '', '']);
    setError(null);
    handleSendCode(channel);
  };

  if (step === 'success') {
    return (
      <div className="max-w-md w-full mx-auto text-center">
        <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mx-auto mb-6">
          <CheckCircle className="w-8 h-8 text-success" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground mb-2">Verified!</h2>
        <p className="text-muted-foreground">
          Phone number verified successfully. Setting up call schedule...
        </p>
      </div>
    );
  }

  if (step === 'enter') {
    return (
      <div className="max-w-md w-full mx-auto">
        <button
          onClick={() => setStep('choose')}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-foreground">Enter verification code</h2>
          <p className="text-muted-foreground mt-2">
            We {channel === 'sms' ? 'sent' : 'called'} a 6-digit code to {phoneNumber}
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
            {error}
          </div>
        )}

        <div className="flex justify-center gap-2 mb-6" onPaste={handlePaste}>
          {code.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleCodeChange(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              disabled={isLoading}
              className="w-12 h-14 text-center text-xl font-semibold border border-input rounded-lg bg-background text-foreground focus:border-primary focus:ring-2 focus:ring-ring disabled:opacity-50 transition-colors"
            />
          ))}
        </div>

        <button
          onClick={() => handleVerify(code.join(''))}
          disabled={isLoading || code.some((d) => !d)}
          className="w-full py-3 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Verifying...' : 'Verify'}
        </button>

        <p className="text-center text-sm text-muted-foreground mt-4">
          Didn&apos;t receive a code?{' '}
          <button
            onClick={handleResend}
            disabled={isLoading}
            className="text-primary hover:underline disabled:opacity-50"
          >
            Resend
          </button>
        </p>
      </div>
    );
  }

  // Choose channel step
  return (
    <div className="max-w-md w-full mx-auto">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-2xl font-semibold text-foreground">Verify phone number</h2>
        <p className="text-muted-foreground mt-2">
          We&apos;ll send a code to {phoneNumber}
        </p>
      </div>

      {error && (
        <div className="mb-6 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center">
          {error}
        </div>
      )}

      <div className="space-y-4">
        <div className="flex gap-3">
          <button
            onClick={() => handleSendCode('sms')}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <MessageSquare className="w-5 h-5" />
            Text me
          </button>
          <button
            onClick={() => handleSendCode('call')}
            disabled={isLoading}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-lg border border-input bg-background text-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <Phone className="w-5 h-5" />
            Call me
          </button>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          For landlines, choose &quot;Call me&quot; to receive a voice code.
        </p>
      </div>
    </div>
  );
}
