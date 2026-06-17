interface Props {
  text?: string;
  className?: string;
}

export function LoadingState({ text = 'লোড হচ্ছে...', className = 'h-64' }: Props) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <p className="text-muted-foreground">{text}</p>
    </div>
  );
}
