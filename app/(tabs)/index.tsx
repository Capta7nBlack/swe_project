import React, { useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, Alert, RefreshControl } from 'react-native';
import { useFocusEffect } from 'expo-router';
import api from '../../services/api';

export default function DiscoveryScreen() {
  const [suppliers, setSuppliers] = useState([]);
  const [myLinks, setMyLinks] = useState<number[]>([]); 
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    try {
      const suppliersRes = await api.get('/suppliers');
      const linksRes = await api.get('/links/my-requests');
      
      const linkedSupplierIds = linksRes.data.map((link: any) => link.supplier_id);
      
      setSuppliers(suppliersRes.data);
      setMyLinks(linkedSupplierIds);
    } catch (e) { 
      console.error(e); 
    }
  };

  // FIX: Refresh data every time this screen is focused
  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  const requestLink = async (supplierId: number) => {
    try {
      await api.post('/links', { supplier_id: supplierId });
      Alert.alert("Success", "Request sent!");
      loadData(); // Refresh immediately
    } catch (e: any) {
      Alert.alert("Error", e.response?.data?.detail || "Failed");
    }
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={suppliers}
        keyExtractor={(item: any) => item.id.toString()}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const isLinked = myLinks.includes(item.id);
          return (
            <View style={styles.card}>
              <View style={{flex: 1}}>
                <Text style={styles.name}>{item.name} {item.verification_status && "✅"}</Text>
                <Text style={styles.about}>{item.about || "No description"}</Text>
              </View>
              
              {isLinked ? (
                <View style={styles.connectedBadge}>
                  <Text style={styles.connectedText}>Linked</Text>
                </View>
              ) : (
                <TouchableOpacity style={styles.btn} onPress={() => requestLink(item.id)}>
                  <Text style={styles.btnText}>Connect</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 10 },
  card: { padding: 15, backgroundColor: 'white', marginBottom: 10, borderRadius: 8, elevation: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 18, fontWeight: 'bold' },
  about: { color: 'gray', marginTop: 4 },
  btn: { backgroundColor: '#007AFF', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  btnText: { color: 'white', fontWeight: 'bold' },
  connectedBadge: { backgroundColor: '#E5E5EA', paddingHorizontal: 15, paddingVertical: 8, borderRadius: 5 },
  connectedText: { color: 'gray', fontWeight: 'bold' }
});
