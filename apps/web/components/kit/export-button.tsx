import { Download } from "lucide-react";

import { Button } from "@/components/ui/button";

type ExportButtonProps = {
  href: string;
  label?: string;
};

function ExportButton({ href, label = "Export CSV" }: ExportButtonProps) {
  return (
    <Button asChild variant="outline">
      <a href={href}>
        <Download className="size-4" />
        {label}
      </a>
    </Button>
  );
}

export { ExportButton };
