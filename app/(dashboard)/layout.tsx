import AuthGuard from "@/components/AuthGuard";
import OfflineSync from "@/components/OfflineSync";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <OfflineSync />
      {children}
    </AuthGuard>
  );
}
