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
    <div className="page-intro">
      <div className="flex items-center gap-3">
        {icon ? <span className="text-primary">{icon}</span> : null}
        <h1 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
          {title}
        </h1>
      </div>
      {description ? (
        <p className="mt-3 max-w-[55ch] text-pretty text-base/7 text-muted-foreground">
          {description}
        </p>
      ) : null}
    </div>
  );
}
