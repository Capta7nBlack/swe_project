import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, KeyboardAvoidingView, Platform } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import api from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export default function ChatScreen() {
  const { id } = useLocalSearchParams(); // The Supplier's User ID
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const flatListRef = useRef<FlatList>(null);

  const fetchMessages = async () => {
    try {
      const res = await api.get(`/chat/${id}`);
      setMessages(res.data);
    } catch (e) {
      console.log("Chat error", e);
    }
  };

  useEffect(() => {
    fetchMessages();
    // Poll every 3 seconds
    const interval = setInterval(fetchMessages, 3000);
    return () => clearInterval(interval);
  }, [id]);

  const sendMessage = async () => {
    if (!text.trim()) return;
    
    const content = text;
    setText(''); // Clear input immediately for better UX

    try {
      await api.post('/chat', { recipient_id: id, content });
      await fetchMessages(); // Refresh immediately
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.container} keyboardVerticalOffset={90}>
      <FlatList
        ref={flatListRef}
        data={messages}
        keyExtractor={(item: any) => item.id.toString()}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        renderItem={({ item }) => {
          const isMe = item.sender_id === user?.id;
          return (
            <View style={[styles.bubble, isMe ? styles.me : styles.them]}>
              <Text style={isMe ? styles.textMe : styles.textThem}>{item.content}</Text>
            </View>
          );
        }}
        contentContainerStyle={{ padding: 10 }}
      />
      
      <View style={styles.inputArea}>
        <TextInput 
          style={styles.input} 
          value={text} 
          onChangeText={setText} 
          placeholder="Type a message..." 
        />
        <TouchableOpacity onPress={sendMessage} style={styles.sendBtn}>
          <Text style={styles.sendText}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },
  bubble: { maxWidth: '80%', padding: 12, borderRadius: 15, marginBottom: 10 },
  me: { alignSelf: 'flex-end', backgroundColor: '#007AFF' },
  them: { alignSelf: 'flex-start', backgroundColor: '#E5E5EA' },
  textMe: { color: 'white' },
  textThem: { color: 'black' },
  inputArea: { flexDirection: 'row', padding: 10, backgroundColor: 'white', alignItems: 'center' },
  input: { flex: 1, backgroundColor: '#f0f0f0', borderRadius: 20, padding: 10, marginRight: 10 },
  sendBtn: { padding: 10 },
  sendText: { color: '#007AFF', fontWeight: 'bold' }
});
