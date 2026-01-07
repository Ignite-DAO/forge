import type { ReactNode } from "react";

export function PageHeader({
  title,
  description,
  icon,
}: {
  title: string;
  description?: string;
  icon?: ReactNode;
}) {
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        {icon ? (
          <span className="inline-flex items-center justify-center rounded-md bg-primary/10 p-1.5">
            {icon}
          </span>
        ) : null}
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
      </div>
      {description ? (
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      ) : null}
    </div>
  );
}
