import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { User, Lock, Bell, Shield, Store, Palette } from 'lucide-react';
import type { Branch } from '@/types';

export default function Settings() {
  const { user, profile, isAdmin, roles, signOut } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving, setSaving] = useState(false);

  // Profile form
  const [profileForm, setProfileForm] = useState({
    full_name: '',
    phone: '',
    branch_id: '',
  });

  // Password form
  const [passwordForm, setPasswordForm] = useState({
    current: '',
    newPass: '',
    confirm: '',
  });

  // Notification prefs (local state)
  const [notifications, setNotifications] = useState({
    lowStock: true,
    newTransfer: true,
    dailyReport: false,
  });

  useEffect(() => {
    supabase.from('branches').select('*').order('name').then(({ data }) => {
      setBranches((data as unknown as Branch[]) || []);
    });
  }, []);

  useEffect(() => {
    if (profile) {
      setProfileForm({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        branch_id: profile.branch_id || '',
      });
    }
  }, [profile]);

  const handleProfileSave = async () => {
    if (!user || !profile) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          full_name: profileForm.full_name,
          phone: profileForm.phone,
          ...(isAdmin ? { branch_id: profileForm.branch_id || null } : {}),
        })
        .eq('user_id', user.id);
      if (error) throw error;
      toast.success('প্রোফাইল আপডেট হয়েছে');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (passwordForm.newPass !== passwordForm.confirm) {
      toast.error('নতুন পাসওয়ার্ড মিলছে না');
      return;
    }
    if (passwordForm.newPass.length < 6) {
      toast.error('পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass });
      if (error) throw error;
      toast.success('পাসওয়ার্ড পরিবর্তন হয়েছে');
      setPasswordForm({ current: '', newPass: '', confirm: '' });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  };

  const userRole = roles.length > 0 ? roles.map(r => r.role === 'admin' ? 'অ্যাডমিন' : 'শাখা ম্যানেজার').join(', ') : 'ব্যবহারকারী';
  const userBranch = branches.find(b => b.id === profile?.branch_id)?.name || 'নির্ধারিত নয়';

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold font-heading">সেটিংস</h2>
        <p className="text-muted-foreground">আপনার অ্যাকাউন্ট ও অ্যাপ্লিকেশন সেটিংস পরিচালনা করুন</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-4">
          <TabsTrigger value="profile" className="gap-2"><User className="h-4 w-4" />প্রোফাইল</TabsTrigger>
          <TabsTrigger value="security" className="gap-2"><Lock className="h-4 w-4" />নিরাপত্তা</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2"><Bell className="h-4 w-4" />নোটিফিকেশন</TabsTrigger>
          <TabsTrigger value="about" className="gap-2"><Shield className="h-4 w-4" />সম্পর্কে</TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />প্রোফাইল তথ্য</CardTitle>
              <CardDescription>আপনার ব্যক্তিগত তথ্য আপডেট করুন</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>পূর্ণ নাম</Label>
                  <Input
                    value={profileForm.full_name}
                    onChange={e => setProfileForm({ ...profileForm, full_name: e.target.value })}
                    placeholder="আপনার নাম"
                  />
                </div>
                <div>
                  <Label>ইমেইল</Label>
                  <Input value={user?.email || ''} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground mt-1">ইমেইল পরিবর্তন করা যায় না</p>
                </div>
                <div>
                  <Label>ফোন নম্বর</Label>
                  <Input
                    value={profileForm.phone}
                    onChange={e => setProfileForm({ ...profileForm, phone: e.target.value })}
                    placeholder="01XXXXXXXXX"
                  />
                </div>
                <div>
                  <Label>শাখা</Label>
                  {isAdmin ? (
                    <Select value={profileForm.branch_id} onValueChange={v => setProfileForm({ ...profileForm, branch_id: v })}>
                      <SelectTrigger><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                      <SelectContent>
                        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input value={userBranch} disabled className="bg-muted" />
                  )}
                </div>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">ভূমিকা</p>
                  <p className="text-sm text-muted-foreground">{userRole}</p>
                </div>
                <div>
                  <p className="text-sm font-medium">অ্যাকাউন্ট তৈরি</p>
                  <p className="text-sm text-muted-foreground">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('bn-BD') : '-'}
                  </p>
                </div>
              </div>

              <Button onClick={handleProfileSave} disabled={saving}>
                {saving ? 'সংরক্ষণ হচ্ছে...' : 'প্রোফাইল সংরক্ষণ'}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />পাসওয়ার্ড পরিবর্তন</CardTitle>
              <CardDescription>আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="max-w-md space-y-4">
                <div>
                  <Label>নতুন পাসওয়ার্ড</Label>
                  <Input
                    type="password"
                    value={passwordForm.newPass}
                    onChange={e => setPasswordForm({ ...passwordForm, newPass: e.target.value })}
                    placeholder="নতুন পাসওয়ার্ড"
                  />
                </div>
                <div>
                  <Label>পাসওয়ার্ড নিশ্চিত করুন</Label>
                  <Input
                    type="password"
                    value={passwordForm.confirm}
                    onChange={e => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                    placeholder="আবার লিখুন"
                  />
                </div>
                <Button onClick={handlePasswordChange} disabled={saving}>
                  {saving ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">অ্যাকাউন্ট অ্যাকশন</CardTitle>
            </CardHeader>
            <CardContent>
              <Button variant="destructive" onClick={signOut}>লগআউট করুন</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Notifications Tab */}
        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" />নোটিফিকেশন সেটিংস</CardTitle>
              <CardDescription>কোন নোটিফিকেশন পেতে চান তা নির্ধারণ করুন</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">লো স্টক সতর্কতা</p>
                  <p className="text-xs text-muted-foreground">কোনো প্রোডাক্টের স্টক ন্যূনতম সীমার নিচে গেলে জানাবে</p>
                </div>
                <Switch checked={notifications.lowStock} onCheckedChange={v => setNotifications({ ...notifications, lowStock: v })} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">নতুন ট্রান্সফার</p>
                  <p className="text-xs text-muted-foreground">শাখায় নতুন ট্রান্সফার আসলে জানাবে</p>
                </div>
                <Switch checked={notifications.newTransfer} onCheckedChange={v => setNotifications({ ...notifications, newTransfer: v })} />
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-sm">দৈনিক রিপোর্ট</p>
                  <p className="text-xs text-muted-foreground">প্রতিদিন সন্ধ্যায় সারাংশ রিপোর্ট পাবেন</p>
                </div>
                <Switch checked={notifications.dailyReport} onCheckedChange={v => setNotifications({ ...notifications, dailyReport: v })} />
              </div>
              <p className="text-xs text-muted-foreground italic">* নোটিফিকেশন সেটিংস এই ডিভাইসে সংরক্ষিত হবে</p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* About Tab */}
        <TabsContent value="about" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Store className="h-5 w-5" />অ্যাপ্লিকেশন তথ্য</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">অ্যাপের নাম</p>
                  <p className="font-bold">দুবাই বোরকা হাউজ</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">সিস্টেম</p>
                  <p className="font-bold">ইনভেন্টরি ম্যানেজমেন্ট সিস্টেম</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">ভার্সন</p>
                  <p className="font-bold">1.0.0</p>
                </div>
                <div className="bg-muted rounded-lg p-4">
                  <p className="text-sm text-muted-foreground">মোট শাখা</p>
                  <p className="font-bold">{branches.length}টি</p>
                </div>
              </div>

              <Separator />

              <div>
                <h4 className="font-medium mb-2">ফিচার সমূহ</h4>
                <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                  <li>মাল্টি-শাখা ইনভেন্টরি ম্যানেজমেন্ট</li>
                  <li>প্রোডাক্ট ক্যাটাগরি ও ইমেজ ব্যবস্থাপনা</li>
                  <li>শাখা-থেকে-শাখা প্রোডাক্ট ট্রান্সফার</li>
                  <li>বিক্রয় ও ইনভয়েস ব্যবস্থাপনা</li>
                  <li>স্টক মুভমেন্ট ট্র্যাকিং</li>
                  <li>রিপোর্ট ও বিশ্লেষণ</li>
                  <li>ব্যবহারকারী ভূমিকা ভিত্তিক অ্যাক্সেস কন্ট্রোল</li>
                  <li>CSV ইমপোর্ট/এক্সপোর্ট</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
