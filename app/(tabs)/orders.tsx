import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, StyleSheet, RefreshControl } from 'react-native';
import api from '../../services/api';

export default function OrdersScreen() {
  const [orders, setOrders] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadOrders = async () => {
    try {
      const res = await api.get('/orders');
      setOrders(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadOrders();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={orders}
        keyExtractor={(item: any) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No orders placed yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.header}>
              <Text style={styles.title}>Order #{item.id}</Text>
              <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
            </View>
            <View style={styles.row}>
              <Text>Status:</Text>
              <Text style={styles.status}>{item.status.toUpperCase()}</Text>
            </View>
            <View style={styles.row}>
              <Text>Total:</Text>
              <Text style={styles.price}>${item.total_amount}</Text>
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  card: { padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 8, elevation: 2 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  title: { fontWeight: 'bold', fontSize: 16 },
  date: { color: 'gray' },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 5 },
  status: { fontWeight: 'bold', color: 'blue' },
  price: { fontWeight: 'bold', fontSize: 16, color: 'green' },
  empty: { textAlign: 'center', marginTop: 20, color: 'gray' }
});
