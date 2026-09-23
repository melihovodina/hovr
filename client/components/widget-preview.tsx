"use client";

import { useState, type ComponentProps } from "react";
import { cn } from "cn";
import { WidgetLauncher, WidgetPanel } from "./widget-panel";

// A drawn widget that opens and closes like the real one: the header's arrow closes it to the
// launcher, and the launcher opens it again. It fills its box and sits in the bot's corner.
export function WidgetPreview({ position, ...panel }: ComponentProps<typeof WidgetPanel> & { position: "left" | "right" }) {
  const [open, setOpen] = useState(true);
  return (
    <div className={cn("flex size-full flex-col justify-end", position === "left" ? "items-start" : "items-end")}>
      {open ? (
        <div
          className={cn(
            "size-full animate-in duration-250 fade-in-0 zoom-in-95 slide-in-from-bottom-3",
            position === "left" ? "origin-bottom-left" : "origin-bottom-right",
          )}
        >
          <WidgetPanel {...panel} onClose={() => setOpen(false)} />
        </div>
      ) : (
        <WidgetLauncher name={panel.name} color={panel.color} onOpen={() => setOpen(true)} />
      )}
    </div>
  );
}
