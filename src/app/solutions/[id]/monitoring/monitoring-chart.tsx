"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const PLATFORM_COLORS: Record<string, string> = {
  gemini: "bg-blue-500",
  chatgpt: "bg-emerald-500",
  chatgpt_paid: "bg-emerald-700",
  google_aio: "bg-amber-500",
  perplexity: "bg-purple-500",
};

export function MonitoringChart({
  data,
  platformLabels,
}: {
  data: {
    date: string;
    shareOfVoice: number;
    platformSov: Record<string, number>;
  }[];
  platformLabels: Record<string, string>;
}) {
  const platforms = [
    ...new Set(data.flatMap((d) => Object.keys(d.platformSov))),
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Évolution part de voix (%)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex h-40 items-end gap-3">
          {data.map((d, idx) => (
            <div
              key={`${d.date}-${idx}`}
              className="flex flex-1 flex-col items-center gap-1"
            >
              <div className="flex h-full w-full items-end justify-center gap-0.5">
                <div
                  className="w-3 rounded-t bg-primary transition-all"
                  style={{ height: `${d.shareOfVoice}%`, minHeight: 4 }}
                  title={`Global : ${d.shareOfVoice}%`}
                />
                {platforms.map((p) => (
                  <div
                    key={p}
                    className={`w-3 rounded-t ${PLATFORM_COLORS[p] ?? "bg-muted-foreground"} transition-all`}
                    style={{
                      height: `${d.platformSov[p] ?? 0}%`,
                      minHeight: d.platformSov[p] != null ? 4 : 0,
                    }}
                    title={`${platformLabels[p] ?? p} : ${d.platformSov[p] ?? 0}%`}
                  />
                ))}
              </div>
              <span className="text-[10px] text-muted-foreground">
                {d.date.slice(5)}
              </span>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block h-2 w-2 rounded-sm bg-primary" />
            Global
          </span>
          {platforms.map((p) => (
            <span key={p} className="flex items-center gap-1">
              <span
                className={`inline-block h-2 w-2 rounded-sm ${PLATFORM_COLORS[p] ?? "bg-muted-foreground"}`}
              />
              {platformLabels[p] ?? p}
            </span>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
