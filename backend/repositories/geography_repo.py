import logging
import os
import json
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from config.database import get_db_client
from repositories.order_repo import OrderRepository

logger = logging.getLogger("geography_repo")

# Coordinates dictionary for States in India [lng, lat]
STATE_COORDINATES: Dict[str, Dict[str, Any]] = {
    'Haryana': {'code': 'HR', 'center': [76.0856, 29.0588], 'zoom': 5.5, 'color': '#4f46e5'},
    'Delhi': {'code': 'DL', 'center': [77.1025, 28.7041], 'zoom': 8.0, 'color': '#06b6d4'},
    'NCT of Delhi': {'code': 'DL', 'center': [77.1025, 28.7041], 'zoom': 8.0, 'color': '#06b6d4'},
    'Uttar Pradesh': {'code': 'UP', 'center': [80.9462, 26.8467], 'zoom': 4.5, 'color': '#10b981'},
    'Rajasthan': {'code': 'RJ', 'center': [74.2179, 27.0238], 'zoom': 4.5, 'color': '#f59e0b'},
    'Uttarakhand': {'code': 'UK', 'center': [79.0193, 30.0668], 'zoom': 6.0, 'color': '#8b5cf6'},
    'Maharashtra': {'code': 'MH', 'center': [75.7139, 19.7515], 'zoom': 4.5, 'color': '#f43f5e'},
    'Karnataka': {'code': 'KA', 'center': [75.7139, 15.3173], 'zoom': 5.0, 'color': '#06b6d4'},
    'Gujarat': {'code': 'GJ', 'center': [71.1924, 22.2587], 'zoom': 5.0, 'color': '#ec4899'},
    'Bihar': {'code': 'BR', 'center': [85.3131, 25.0961], 'zoom': 5.5, 'color': '#ef4444'},
    'Himachal Pradesh': {'code': 'HP', 'center': [77.1734, 31.1048], 'zoom': 6.0, 'color': '#14b8a6'},
    'Punjab': {'code': 'PB', 'center': [75.3412, 31.1471], 'zoom': 5.5, 'color': '#eab308'},
}

DEFAULT_STATE_CONFIG = {'code': 'IN', 'center': [78.9629, 22.5937], 'zoom': 1.0, 'color': '#64748b'}

# City Coordinates & Cities per State
CITIES_BY_STATE: Dict[str, List[Dict[str, Any]]] = {
    'Haryana': [
        {'name': 'Faridabad', 'center': [77.3178, 28.4089], 'zoom': 9.5},
        {'name': 'Gurugram', 'center': [77.0266, 28.4595], 'zoom': 9.5},
        {'name': 'Panipat', 'center': [76.9635, 29.3909], 'zoom': 9.5},
        {'name': 'Rohtak', 'center': [76.6066, 28.8955], 'zoom': 9.5},
        {'name': 'Hisar', 'center': [75.7224, 29.1492], 'zoom': 9.5},
        {'name': 'Karnal', 'center': [76.9905, 29.6857], 'zoom': 9.5},
        {'name': 'Ambala', 'center': [76.7821, 30.3782], 'zoom': 9.5},
        {'name': 'Sonipat', 'center': [77.0145, 28.9931], 'zoom': 9.5},
    ],
    'Delhi': [
        {'name': 'Central Delhi', 'center': [77.2090, 28.6139], 'zoom': 10.0},
        {'name': 'South Delhi', 'center': [77.2167, 28.5355], 'zoom': 10.0},
        {'name': 'North Delhi', 'center': [77.2100, 28.7000], 'zoom': 10.0},
        {'name': 'West Delhi', 'center': [77.1000, 28.6500], 'zoom': 10.0},
        {'name': 'Dwarka', 'center': [77.0500, 28.5800], 'zoom': 10.0},
    ],
    'Uttar Pradesh': [
        {'name': 'Noida', 'center': [77.3910, 28.5355], 'zoom': 9.5},
        {'name': 'Ghaziabad', 'center': [77.4538, 28.6692], 'zoom': 9.5},
        {'name': 'Kanpur', 'center': [80.3318, 26.4499], 'zoom': 9.5},
        {'name': 'Agra', 'center': [78.0081, 27.1767], 'zoom': 9.5},
        {'name': 'Lucknow', 'center': [80.9462, 26.8467], 'zoom': 9.5},
        {'name': 'Varanasi', 'center': [82.9739, 25.3176], 'zoom': 9.5},
    ],
    'Rajasthan': [
        {'name': 'Jaipur', 'center': [75.7873, 26.9124], 'zoom': 9.0},
        {'name': 'Jodhpur', 'center': [73.0243, 26.2389], 'zoom': 9.0},
        {'name': 'Udaipur', 'center': [73.7125, 24.5854], 'zoom': 9.0},
    ],
    'Maharashtra': [
        {'name': 'Mumbai', 'center': [72.8777, 19.0760], 'zoom': 9.0},
        {'name': 'Pune', 'center': [73.8567, 18.5204], 'zoom': 9.0},
        {'name': 'Nagpur', 'center': [79.0882, 21.1458], 'zoom': 9.0},
    ],
    'Karnataka': [
        {'name': 'Bengaluru', 'center': [77.5946, 12.9716], 'zoom': 9.0},
        {'name': 'Mysuru', 'center': [76.6394, 12.2958], 'zoom': 9.0},
    ],
    'Gujarat': [
        {'name': 'Ahmedabad', 'center': [72.5714, 23.0225], 'zoom': 9.0},
        {'name': 'Surat', 'center': [72.8311, 21.1702], 'zoom': 9.0},
        {'name': 'Vadodara', 'center': [73.1812, 22.3072], 'zoom': 9.0},
    ],
    'Punjab': [
        {'name': 'Ludhiana', 'center': [75.8573, 30.9010], 'zoom': 9.0},
        {'name': 'Amritsar', 'center': [74.8723, 31.6340], 'zoom': 9.0},
        {'name': 'Jalandhar', 'center': [75.5762, 31.3260], 'zoom': 9.0},
    ],
    'Uttarakhand': [
        {'name': 'Dehradun', 'center': [78.0322, 30.3165], 'zoom': 9.0},
        {'name': 'Haridwar', 'center': [78.1642, 29.9457], 'zoom': 9.0},
    ],
    'Himachal Pradesh': [
        {'name': 'Shimla', 'center': [77.1734, 31.1048], 'zoom': 9.0},
        {'name': 'Solan', 'center': [77.1089, 30.9084], 'zoom': 9.0},
    ],
    'Bihar': [
        {'name': 'Patna', 'center': [85.1376, 25.5941], 'zoom': 9.0},
        {'name': 'Gaya', 'center': [85.0002, 24.7914], 'zoom': 9.0},
    ]
}

# Load dynamic district centers from JSON
import os
import json

DISTRICT_CENTERS_MAP: Dict[str, Dict[str, Any]] = {}
try:
    _json_path = os.path.join(os.path.dirname(__file__), '..', '..', 'nextjs_app', 'public', 'district_centers.json')
    if os.path.exists(_json_path):
        with open(_json_path, 'r', encoding='utf-8') as _f:
            DISTRICT_CENTERS_MAP = json.load(_f)
except Exception as _e:
    logger.warning(f"Could not load district_centers.json: {_e}")

class GeographyRepository:

    @staticmethod
    def _get_dealers() -> List[Dict[str, Any]]:
        client = get_db_client()
        if not client:
            return []
        try:
            res = client.table("dealers").select("*").execute()
            return res.data or []
        except Exception as err:
            logger.error(f"Error fetching dealers: {err}")
            return []

    @staticmethod
    def _filter_orders_by_range(orders: List[Dict[str, Any]], time_range: str) -> List[Dict[str, Any]]:
        if not orders:
            return []
        today = datetime.now().date()
        if time_range == 'today':
            cutoff = today.isoformat()
            return [o for o in orders if str(o.get("order_date") or o.get("created_at") or "")[:10] == cutoff]
        elif time_range == '7d':
            cutoff = (today - timedelta(days=6)).isoformat()
            return [o for o in orders if str(o.get("order_date") or o.get("created_at") or "")[:10] >= cutoff]
        elif time_range == '30d':
            cutoff = (today - timedelta(days=29)).isoformat()
            return [o for o in orders if str(o.get("order_date") or o.get("created_at") or "")[:10] >= cutoff]
        elif time_range == '90d':
            cutoff = (today - timedelta(days=89)).isoformat()
            return [o for o in orders if str(o.get("order_date") or o.get("created_at") or "")[:10] >= cutoff]
        elif time_range == 'ytd':
            cutoff = f"{today.year}-01-01"
            return [o for o in orders if str(o.get("order_date") or o.get("created_at") or "")[:10] >= cutoff]
        return orders

    @classmethod
    def get_india_summary(cls, time_range: str = '30d') -> Dict[str, Any]:
        dealers = cls._get_dealers()
        all_orders = OrderRepository.get_orders(limit=1000)
        filtered_orders = cls._filter_orders_by_range(all_orders, time_range)

        # Build dealer lookup
        dealer_map: Dict[str, Dict[str, Any]] = {}
        state_dealers: Dict[str, List[Dict[str, Any]]] = {}
        for d in dealers:
            st = d.get("State") or "Haryana"
            if st not in state_dealers:
                state_dealers[st] = []
            state_dealers[st].append(d)
            name_key = str(d.get("Shop Name") or d.get("Name") or "").strip().lower()
            if name_key:
                dealer_map[name_key] = {"state": st, "city": d.get("City") or "Faridabad"}

        # If orders exist, aggregate real state data
        state_sales_map: Dict[str, Dict[str, Any]] = {}
        for st_name in STATE_COORDINATES.keys():
            if st_name == 'NCT of Delhi':
                continue
            state_sales_map[st_name] = {"revenue": 0.0, "orders": 0}

        has_matching_orders = False
        for o in filtered_orders:
            cust = str(o.get("customer_name") or o.get("customer_id") or o.get("shop_name") or "").strip().lower()
            matched = dealer_map.get(cust) or {}
            st = o.get("state") or matched.get("state") or "Haryana"
            if st in ['Delhi', 'NCT of Delhi']:
                st = 'Delhi'
            if st in state_sales_map:
                amt = float(o.get("total_amount") or 0.0)
                state_sales_map[st]["revenue"] += amt
                state_sales_map[st]["orders"] += 1
                has_matching_orders = True

        total_dealers_count = len(dealers) if dealers else 804

        if has_matching_orders:
            total_gross_sales = sum(s["revenue"] for s in state_sales_map.values())
            total_orders_count = sum(s["orders"] for s in state_sales_map.values())

            states_list = []
            for st_name, s_data in state_sales_map.items():
                cfg = STATE_COORDINATES.get(st_name, DEFAULT_STATE_CONFIG)
                st_rev = round(s_data["revenue"], 2)
                st_share = round((st_rev / total_gross_sales * 100), 1) if total_gross_sales > 0 else 0.0
                st_dealers_count = len(state_dealers.get(st_name, []))
                states_list.append({
                    'name': st_name,
                    'code': cfg['code'],
                    'revenue': st_rev,
                    'orders': s_data["orders"],
                    'dealers': st_dealers_count,
                    'share': st_share,
                    'color': cfg['color'],
                    'center': cfg['center'],
                    'zoom': cfg['zoom']
                })
        else:
            # When order collection has no transactions in range, return zero revenue with actual dealer counts
            total_gross_sales = 0.0
            total_orders_count = 0

            states_list = []
            for st_name, cfg in STATE_COORDINATES.items():
                if st_name == 'NCT of Delhi':
                    continue
                st_dealers_count = len(state_dealers.get(st_name, []))
                states_list.append({
                    'name': st_name,
                    'code': cfg['code'],
                    'revenue': 0.0,
                    'orders': 0,
                    'dealers': st_dealers_count,
                    'share': 0.0,
                    'color': cfg['color'],
                    'center': cfg['center'],
                    'zoom': cfg['zoom']
                })

        states_list.sort(key=lambda s: s['revenue'], reverse=True)

        return {
            'level': 'india',
            'title': 'India Regional Revenue & Dealer Distribution',
            'gross_sales': round(total_gross_sales, 2),
            'orders': total_orders_count,
            'customers': total_dealers_count,
            'active_states': len(states_list),
            'center': [78.9629, 22.5937],
            'zoom': 1.0,
            'states': states_list
        }

    @classmethod
    def get_state_summary(cls, state_name: str, time_range: str = '30d') -> Dict[str, Any]:
        dealers = cls._get_dealers()
        all_orders = OrderRepository.get_orders(limit=1000)
        filtered_orders = cls._filter_orders_by_range(all_orders, time_range)

        normalized_state = 'Delhi' if state_name in ['Delhi', 'NCT of Delhi'] else state_name
        st_cfg = STATE_COORDINATES.get(normalized_state, DEFAULT_STATE_CONFIG)
        st_dealers = [d for d in dealers if (d.get("State") or "Haryana") in [normalized_state, state_name]]

        # Available cities config
        available_cities = CITIES_BY_STATE.get(normalized_state, [{'name': f"{normalized_state} Central", 'center': st_cfg['center'], 'zoom': 9.0}])
        city_names = [c['name'] for c in available_cities]

        # Calculate city breakdown from real orders if available
        city_stats: Dict[str, Dict[str, Any]] = {c['name']: {"revenue": 0.0, "orders": 0, "units_sold": 0.0, "dealers": set()} for c in available_cities}
        st_rev = 0.0
        st_orders = 0
        st_units = 0.0

        for o in filtered_orders:
            amt = float(o.get("total_amount") or 0.0)
            qty = float(o.get("total_quantity") or o.get("quantity") or 0.0)
            c_name = o.get("city")
            if c_name and c_name in city_stats:
                city_stats[c_name]["revenue"] += amt
                city_stats[c_name]["orders"] += 1
                city_stats[c_name]["units_sold"] += qty
                cust = o.get("customer_name") or o.get("customer_id")
                if cust:
                    city_stats[c_name]["dealers"].add(cust)
                st_rev += amt
                st_orders += 1
                st_units += qty

        cities_list = []
        if st_rev > 0:
            for c_cfg in available_cities:
                c_data = city_stats[c_cfg['name']]
                c_rev = round(c_data["revenue"], 2)
                c_share = round((c_rev / st_rev * 100), 1) if st_rev > 0 else 0.0
                cities_list.append({
                    'name': c_cfg['name'],
                    'revenue': c_rev,
                    'orders': c_data["orders"],
                    'dealers': len(c_data["dealers"]),
                    'units_sold': round(c_data["units_sold"], 2),
                    'share': c_share,
                    'center': c_cfg['center'],
                    'zoom': c_cfg['zoom']
                })
        else:
            # When state has no orders in active range, return zero revenue
            st_rev = 0.0
            st_orders = 0
            st_units = 0.0

            cities_list = []
            for c_cfg in available_cities:
                c_dealers = [d for d in st_dealers if str(d.get("City") or "").lower() == c_cfg['name'].lower()]
                cities_list.append({
                    'name': c_cfg['name'],
                    'revenue': 0.0,
                    'orders': 0,
                    'dealers': len(c_dealers),
                    'units_sold': 0.0,
                    'share': 0.0,
                    'center': c_cfg['center'],
                    'zoom': c_cfg['zoom']
                })

        cities_list.sort(key=lambda c: c['revenue'], reverse=True)

        return {
            'level': 'state',
            'state_name': normalized_state,
            'code': st_cfg['code'],
            'gross_sales': round(st_rev, 2),
            'orders': st_orders,
            'customers': len(st_dealers) or len(dealers),
            'units_sold': round(st_units, 2),
            'center': st_cfg['center'],
            'zoom': st_cfg['zoom'],
            'color': st_cfg['color'],
            'cities': cities_list
        }

    @classmethod
    def get_city_summary(cls, city_name: str, state_name: Optional[str] = None, time_range: str = '30d') -> Dict[str, Any]:
        dealers = cls._get_dealers()
        all_orders = OrderRepository.get_orders(limit=1000)
        filtered_orders = cls._filter_orders_by_range(all_orders, time_range)

        # Find city config across states
        c_cfg = None
        found_state = state_name or 'Haryana'
        for st, c_list in CITIES_BY_STATE.items():
            for c in c_list:
                if c['name'].lower() == city_name.lower():
                    c_cfg = c
                    found_state = st
                    break
            if c_cfg:
                break

        if not c_cfg:
            c_cfg = {'name': city_name, 'center': [77.3178, 28.4089], 'zoom': 9.5}

        # Match dealers in this city
        city_dealers = [d for d in dealers if str(d.get("City") or "").lower() == city_name.lower()]
        if not city_dealers:
            city_dealers = [d for d in dealers if (d.get("State") or "Haryana") in [found_state, 'Delhi' if found_state == 'NCT of Delhi' else found_state]][:15]

        # Aggregate city orders
        city_orders_list = [o for o in filtered_orders if str(o.get("city") or "").lower() == city_name.lower()]
        city_rev = sum(float(o.get("total_amount") or 0.0) for o in city_orders_list)
        city_orders = len(city_orders_list)
        city_units = sum(float(o.get("total_quantity") or o.get("quantity") or 0.0) for o in city_orders_list)

        center_lng, center_lat = c_cfg['center']
        customers_list = []
        for i, d in enumerate(city_dealers[:25]):
            shop_name = d.get("Shop Name") or d.get("Name") or f"Dealer {i+1}"
            salesman_name = d.get("Salesman Name") or "ANKIT"
            phone = d.get("Phone") or "—"
            cust_id = str(d.get("Location ID") or d.get("id") or f"CUST-10{24 + i}")

            # Orders for this customer
            c_orders_list = [o for o in city_orders_list if str(o.get("customer_name") or o.get("shop_name") or "").lower() == shop_name.lower()]
            c_rev = round(sum(float(o.get("total_amount") or 0.0) for o in c_orders_list), 2)
            c_orders = len(c_orders_list)
            c_units = round(sum(float(o.get("total_quantity") or o.get("quantity") or 0.0) for o in c_orders_list), 2)

            offset_lat = ((i * 7 + 3) % 17 - 8) * 0.008
            offset_lng = ((i * 11 + 5) % 19 - 9) * 0.008

            customers_list.append({
                'id': cust_id,
                'name': shop_name,
                'city': city_name,
                'state': found_state,
                'salesman': salesman_name,
                'phone': phone,
                'revenue': c_rev,
                'orders': c_orders,
                'avg_order': round(c_rev / c_orders, 2) if c_orders > 0 else 0.0,
                'units_sold': c_units,
                'coords': [round(center_lng + offset_lng, 4), round(center_lat + offset_lat, 4)]
            })

        customers_list.sort(key=lambda x: x['revenue'], reverse=True)

        return {
            'level': 'city',
            'city_name': city_name,
            'state_name': found_state,
            'gross_sales': round(city_rev, 2),
            'orders': city_orders,
            'customers': len(customers_list),
            'units_sold': round(city_units, 2),
            'center': c_cfg['center'],
            'zoom': c_cfg['zoom'],
            'customer_list': customers_list
        }

    @classmethod
    def get_customer_summary(cls, customer_id: str, time_range: str = '30d') -> Dict[str, Any]:
        dealers = cls._get_dealers()
        all_orders = OrderRepository.get_orders(limit=1000)
        filtered_orders = cls._filter_orders_by_range(all_orders, time_range)

        # Match customer by ID or name
        matched_dealer = None
        for d in dealers:
            if str(d.get("Shop Name") or d.get("Name")) == customer_id or str(d.get("Location ID") or d.get("id")) == customer_id:
                matched_dealer = d
                break
        if not matched_dealer and dealers:
            matched_dealer = dealers[0]

        shop_name = matched_dealer.get("Shop Name") or matched_dealer.get("Name") if matched_dealer else customer_id
        salesman_name = matched_dealer.get("Salesman Name") if matched_dealer else "Rahul"
        st_name = matched_dealer.get("State") if matched_dealer else "Haryana"
        ct_name = matched_dealer.get("City") if matched_dealer else "Faridabad"

        cust_orders = [o for o in filtered_orders if str(o.get("customer_name") or o.get("shop_name") or "").lower() == str(shop_name).lower()]
        cust_sales = round(sum(float(o.get("total_amount") or 0.0) for o in cust_orders), 2)
        orders_count = len(cust_orders)
        avg_order = round(cust_sales / max(1, orders_count), 2) if orders_count > 0 else 0.0
        units_sold = round(sum(float(o.get("total_quantity") or o.get("quantity") or 0.0) for o in cust_orders), 2)

        return {
            'level': 'customer',
            'customer_id': customer_id,
            'name': shop_name,
            'city': ct_name,
            'state': st_name,
            'salesman': salesman_name,
            'gross_sales': cust_sales,
            'orders': orders_count,
            'avg_order': avg_order,
            'units_sold': units_sold,
            'top_products': []
        }
