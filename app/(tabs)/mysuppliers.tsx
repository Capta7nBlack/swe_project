import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import api from '../../services/api';

export default function MySuppliersScreen() {
  const [links, setLinks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadLinks = async () => {
    try {
      const res = await api.get('/links/my-requests');
      setLinks(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadLinks();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLinks();
    setRefreshing(false);
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={links}
        keyExtractor={(item: any) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No connections yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.supplier_name}</Text>
              <Text style={{ color: item.status === 'accepted' ? 'green' : '#F5A623', fontWeight: 'bold' }}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            
            {item.status === 'accepted' && (
              <View style={styles.actions}>
                <TouchableOpacity 
                  style={styles.btn} 
                  onPress={() => router.push(`/supplier/${item.supplier_id}`)}>
                  <Text style={styles.btnText}>Shop</Text>
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.btn, styles.chatBtn]} 
                  onPress={() => router.push(`/chat/${item.supplier_id}`)}>
                  <Text style={styles.btnText}>Chat</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  card: { padding: 15, backgroundColor: 'white', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, elevation: 2 },
  name: { fontSize: 16, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5 },
  chatBtn: { backgroundColor: '#34C759' },
  btnText: { color: 'white', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, color: 'gray' }
});
