import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { toast } from 'sonner';
import { ShoppingBag } from 'lucide-react';
import { SEO } from '@/components/common/SEO';

export default function Login() {
  const { signIn, signUp } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, fullName);
        toast.success('অ্যাকাউন্ট তৈরি হয়েছে! ইমেইল ভেরিফাই করুন।');
      } else {
        await signIn(email, password);
        toast.success('সফলভাবে লগইন হয়েছে!');
      }
    } catch (error: any) {
      toast.error(error.message || 'কিছু ভুল হয়েছে');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <SEO
        title="লগইন"
        description="DBH Inventory অ্যাকাউন্টে লগইন করুন — মাল্টি-ব্রাঞ্চ ইনভেন্টরি ও পয়েন্ট অফ সেল ম্যানেজমেন্ট সিস্টেম।"
        path="/login"
      />
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <ShoppingBag className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold font-heading text-foreground">দুবাই বোরকা হাউজ</h1>
          <p className="text-muted-foreground mt-2">ইনভেন্টরি ম্যানেজমেন্ট সিস্টেম</p>
        </div>

        <Card className="border-border shadow-xl">
          <CardHeader className="text-center pb-2">
            <h2 className="text-xl font-semibold font-heading">
              {isSignUp ? 'নতুন অ্যাকাউন্ট' : 'লগইন করুন'}
            </h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && (
                <div>
                  <Label htmlFor="fullName">পূর্ণ নাম</Label>
                  <Input id="fullName" value={fullName} onChange={e => setFullName(e.target.value)} placeholder="আপনার নাম" required />
                </div>
              )}
              <div>
                <Label htmlFor="email">ইমেইল</Label>
                <Input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="email@example.com" required />
              </div>
              <div>
                <Label htmlFor="password">পাসওয়ার্ড</Label>
                <Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'অপেক্ষা করুন...' : isSignUp ? 'অ্যাকাউন্ট তৈরি করুন' : 'লগইন'}
              </Button>
            </form>
            <div className="text-center mt-4">
              <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="text-sm text-primary hover:underline">
                {isSignUp ? 'ইতিমধ্যে অ্যাকাউন্ট আছে? লগইন করুন' : 'নতুন অ্যাকাউন্ট তৈরি করুন'}
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
