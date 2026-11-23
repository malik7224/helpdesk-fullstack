import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PriorityBadge, StatusBadge } from "@/components/badges";
import { PRIORITIES, PRIORITY_LABELS, STATUSES, STATUS_LABELS } from "@/lib/api";

describe("badges", () => {
  it.each(STATUSES)("shows a readable label for status %s", (status) => {
    expect(renderToStaticMarkup(<StatusBadge status={status} />)).toContain(STATUS_LABELS[status]);
  });

  it.each(PRIORITIES)("shows a readable label for priority %s", (priority) => {
    expect(renderToStaticMarkup(<PriorityBadge priority={priority} />)).toContain(PRIORITY_LABELS[priority]);
  });

  it("styles each status differently so they are distinguishable", () => {
    const classes = STATUSES.map((status) => renderToStaticMarkup(<StatusBadge status={status} />));
    expect(new Set(classes).size).toBe(STATUSES.length);
  });
});
