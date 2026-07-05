"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function MonitoringChart({
  data,
}: {
  data: { date: string; shareOfVoice: number }[];
}) {
  const max = Math.max(...data.map((d) => d.shareOfVoice), 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Évolution part de voix (%)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex h-40 items-end gap-2">
          {data.map((d) => (
            <div key={d.date} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t bg-primary transition-all"
                style={{ height: `${(d.shareOfVoice / max) * 100}%`, minHeight: 4 }}
                title={`${d.shareOfVoice}%`}
              />
              <span className="text-[10px] text-muted-foreground">{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
