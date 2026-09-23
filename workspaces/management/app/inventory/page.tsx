'use client';
import { Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { InventoryView } from '../components/inventory/InventoryView';

import { InScreenLoader } from '../components/common/InScreenLoader';

function InventoryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const statusFilter = searchParams.get('status') || 'all';

  const {
    products,
    categories,
    role,
    isLoading,
    fetchData,
    handleOpenNewProduct,
    handleOpenEditProduct,
    handleOpenProductDetail,
    handleOpenStockIn,
    handleOpenStockOut,
    handleOpenStockAdjustment,
  } = useApp();

  return (
    <InventoryView
      products={products}
      categories={categories}
      role={role}
      isLoading={isLoading}
      onRefresh={fetchData}
      onOpenNewProduct={handleOpenNewProduct}
      onOpenEditProduct={handleOpenEditProduct}
      onOpenProductDetail={handleOpenProductDetail}
      onOpenStockIn={handleOpenStockIn}
      onOpenStockOut={handleOpenStockOut}
      onOpenStockAdjustment={handleOpenStockAdjustment}
      initialStatusFilter={statusFilter}
      onGoBack={() => router.back()}
    />
  );
}

export default function InventoryPage() {
  return (
    <Suspense fallback={<InScreenLoader message="Loading Master Catalog Reference..." />}>
      <InventoryContent />
    </Suspense>
  );
}
