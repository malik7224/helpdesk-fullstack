import type { Metadata } from "next";
import { Suspense } from "react";
import { RequireAuth } from "@/components/require-auth";
import { TicketDetail } from "@/components/ticket-detail";

export const metadata: Metadata = { title: "Ticket" };

export default function TicketPage() {
  return (
    <RequireAuth>
      {/* useParams suspends for routes whose ids are not known at build time. */}
      <Suspense
        fallback={
          <p role="status" className="text-sm text-muted">
            Loading ticket…
          </p>
        }
      >
        <TicketDetail />
      </Suspense>
    </RequireAuth>
  );
}
