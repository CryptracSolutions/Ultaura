import LogoImage from '~/core/ui/Logo/LogoImage';

export default function AuthorCard() {
  return (
    <div className="flex items-start gap-4 p-5 rounded-lg border border-border bg-card mt-10">
      <div className="flex-shrink-0">
        <LogoImage className="h-10 w-10" />
      </div>
      <div>
        <p className="font-semibold text-foreground">Ultaura</p>
        <p className="text-sm text-muted-foreground mt-0.5">
          AI-powered voice companion helping families stay connected with their elderly loved ones through daily check-in calls.
        </p>
      </div>
    </div>
  );
}
