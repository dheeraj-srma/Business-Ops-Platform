'use client';

import React from 'react';
import SalesmanAuthHeader from './salesman/SalesmanAuthHeader';
import OrderCartForm from './salesman/OrderCartForm';
import InventoryLedgerView from './salesman/InventoryLedgerView';
import OrderHistoryTracker from './salesman/OrderHistoryTracker';
import { useRealtimeInventory } from '../hooks/useRealtimeInventory';

interface SalesmanPortalUIProps {
  userRole: 'Salesman' | 'Customer' | 'Admin';
  loginSalesman: string;
  onLogout: () => void;
}

export default function SalesmanPortalUI({ userRole, loginSalesman, onLogout }: SalesmanPortalUIProps) {
  const {
    dealers,
    inventory,
    locations,
    submittedOrders,
    realtimeStatus,
    resync,
  } = useRealtimeInventory(loginSalesman);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6 space-y-6">
      {/* Top Authentication & Role Header */}
      <SalesmanAuthHeader
        userRole={userRole}
        loginSalesman={loginSalesman}
        realtimeStatus={realtimeStatus}
        onLogout={onLogout}
      />

      {/* Main Two-Column Portal Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Cart / Draft Order Entry Sheet */}
        <div className="lg:col-span-6">
          <OrderCartForm
            dealers={dealers}
            inventory={inventory}
            locations={locations}
            loginSalesman={loginSalesman}
            onOrderPlaced={resync}
          />
        </div>

        {/* Right Column: Live Master Inventory Ledger */}
        <div className="lg:col-span-6">
          <InventoryLedgerView inventory={inventory} />
        </div>
      </div>

      {/* Bottom Submitted Order History & Realtime Status Tracker */}
      <OrderHistoryTracker
        submittedOrders={submittedOrders}
        selectedSalesman={loginSalesman}
        defaultShop="Direct Order"
        salesmanId="SLS-001"
        locationId="LOC-001"
        city="Gurugram"
        state="Haryana"
      />
    </div>
  );
}
