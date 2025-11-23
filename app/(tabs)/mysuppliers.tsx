import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function MySuppliersScreen() {
  const [links, setLinks] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const { logout } = useAuth();

  const loadLinks = async () => {
    try {
      const res = await api.get('/links/my-requests');
      setLinks(res.data);
    } catch (e) {
      console.error(e);
    }
  };

  // FIX: Auto-refresh every time you open this tab
  useFocusEffect(
    useCallback(() => {
      loadLinks();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadLinks();
    setRefreshing(false);
  };

  const handleLogout = () => {
    Alert.alert("Logout", "Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Logout", style: 'destructive', onPress: logout }
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Log Out</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={links}
        keyExtractor={(item: any) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={<Text style={styles.empty}>No connections yet.</Text>}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View>
              <Text style={styles.name}>{item.supplier_name}</Text>
              <Text style={{ color: item.status.toLowerCase() === 'accepted' ? 'green' : '#F5A623', fontWeight: 'bold' }}>
                {item.status.toUpperCase()}
              </Text>
            </View>
            
            {item.status.toLowerCase() === 'accepted' && (
              <View style={styles.actions}>
                {/* Shop uses Supplier ID (Vendor ID) */}
                <TouchableOpacity 
                  style={styles.btn} 
                  onPress={() => router.push(`/supplier/${item.supplier_id}`)}>
                  <Text style={styles.btnText}>Shop</Text>
                </TouchableOpacity>

                {/* Chat uses Supplier USER ID (Identity ID) - This fixes the chat bug */}
                <TouchableOpacity 
                  style={[styles.btn, styles.chatBtn]} 
                  onPress={() => router.push(`/chat/${item.supplier_user_id}`)}>
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
  header: { flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 },
  logoutBtn: { backgroundColor: '#ff3b30', padding: 8, borderRadius: 5 },
  logoutText: { color: 'white', fontWeight: 'bold' },
  card: { padding: 15, backgroundColor: 'white', marginBottom: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderRadius: 8, elevation: 2 },
  name: { fontSize: 16, fontWeight: 'bold' },
  actions: { flexDirection: 'row', gap: 10 },
  btn: { backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 5 },
  chatBtn: { backgroundColor: '#34C759' },
  btnText: { color: 'white', fontWeight: 'bold' },
  empty: { textAlign: 'center', marginTop: 20, color: 'gray' }
});
