import { RequireAuth } from "@/components/require-auth";
import { TicketsPage } from "@/components/tickets-page";

export default function Home() {
  return (
    <RequireAuth>
      <TicketsPage />
    </RequireAuth>
  );
}
