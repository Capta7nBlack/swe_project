import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, ActivityIndicator, Modal } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import api from '../../services/api';

export default function SupplierCatalogScreen() {
  const { id } = useLocalSearchParams(); // This is the Supplier ID
  const router = useRouter();
  const [products, setProducts] = useState([]);
  const [cart, setCart] = useState<{[key: number]: number}>({}); // { product_id: quantity }
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadCatalog();
  }, [id]);

  const loadCatalog = async () => {
    try {
      const res = await api.get(`/products/supplier/${id}`);
      setProducts(res.data);
    } catch (e: any) {
      Alert.alert("Access Denied", "You must be connected to this supplier to view their catalog.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const addToCart = (pid: number) => {
    setCart(prev => ({ ...prev, [pid]: (prev[pid] || 0) + 1 }));
  };

  const removeFromCart = (pid: number) => {
    setCart(prev => {
      const newQty = (prev[pid] || 0) - 1;
      if (newQty <= 0) {
        const copy = { ...prev };
        delete copy[pid];
        return copy;
      }
      return { ...prev, [pid]: newQty };
    });
  };

  const placeOrder = async () => {
    const items = Object.keys(cart).map(pid => ({
      product_id: parseInt(pid),
      quantity: cart[parseInt(pid)]
    }));

    if (items.length === 0) return;

    setSubmitting(true);
    try {
      await api.post('/orders', { supplier_id: id, items });
      Alert.alert("Success", "Order placed successfully!", [
        { text: "OK", onPress: () => router.push('/(tabs)/orders') }
      ]);
    } catch (e) {
      Alert.alert("Error", "Failed to place order");
    } finally {
      setSubmitting(false);
    }
  };

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  if (loading) return <ActivityIndicator style={{flex:1}} />;

  return (
    <View style={styles.container}>
      <FlatList
        data={products}
        keyExtractor={(item: any) => item.id.toString()}
        contentContainerStyle={{ paddingBottom: 100 }}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={{flex: 1}}>
              <Text style={styles.prodName}>{item.name}</Text>
              <Text style={styles.price}>${item.price} / {item.unit}</Text>
              {item.quantity < 10 && <Text style={{color: 'red'}}>Low Stock: {item.quantity}</Text>}
            </View>
            
            <View style={styles.counter}>
              <TouchableOpacity onPress={() => removeFromCart(item.id)} style={styles.countBtn}>
                 <Text style={styles.countText}>-</Text>
              </TouchableOpacity>
              <Text style={styles.qty}>{cart[item.id] || 0}</Text>
              <TouchableOpacity onPress={() => addToCart(item.id)} style={styles.countBtn}>
                 <Text style={styles.countText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      />

      {/* Floating Bottom Bar */}
      {totalItems > 0 && (
        <View style={styles.bottomBar}>
          <Text style={styles.cartText}>{totalItems} Items in Cart</Text>
          <TouchableOpacity style={styles.orderBtn} onPress={placeOrder} disabled={submitting}>
            <Text style={styles.orderBtnText}>{submitting ? "Sending..." : "Place Order"}</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9f9f9' },
  card: { padding: 15, backgroundColor: 'white', marginHorizontal: 10, marginTop: 10, borderRadius: 8, flexDirection: 'row', alignItems: 'center', elevation: 2 },
  prodName: { fontSize: 16, fontWeight: 'bold' },
  price: { color: 'green', fontWeight: '600' },
  counter: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#eee', borderRadius: 5 },
  countBtn: { padding: 10 },
  countText: { fontSize: 18, fontWeight: 'bold' },
  qty: { paddingHorizontal: 10, fontSize: 16 },
  bottomBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, borderTopWidth: 1, borderColor: '#ddd', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cartText: { fontSize: 18, fontWeight: 'bold' },
  orderBtn: { backgroundColor: '#007AFF', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  orderBtnText: { color: 'white', fontWeight: 'bold' }
});
