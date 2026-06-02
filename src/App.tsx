import type { ReactNode } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { useActiveProduction } from "@/context/AppStore";
import { Layout } from "@/components/Layout";
import { ScrollToTop } from "@/components/ScrollToTop";
import { HomePage } from "@/pages/HomePage";
import { MarketingPage } from "@/pages/MarketingPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { ScanPage } from "@/pages/ScanPage";
import { AssignPage } from "@/pages/AssignPage";
import { InventoryPage } from "@/pages/InventoryPage";
import { LocationsPage } from "@/pages/LocationsPage";
import { LogPage } from "@/pages/LogPage";
import { HelpPage } from "@/pages/HelpPage";
import { PrivacyPage } from "@/pages/PrivacyPage";
import { TermsPage } from "@/pages/TermsPage";
import { LaunchChecklistPage } from "@/pages/LaunchChecklistPage";
import { LicensesPage } from "@/pages/LicensesPage";

function RequireProduction({ children }: { children: ReactNode }) {
  const p = useActiveProduction();
  if (!p) return <Navigate to="/app" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Layout>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<MarketingPage />} />
        <Route path="/app" element={<HomePage />} />
        <Route
          path="/dashboard"
          element={
            <RequireProduction>
              <DashboardPage />
            </RequireProduction>
          }
        />
        <Route
          path="/scan"
          element={
            <RequireProduction>
              <ScanPage />
            </RequireProduction>
          }
        />
        <Route
          path="/assign"
          element={
            <RequireProduction>
              <AssignPage />
            </RequireProduction>
          }
        />
        <Route
          path="/inventory"
          element={
            <RequireProduction>
              <InventoryPage />
            </RequireProduction>
          }
        />
        <Route
          path="/locations"
          element={
            <RequireProduction>
              <LocationsPage />
            </RequireProduction>
          }
        />
        <Route
          path="/log"
          element={
            <RequireProduction>
              <LogPage />
            </RequireProduction>
          }
        />
        <Route path="/help" element={<HelpPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/launch" element={<LaunchChecklistPage />} />
        <Route path="/licenses" element={<LicensesPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
