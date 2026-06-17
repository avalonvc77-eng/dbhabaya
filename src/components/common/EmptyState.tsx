import type { LucideIcon } from 'lucide-react';

interface Props {
  icon: LucideIcon;
  message: string;
}

export function EmptyState({ icon: Icon, message }: Props) {
  return (
    <div className="text-center py-12 text-muted-foreground">
      <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
      <p>{message}</p>
    </div>
  );
}
