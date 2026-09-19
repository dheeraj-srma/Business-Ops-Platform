'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useLoading } from '../components/LoadingContext';
import { DealerRecord, InventoryItem, LocationRecord, OrderRecord } from '../types';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000';

export type { DealerRecord, InventoryItem, LocationRecord, OrderRecord };

export function useRealtimeInventory(loginSalesman: string) {
  const { registerLoadingKey, resolveLoadingKey } = useLoading();

  const [dealers, setDealers] = useState<DealerRecord[]>([]);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [locations, setLocations] = useState<LocationRecord[]>([]);
  const [submittedOrders, setSubmittedOrders] = useState<OrderRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [realtimeStatus, setRealtimeStatus] = useState<'connected' | 'reconnecting' | 'idle'>('idle');

  const initialLoadedRef = useRef(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Single initial load function
  const fetchAllData = useCallback(async () => {
    setLoading(true);
    try {
      const [dlrs, inv, locs, ords] = await Promise.all([
        fetch(`${API}/api/dealers`).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API}/api/inventory`).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API}/api/locations`).then(r => (r.ok ? r.json() : [])).catch(() => []),
        fetch(`${API}/api/orders`).then(r => (r.ok ? r.json() : [])).catch(() => []),
      ]);

      setDealers(Array.isArray(dlrs) ? dlrs : []);
      setInventory(Array.isArray(inv) ? inv : []);
      setLocations(Array.isArray(locs) ? locs : []);
      setSubmittedOrders(Array.isArray(ords) ? ords : []);
      setRealtimeStatus('connected');
    } catch (err) {
      console.error('Initial fetch failed:', err);
      setRealtimeStatus('reconnecting');
    } finally {
      setLoading(false);
      resolveLoadingKey('salesman_portal');
    }
  }, [resolveLoadingKey]);

  // Initial load once on mount
  useEffect(() => {
    registerLoadingKey('salesman_portal');
    fetchAllData();
    initialLoadedRef.current = true;
  }, [fetchAllData, registerLoadingKey]);

  // Handle Incremental Updates
  const updateInventoryItem = useCallback((updatedItem: Partial<InventoryItem>) => {
    setInventory(prev => {
      const targetSku = updatedItem.SKU || updatedItem.sku;
      if (!targetSku) return prev;
      const idx = prev.findIndex(i => (i.SKU || i.sku) === targetSku);
      if (idx === -1) {
        return [updatedItem as InventoryItem, ...prev];
      }
      const next = [...prev];
      next[idx] = { ...next[idx], ...updatedItem };
      return next;
    });
  }, []);

  const addOrderRecord = useCallback((newOrder: OrderRecord) => {
    setSubmittedOrders(prev => [newOrder, ...prev]);
  }, []);

  // Realtime reconnect and resync behavior
  const triggerResync = useCallback(() => {
    setRealtimeStatus('reconnecting');
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);

    reconnectTimeoutRef.current = setTimeout(() => {
      fetchAllData();
    }, 1500);
  }, [fetchAllData]);

  useEffect(() => {
    const handleOnline = () => triggerResync();
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('online', handleOnline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [triggerResync]);

  return {
    dealers,
    inventory,
    locations,
    submittedOrders,
    loading,
    realtimeStatus,
    resync: fetchAllData,
    updateInventoryItem,
    addOrderRecord,
  };
}
