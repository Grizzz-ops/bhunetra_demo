import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import dynamic from "next/dynamic";

import AuditLog from "../components/AuditLog";

import TriggerTable from "../components/TriggerTable";
import DashboardStats from "../components/DashboardStats";
import Analytics from "../components/Analytics";

import {
  getAlerts,
  advanceSla,
  type AlertsGeoJSON,
} from "../utils/api";

const Map = dynamic(
  () => import("../components/Map"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[500px] items-center justify-center rounded-xl bg-gray-200">
        Loading map...
      </div>
    ),
  }
);

export default function Dashboard() {
  const router = useRouter();

  const [name, setName] = useState("");

  const [alerts, setAlerts] =
    useState<AlertsGeoJSON | null>(null);

  const [loadingAlerts, setLoadingAlerts] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadAlerts = async () => {
    try {
      setLoadingAlerts(true);

      const data = await getAlerts();

      setAlerts(data);

      setError("");
    } catch (error) {
      console.error(error);

      setError(
        "Failed to load alerts from the API."
      );
    } finally {
      setLoadingAlerts(false);
    }
  };

 const handleAdvanceSla = async () => {
  try {
    await advanceSla();

    alert("SLA advanced successfully.");

    await loadAlerts();
  } catch (error) {
    console.error(error);

    alert(
      "Failed to trigger SLA escalation. Please try again."
    );
  }
}; 
  useEffect(() => {
    const token =
      localStorage.getItem("bhunetra_token");

    const officerName =
      localStorage.getItem("bhunetra_name");

    if (!token) {
      router.push("/");
      return;
    }

    

    setName(officerName || "Officer");

    loadAlerts();
  }, [router]);

  useEffect(() => {
  const interval = setInterval(() => {
    loadAlerts();
  }, 30000);

  return () => clearInterval(interval);
}, []);

  const handleLogout = () => {
  localStorage.removeItem("bhunetra_token");
  localStorage.removeItem("bhunetra_role");
  localStorage.removeItem("bhunetra_name");
  localStorage.removeItem("bhunetra_resolved_alerts");
  localStorage.removeItem("bhunetra_dismissed_alerts");
  localStorage.removeItem("bhunetra_audit_logs");

  router.push("/");
};

  return (
    <div className="min-h-screen bg-gray-100">

      {/* HEADER */}
      <header className="flex items-center justify-between bg-gray-900 px-6 py-4 text-white">

        <div>
          <h1 className="text-xl font-bold">
            BhuNetra
          </h1>

          <p className="text-sm text-gray-400">
            Mining Surveillance Dashboard
          </p>
        </div>

        <div className="flex items-center gap-4">

          <span className="text-sm">
            {name}
          </span>

          <button
            onClick={handleLogout}
            className="rounded-md bg-red-600 px-4 py-2 text-sm"
          >
            Logout
          </button>

        </div>

      </header>

      {/* MAIN CONTENT */}
      <main className="space-y-6 p-6">

        {/* DASHBOARD TITLE */}
        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="text-2xl font-bold">
            Dashboard
          </h2>

          <p className="mt-2 text-gray-600">
            Welcome to BhuNetra.
          </p>

        </div>

        {/* DASHBOARD STATISTICS */}

{!loadingAlerts && !error && (
  <DashboardStats alerts={alerts} />
)}

{/* ANALYTICS */}

{!loadingAlerts && !error && (
  <div className="rounded-xl bg-white p-6 shadow">
    <h2 className="mb-4 text-lg font-bold">
      Analytics
    </h2>

    <Analytics alerts={alerts} />
  </div>
)}


        {/* MAP */}
        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="mb-4 text-lg font-bold">
            Mining Surveillance Map
          </h2>

          <Map />

        </div>

        {/* TRIGGER TABLE */}
        <div className="rounded-xl bg-white p-6 shadow">

         <div className="mb-4 flex items-center justify-between">

  <h2 className="text-lg font-bold">
    Trigger Table
  </h2>

  <div className="flex gap-3">

    <button
      onClick={handleAdvanceSla}
      className="rounded-md bg-orange-600 px-4 py-2 text-sm text-white hover:bg-orange-700"
    >
      ⚡ Demo: Trigger SLA Escalation
    </button>

    <button
      onClick={loadAlerts}
      className="rounded-md bg-blue-600 px-4 py-2 text-sm text-white"
    >
      Refresh
    </button>

  </div>

</div>

          {loadingAlerts && (
            <p className="py-6 text-gray-500">
              Loading alerts...
            </p>
          )}

          {error && (
            <p className="py-6 text-red-600">
              {error}
            </p>
          )}

          {!loadingAlerts && !error && (
            <TriggerTable
              alerts={alerts}
              onRefresh={loadAlerts}
            />
          )}

        </div>

                {/* AUDIT LOG */}
        <div className="rounded-xl bg-white p-6 shadow">

          <h2 className="mb-4 text-lg font-bold">
            Audit Log
          </h2>

          <AuditLog />

        </div>

      </main>

    </div>
  );
}