import AuthGuard from "@/components/AuthGuard";
import OfflineSync from "@/components/OfflineSync";
import RefreshProvider from "@/components/RefreshProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OfflineSync />
      <RefreshProvider>{children}</RefreshProvider>
    </AuthGuard>
  );
}
