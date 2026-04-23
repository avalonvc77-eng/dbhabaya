import { useState, useEffect, useRef } from 'react';
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
import { User, Lock, Bell, Shield, Store, Eye, EyeOff, CheckCircle, Download, Upload, RotateCcw, AlertTriangle, Database, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import type { Branch } from '@/types';

export default function Settings() {
  const { user, profile, isAdmin, roles, signOut, session } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);

  // Profile
  const [profileForm, setProfileForm] = useState({ full_name: '', phone: '', branch_id: '' });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileErrors, setProfileErrors] = useState<Record<string, string>>({});

  // Password
  const [passwordForm, setPasswordForm] = useState({ newPass: '', confirm: '' });
  const [showPass, setShowPass] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({});

  // Notifications
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem('notification_prefs');
      return saved ? JSON.parse(saved) : { lowStock: true, newTransfer: true, dailyReport: false };
    } catch { return { lowStock: true, newTransfer: true, dailyReport: false }; }
  });
  const [notifSaving, setNotifSaving] = useState(false);

  // Backup/Restore
  const [backupLoading, setBackupLoading] = useState(false);
  const [restoreLoading, setRestoreLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');
  const restoreFileRef = useRef<HTMLInputElement>(null);

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

  // Profile validation & save
  const validateProfile = () => {
    const errors: Record<string, string> = {};
    if (!profileForm.full_name.trim()) errors.full_name = 'নাম আবশ্যক';
    if (profileForm.phone && !/^01\d{9}$/.test(profileForm.phone.replace(/\s/g, ''))) {
      errors.phone = 'সঠিক ফোন নম্বর দিন (01XXXXXXXXX)';
    }
    setProfileErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleProfileSave = async () => {
    if (!validateProfile() || !user) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase.from('profiles').update({
        full_name: profileForm.full_name.trim(),
        phone: profileForm.phone.trim() || null,
        ...(isAdmin ? { branch_id: profileForm.branch_id || null } : {}),
      }).eq('user_id', user.id);
      if (error) throw error;
      toast.success('প্রোফাইল সফলভাবে আপডেট হয়েছে');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setProfileSaving(false);
    }
  };

  // Password validation & save
  const validatePassword = () => {
    const errors: Record<string, string> = {};
    if (passwordForm.newPass.length < 6) errors.newPass = 'কমপক্ষে ৬ অক্ষর হতে হবে';
    if (passwordForm.newPass !== passwordForm.confirm) errors.confirm = 'পাসওয়ার্ড মিলছে না';
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordChange = async () => {
    if (!validatePassword()) return;
    setPasswordSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: passwordForm.newPass });
      if (error) throw error;
      toast.success('পাসওয়ার্ড সফলভাবে পরিবর্তন হয়েছে');
      setPasswordForm({ newPass: '', confirm: '' });
      setPasswordErrors({});
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setPasswordSaving(false);
    }
  };

  // Notification save
  const handleNotifSave = () => {
    setNotifSaving(true);
    localStorage.setItem('notification_prefs', JSON.stringify(notifications));
    setTimeout(() => {
      setNotifSaving(false);
      toast.success('নোটিফিকেশন সেটিংস সংরক্ষিত হয়েছে');
    }, 300);
  };

  // Backup export
  const handleBackupExport = async () => {
    setBackupLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-backup', {
        body: { action: 'export' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'ব্যাকআপ ব্যর্থ');

      const blob = new Blob([JSON.stringify(data.backup, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('ব্যাকআপ ফাইল ডাউনলোড হচ্ছে');
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBackupLoading(false);
    }
  };

  // Backup restore
  const handleRestoreFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setRestoreLoading(true);
    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      if (!backupData.version || !backupData.data) {
        throw new Error('অবৈধ ব্যাকআপ ফাইল ফরম্যাট');
      }

      const { data, error } = await supabase.functions.invoke('data-backup', {
        body: { action: 'restore', backupData },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'পুনরুদ্ধার ব্যর্থ');

      toast.success(data.message);
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setRestoreLoading(false);
      if (restoreFileRef.current) restoreFileRef.current.value = '';
    }
  };

  // Factory reset
  const handleFactoryReset = async () => {
    if (resetConfirmText !== 'রিসেট') return;
    setResetLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('data-backup', {
        body: { action: 'reset' },
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'রিসেট ব্যর্থ');

      toast.success(data.message);
      setResetConfirmOpen(false);
      setResetConfirmText('');
      setTimeout(() => window.location.reload(), 1500);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setResetLoading(false);
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

      <div className="flex flex-col md:flex-row gap-6">
        <Tabs defaultValue="profile" className="flex-1" orientation="vertical">
          <div className="flex flex-col md:flex-row gap-6">
            <Card className="md:w-64 shrink-0">
              <CardContent className="p-3">
                <TabsList className="flex flex-col w-full h-auto bg-transparent gap-1">
                  <TabsTrigger value="profile" className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary/10">
                    <User className="h-4 w-4" />প্রোফাইল
                  </TabsTrigger>
                  <TabsTrigger value="security" className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary/10">
                    <Lock className="h-4 w-4" />নিরাপত্তা
                  </TabsTrigger>
                  <TabsTrigger value="notifications" className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary/10">
                    <Bell className="h-4 w-4" />নোটিফিকেশন
                  </TabsTrigger>
                  <TabsTrigger value="backup" className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary/10">
                    <Database className="h-4 w-4" />ব্যাকআপ ও রিসেট
                  </TabsTrigger>
                  <TabsTrigger value="about" className="w-full justify-start gap-2 px-3 py-2.5 data-[state=active]:bg-primary/10">
                    <Shield className="h-4 w-4" />সম্পর্কে
                  </TabsTrigger>
                </TabsList>
              </CardContent>
            </Card>

            <div className="flex-1 space-y-4">
              {/* Profile */}
              <TabsContent value="profile" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" />প্রোফাইল তথ্য</CardTitle>
                    <CardDescription>আপনার ব্যক্তিগত তথ্য আপডেট করুন</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>পূর্ণ নাম *</Label>
                        <Input value={profileForm.full_name} onChange={e => { setProfileForm({ ...profileForm, full_name: e.target.value }); setProfileErrors(p => ({ ...p, full_name: '' })); }} placeholder="আপনার নাম" className={profileErrors.full_name ? 'border-destructive' : ''} />
                        {profileErrors.full_name && <p className="text-xs text-destructive mt-1">{profileErrors.full_name}</p>}
                      </div>
                      <div>
                        <Label>ইমেইল</Label>
                        <Input value={user?.email || ''} disabled className="bg-muted" />
                        <p className="text-xs text-muted-foreground mt-1">ইমেইল পরিবর্তন করা যায় না</p>
                      </div>
                      <div>
                        <Label>ফোন নম্বর</Label>
                        <Input value={profileForm.phone} onChange={e => { setProfileForm({ ...profileForm, phone: e.target.value }); setProfileErrors(p => ({ ...p, phone: '' })); }} placeholder="01XXXXXXXXX" className={profileErrors.phone ? 'border-destructive' : ''} />
                        {profileErrors.phone && <p className="text-xs text-destructive mt-1">{profileErrors.phone}</p>}
                      </div>
                      <div>
                        <Label>শাখা</Label>
                        {isAdmin ? (
                          <Select value={profileForm.branch_id} onValueChange={v => setProfileForm({ ...profileForm, branch_id: v })}>
                            <SelectTrigger><SelectValue placeholder="শাখা নির্বাচন" /></SelectTrigger>
                            <SelectContent>{branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}</SelectContent>
                          </Select>
                        ) : (
                          <Input value={userBranch} disabled className="bg-muted" />
                        )}
                      </div>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between flex-wrap gap-4">
                      <div className="flex gap-6">
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
                      <Button onClick={handleProfileSave} disabled={profileSaving}>
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {profileSaving ? 'সংরক্ষণ হচ্ছে...' : 'প্রোফাইল সংরক্ষণ'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Security */}
              <TabsContent value="security" className="mt-0 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2"><Lock className="h-5 w-5" />পাসওয়ার্ড পরিবর্তন</CardTitle>
                    <CardDescription>আপনার অ্যাকাউন্টের পাসওয়ার্ড আপডেট করুন</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="max-w-md space-y-4">
                      <div>
                        <Label>নতুন পাসওয়ার্ড *</Label>
                        <div className="relative">
                          <Input
                            type={showPass ? 'text' : 'password'}
                            value={passwordForm.newPass}
                            onChange={e => { setPasswordForm({ ...passwordForm, newPass: e.target.value }); setPasswordErrors(p => ({ ...p, newPass: '' })); }}
                            placeholder="নতুন পাসওয়ার্ড"
                            className={passwordErrors.newPass ? 'border-destructive pr-10' : 'pr-10'}
                          />
                          <button type="button" className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" onClick={() => setShowPass(!showPass)}>
                            {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                        {passwordErrors.newPass && <p className="text-xs text-destructive mt-1">{passwordErrors.newPass}</p>}
                      </div>
                      <div>
                        <Label>পাসওয়ার্ড নিশ্চিত করুন *</Label>
                        <Input
                          type={showPass ? 'text' : 'password'}
                          value={passwordForm.confirm}
                          onChange={e => { setPasswordForm({ ...passwordForm, confirm: e.target.value }); setPasswordErrors(p => ({ ...p, confirm: '' })); }}
                          placeholder="আবার লিখুন"
                          className={passwordErrors.confirm ? 'border-destructive' : ''}
                        />
                        {passwordErrors.confirm && <p className="text-xs text-destructive mt-1">{passwordErrors.confirm}</p>}
                      </div>
                      <Button onClick={handlePasswordChange} disabled={passwordSaving}>
                        <Lock className="h-4 w-4 mr-2" />
                        {passwordSaving ? 'পরিবর্তন হচ্ছে...' : 'পাসওয়ার্ড পরিবর্তন'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader>
                    <CardTitle className="text-destructive">সেশন ও অ্যাকাউন্ট</CardTitle>
                    <CardDescription>বর্তমান সেশন থেকে লগআউট করুন</CardDescription>
                  </CardHeader>
                  <CardContent className="flex gap-3">
                    <Button variant="destructive" onClick={signOut}>লগআউট করুন</Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Notifications */}
              <TabsContent value="notifications" className="mt-0 space-y-4">
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
                    <div className="flex items-center justify-between pt-2">
                      <p className="text-xs text-muted-foreground italic">* সেটিংস এই ডিভাইসে সংরক্ষিত হবে</p>
                      <Button onClick={handleNotifSave} disabled={notifSaving} size="sm">
                        <CheckCircle className="h-4 w-4 mr-2" />
                        {notifSaving ? 'সংরক্ষণ হচ্ছে...' : 'সেটিংস সংরক্ষণ'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Backup & Reset */}
              <TabsContent value="backup" className="mt-0 space-y-4">
                {!isAdmin ? (
                  <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                      <AlertTriangle className="h-10 w-10 mx-auto mb-3 text-yellow-500" />
                      <p className="font-medium">শুধুমাত্র অ্যাডমিন এই ফিচার ব্যবহার করতে পারেন</p>
                    </CardContent>
                  </Card>
                ) : (
                  <>
                    {/* Export */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Download className="h-5 w-5" />ডেটা ব্যাকআপ (এক্সপোর্ট)</CardTitle>
                        <CardDescription>সম্পূর্ণ ডেটাবেস JSON ফাইল হিসেবে ডাউনলোড করুন — প্রোডাক্ট, বিক্রয়, গ্রাহক, স্টক মুভমেন্ট সবকিছু</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-muted/50 rounded-lg p-4 mb-4">
                          <p className="text-sm text-muted-foreground">ব্যাকআপে যা থাকবে:</p>
                          <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside space-y-0.5">
                            <li>শাখা ও ক্যাটেগরি তথ্য</li>
                            <li>সকল প্রোডাক্ট, ছবি ও ভ্যারিয়েন্ট</li>
                            <li>বিক্রয়, রিটার্ন ও স্টক মুভমেন্ট</li>
                            <li>গ্রাহক তথ্য</li>
                            <li>ব্যবহারকারী প্রোফাইল ও রোল</li>
                          </ul>
                        </div>
                        <Button onClick={handleBackupExport} disabled={backupLoading}>
                          {backupLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                          {backupLoading ? 'ব্যাকআপ তৈরি হচ্ছে...' : 'ব্যাকআপ ডাউনলোড করুন'}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Restore */}
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Upload className="h-5 w-5" />ডেটা পুনরুদ্ধার (রিস্টোর)</CardTitle>
                        <CardDescription>আগের ব্যাকআপ ফাইল থেকে সম্পূর্ণ ডেটা পুনরুদ্ধার করুন</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
                          <div className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                            <div>
                              <p className="text-sm font-medium text-destructive">সতর্কতা!</p>
                              <p className="text-sm text-muted-foreground">রিস্টোর করলে বর্তমান সকল ডেটা মুছে যাবে এবং ব্যাকআপের ডেটা দিয়ে প্রতিস্থাপিত হবে। আগে ব্যাকআপ নিন।</p>
                            </div>
                          </div>
                        </div>
                        <input ref={restoreFileRef} type="file" accept=".json" className="hidden" onChange={handleRestoreFile} />
                        <Button variant="outline" onClick={() => restoreFileRef.current?.click()} disabled={restoreLoading}>
                          {restoreLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                          {restoreLoading ? 'পুনরুদ্ধার হচ্ছে...' : 'ব্যাকআপ ফাইল আপলোড করুন'}
                        </Button>
                      </CardContent>
                    </Card>

                    {/* Factory Reset */}
                    <Card className="border-destructive/50">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-destructive"><RotateCcw className="h-5 w-5" />ফ্যাক্টরি রিসেট</CardTitle>
                        <CardDescription>সকল প্রোডাক্ট, বিক্রয়, গ্রাহক ও স্টক ডেটা স্থায়ীভাবে মুছে ফেলুন</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4 mb-4">
                          <p className="text-sm text-muted-foreground">রিসেট করলে নিচের ডেটা মুছে যাবে:</p>
                          <ul className="text-sm text-muted-foreground mt-1 list-disc list-inside space-y-0.5">
                            <li>সকল প্রোডাক্ট, ছবি ও ভ্যারিয়েন্ট</li>
                            <li>সকল বিক্রয় ও রিটার্ন</li>
                            <li>সকল গ্রাহক তথ্য</li>
                            <li>সকল স্টক মুভমেন্ট</li>
                          </ul>
                          <p className="text-sm font-medium text-destructive mt-2">শাখা, ক্যাটেগরি ও ব্যবহারকারী অ্যাকাউন্ট অক্ষত থাকবে।</p>
                        </div>
                        <Button variant="destructive" onClick={() => setResetConfirmOpen(true)}>
                          <RotateCcw className="h-4 w-4 mr-2" />ফ্যাক্টরি রিসেট করুন
                        </Button>
                      </CardContent>
                    </Card>
                  </>
                )}
              </TabsContent>

              {/* About */}
              <TabsContent value="about" className="mt-0 space-y-4">
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
                        <li>শাখা-থেকে-শাখা প্রোডাক্ট ট্রান্সফার ও রিভার্স</li>
                        <li>স্টক রিকনসিলিয়েশন / অডিট</li>
                        <li>বিক্রয় ও ইনভয়েস ব্যবস্থাপনা</li>
                        <li>বিক্রয় রিটার্ন ও রিফান্ড</li>
                        <li>গ্রাহক ডাটাবেস</li>
                        <li>স্টক মুভমেন্ট ট্র্যাকিং</li>
                        <li>রিপোর্ট ও বিশ্লেষণ</li>
                        <li>ডেটা ব্যাকআপ, পুনরুদ্ধার ও রিসেট</li>
                        <li>ব্যবহারকারী ভূমিকা ভিত্তিক অ্যাক্সেস কন্ট্রোল</li>
                        <li>CSV ইমপোর্ট/এক্সপোর্ট</li>
                      </ul>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div>
        </Tabs>
      </div>

      {/* Reset Confirmation Dialog */}
      <Dialog open={resetConfirmOpen} onOpenChange={setResetConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />ফ্যাক্টরি রিসেট নিশ্চিত করুন
            </DialogTitle>
            <DialogDescription>
              এই কাজটি অপরিবর্তনীয়। সকল প্রোডাক্ট, বিক্রয়, গ্রাহক ও স্টক ডেটা স্থায়ীভাবে মুছে যাবে।
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm">নিশ্চিত করতে নিচে <span className="font-bold text-destructive">রিসেট</span> লিখুন:</p>
            <Input
              value={resetConfirmText}
              onChange={e => setResetConfirmText(e.target.value)}
              placeholder="রিসেট"
              className="border-destructive/50"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetConfirmOpen(false); setResetConfirmText(''); }}>বাতিল</Button>
            <Button
              variant="destructive"
              onClick={handleFactoryReset}
              disabled={resetConfirmText !== 'রিসেট' || resetLoading}
            >
              {resetLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RotateCcw className="h-4 w-4 mr-2" />}
              {resetLoading ? 'রিসেট হচ্ছে...' : 'স্থায়ীভাবে মুছুন'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
