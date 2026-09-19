'use client';
import { useRouter } from 'next/navigation';
import { useApp } from '../context/AppContext';
import { TransactionHistoryView } from '../components/transactions/TransactionHistoryView';

export default function TransactionsPage() {
  const router = useRouter();
  const { categories, handleOpenProductDetail } = useApp();

  return (
    <TransactionHistoryView
      categories={categories}
      onOpenProductDetail={handleOpenProductDetail}
      onGoBack={() => router.back()}
    />
  );
}
