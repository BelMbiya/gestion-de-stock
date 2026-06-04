import { Construction } from "lucide-react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function ModulePlaceholder({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <section className="flex h-full min-h-0 items-center justify-center text-white">
      <Card className="max-w-xl border-white/10 bg-[#11183b]/95 text-white ring-0">
        <CardHeader>
          <CardTitle className="flex items-center gap-3 text-2xl font-black">
            <Construction className="size-6 text-[#6fb6ff]" />
            {title}
          </CardTitle>
          <CardDescription className="text-slate-400">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm leading-6 text-slate-300">
          Ce module est reserve dans le layout et sera implemente dans une
          prochaine iteration fonctionnelle.
        </CardContent>
      </Card>
    </section>
  );
}
