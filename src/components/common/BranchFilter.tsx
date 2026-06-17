import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { Branch } from '@/types';

interface Props {
  branches: Branch[];
  value: string;
  onChange: (value: string) => void;
  width?: string;
  placeholder?: string;
}

export function BranchFilter({ branches, value, onChange, width = 'w-[160px]', placeholder = 'শাখা ফিল্টার' }: Props) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className={width}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        <SelectItem value="all">সকল শাখা</SelectItem>
        {branches.map(b => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}
