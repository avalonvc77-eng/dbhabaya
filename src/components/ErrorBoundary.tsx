import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }) {
    // eslint-disable-next-line no-console
    console.error('ErrorBoundary caught:', error, info.componentStack);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md w-full border border-destructive/40 rounded-xl p-6 bg-card text-center space-y-4">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-xl font-bold font-heading">একটি সমস্যা হয়েছে</h2>
          <p className="text-sm text-muted-foreground break-words">
            {this.state.error?.message || 'অপ্রত্যাশিত ত্রুটি ঘটেছে।'}
          </p>
          <div className="flex gap-2 justify-center">
            <Button onClick={this.reset} variant="outline">আবার চেষ্টা করুন</Button>
            <Button onClick={() => window.location.assign('/')}>হোমে ফিরুন</Button>
          </div>
        </div>
      </div>
    );
  }
}
